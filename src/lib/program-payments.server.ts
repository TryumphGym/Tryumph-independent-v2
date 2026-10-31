import Stripe from "stripe";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { runtimeEnv } from "./runtime-env.server";
import { appOrigin } from "./app-origin.server";
import { intentFee } from "./private-payments.server";
import { assertProgramMediaReady } from "./program-media.server";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function programStripe() {
  const key = runtimeEnv("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key);
}
export async function createProgramCheckout(
  userId: string,
  programId: string,
  stripe = programStripe(),
) {
  if (runtimeEnv("PROGRAM_NATIVE_CHECKOUT_ENABLED") !== "true")
    throw new Error(
      "Paid program checkout awaits owner-approved commercial terms.",
    );
  const begun = await db.rpc("begin_program_order", {
    p_user: userId,
    p_program: programId,
  });
  if (begun.error) throw begun.error;
  let order = begun.data?.[0];
  if (!order) throw new Error("Program purchase unavailable");
  for (let attempt = 0; attempt < 2; attempt++) {
    if (order.checkout_id) {
      const previous = await stripe.checkout.sessions.retrieve(
        order.checkout_id,
      );
      if (
        previous.status === "expired" &&
        previous.payment_status === "unpaid"
      ) {
        const intent =
          typeof previous.payment_intent === "string"
            ? previous.payment_intent
            : previous.payment_intent?.id;
        if (intent) {
          const cancelledIntent = await stripe.paymentIntents.cancel(
            intent,
            { cancellation_reason: "abandoned" },
            { idempotencyKey: `program-expired:${order.id}` },
          );
          if (cancelledIntent.status !== "canceled")
            throw new Error(
              "Previous payment is still in progress. Do not start another charge.",
            );
        }

        const cancelled = await db.rpc("cancel_program_order", {
          p_order: order.id,
          p_checkout: previous.id,
        });
        if (cancelled.error) throw cancelled.error;
        const next = await db.rpc("begin_program_order", {
          p_user: userId,
          p_program: programId,
        });
        if (next.error) throw next.error;
        order = next.data?.[0];
        if (!order) throw new Error("Purchase unavailable");
        continue;
      }
      if (previous.payment_status === "paid")
        throw new Error(
          "Payment received. Refresh your program; access requires server verification. Contact support if a refunded purchase remains revoked.",
        );
      if (previous.status !== "open" || !previous.url)
        throw new Error(
          "Checkout is not open; contact support before retrying",
        );
      return { url: previous.url };
    }
    if (
      new Date(order.expires_at).getTime() < Date.now() ||
      new Date(order.created_at).getTime() < Date.now() - 23 * 3600000
    )
      throw new Error(
        "Unconfirmed checkout requires provider reconciliation; do not start another charge.",
      );
    const edition = await db
      .from("program_editions")
      .select("document")
      .eq("id", order.edition_id)
      .single();
    if (edition.error) throw edition.error;
    const used = await db
      .from("program_edition_videos")
      .select("video_id")
      .eq("edition_id", order.edition_id);
    if (used.error) throw used.error;
    const protectedVideos = await db
      .from("trainer_videos")
      .select("id")
      .in(
        "id",
        used.data.map((v) => v.video_id),
      )
      .eq("access_scope", "program");
    if (protectedVideos.error) throw protectedVideos.error;
    if (protectedVideos.data.length) assertProgramMediaReady();
    const account = await stripe.accounts.retrieve(order.destination);
    if (
      account.deleted ||
      !account.payouts_enabled ||
      account.capabilities?.transfers !== "active"
    )
      throw new Error("Trainer payouts are not ready");
    const metadata = {
      type: "program",
      orderId: order.id,
      userId: order.user_id,
      editionId: order.edition_id,
    };
    const document = edition.data.document as Record<string, unknown>;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        allowed_payment_method_types: ["card"],
        client_reference_id: order.id,
        expires_at: Math.floor(new Date(order.expires_at).getTime() / 1000),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: order.price_cents,
              product_data: {
                name: String(document["title"]).slice(0, 160),
                description: `One-time purchase. ${order.access_days ? `${order.access_days} days from payment confirmation.` : "Lifetime access."} No recurring membership.`,
              },
            },
          },
        ],
        metadata,
        payment_intent_data: {
          metadata,
          transfer_group: `program:${order.id}`,
        },
        success_url: `${appOrigin()}/programs/${programId}?payment=received`,
        cancel_url: `${appOrigin()}/programs/${programId}`,
      },
      { idempotencyKey: `program-checkout:${order.id}` },
    );
    const attached = await db.rpc("attach_program_checkout", {
      p_order: order.id,
      p_checkout: session.id,
      ...(typeof session.payment_intent === "string"
        ? { p_intent: session.payment_intent }
        : { p_intent: "" }),
    });
    if (attached.error) throw attached.error;
    if (!session.url) throw new Error("Checkout URL unavailable");
    return { url: session.url };
  }
  throw new Error("Checkout expired. Refresh the program before retrying.");
}
async function boundOrder(session: Stripe.Checkout.Session) {
  const id = session.metadata?.["orderId"];
  if (!id || !uuid.test(id)) throw new Error("Invalid program order identity");
  const result = await db
    .from("program_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (result.error) throw result.error;
  const o = result.data;
  if (
    session.client_reference_id !== o.id ||
    session.metadata?.["userId"] !== o.user_id ||
    session.metadata?.["editionId"] !== o.edition_id ||
    session.amount_total !== o.price_cents ||
    session.currency !== "usd" ||
    session.mode !== "payment"
  )
    throw new Error("Program checkout identity or amount mismatch");
  return o;
}
export async function settleProgramCheckout(
  stripe: Stripe,
  input: Stripe.Checkout.Session,
) {
  if (input.metadata?.["type"] !== "program") return false;
  const session = await stripe.checkout.sessions.retrieve(input.id);
  if (session.payment_status !== "paid") return true;
  const order = await boundOrder(session);
  const intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!intent) throw new Error("Program payment intent missing");
  const {
    intent: paid,
    gross,
    fee,
    refunded,
  } = await intentFee(stripe, intent);
  if (
    gross !== order.price_cents ||
    paid.metadata["orderId"] !== order.id ||
    paid.metadata["userId"] !== order.user_id ||
    paid.metadata["editionId"] !== order.edition_id
  )
    throw new Error("Program intent identity or amount mismatch");
  const settled = await db.rpc("confirm_program_order", {
    p_order: order.id,
    p_checkout: session.id,
    p_intent: intent,
    p_gross: gross,
    p_fee: fee,
    p_refunded: refunded,
  });
  if (settled.error) throw settled.error;
  return true;
}
export async function adjustProgramCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
  dispute?: Stripe.Dispute,
) {
  const intentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!intentId) return false;
  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (intent.metadata?.["type"] !== "program") return false;
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: intentId,
    limit: 10,
  });
  const session = sessions.data.find(
    (s) => s.metadata?.["orderId"] === intent.metadata["orderId"],
  );
  if (!session)
    throw new Error("Program checkout not yet available; retry event");
  const o = await boundOrder(session);
  if (
    charge.amount !== o.price_cents ||
    charge.currency !== "usd" ||
    intent.metadata["userId"] !== o.user_id ||
    intent.metadata["editionId"] !== o.edition_id
  )
    throw new Error("Program charge mismatch");
  const fresh = dispute ? await stripe.disputes.retrieve(dispute.id) : null;
  const status =
    fresh?.status === "won"
      ? "won"
      : fresh?.status === "lost"
        ? "lost"
        : "open";
  const adjusted = await db.rpc("adjust_program_payment", {
    p_order: o.id,
    p_checkout: session.id,
    p_intent: intentId,
    p_refunded: charge.amount_refunded,
    ...(fresh
      ? { p_dispute: fresh.id, p_status: status }
      : { p_dispute: "", p_status: "" }),
  });
  if (adjusted.error) throw adjusted.error;
  return true;
}
/** Uses existing Connect accounts, with its own exact-basis-point ledger. No legacy earning types/splits change. */
export async function reconcileProgramTransfers(stripe = programStripe()) {
  const orders = await db
    .from("program_orders")
    .select("id,destination")
    .eq("payout_dirty", true)
    .not("paid_at", "is", null)
    .order("created_at")
    .limit(200);
  if (orders.error) {
    if (["42P01", "PGRST205"].includes(orders.error.code))
      return { paid: 0, reversed: 0, waiting: 0 };
    throw orders.error;
  }
  let paid = 0,
    reversed = 0,
    waiting = 0;
  for (const o of orders.data) {
    // Multiple reversals can be necessary if several confirmed transfers exist.
    for (let i = 0; i < 10; i++) {
      const claimed = await db.rpc("claim_program_payout", { p_order: o.id });
      if (claimed.error) throw claimed.error;
      const op = claimed.data?.[0];
      if (!op) {
        waiting++;
        break;
      }
      const idempotencyKey = `program-payout:${op.id}`;
      let provider: string;
      if (op.kind === "reversal" && op.transfer_id) {
        const r = await stripe.transfers.createReversal(
          op.transfer_id,
          { amount: op.amount },
          { idempotencyKey },
        );
        if (r.amount !== op.amount)
          throw new Error("Reversal confirmation mismatch");
        provider = r.id;
        reversed++;
      } else {
        const account = await stripe.accounts.retrieve(o.destination);
        if (account.deleted || !account.payouts_enabled)
          throw new Error("Program transfer account unavailable");
        const t = await stripe.transfers.create(
          {
            amount: op.amount,
            currency: "usd",
            destination: o.destination,
            transfer_group: `program:${o.id}`,
            metadata: { program_order: o.id },
          },
          { idempotencyKey },
        );
        if (t.amount !== op.amount)
          throw new Error("Transfer confirmation mismatch");
        provider = t.id;
        paid++;
      }
      const saved = await db.rpc("finish_program_payout", {
        p_operation: op.id,
        p_provider: provider,
      });
      if (saved.error) throw saved.error;
    }
  }
  return { paid, reversed, waiting };
}
export async function processProgramRefunds(stripe = programStripe()) {
  const jobs = await db
    .from("program_refund_requests")
    .select("*")
    .is("completed_at", null)
    .limit(100);
  if (jobs.error) {
    if (["42P01", "PGRST205"].includes(jobs.error.code))
      return { completed: 0, failed: 0 };
    throw jobs.error;
  }
  let completed = 0,
    failed = 0;
  for (const job of jobs.data) {
    try {
      const result = await db
        .from("program_orders")
        .select("*")
        .eq("id", job.order_id)
        .single();
      if (result.error) throw result.error;
      const o = result.data;
      if (!o.intent_id || !o.checkout_id) continue;
      const intent = await stripe.paymentIntents.retrieve(o.intent_id, {
        expand: ["latest_charge"],
      });
      const charge = intent.latest_charge;
      if (!charge || typeof charge === "string")
        throw new Error("Program refund charge unavailable");
      if (charge.amount_refunded < o.price_cents) {
        if (
          !job.provider_id &&
          new Date(job.created_at).getTime() < Date.now() - 23 * 3600000
        )
          throw new Error("Ambiguous refund requires provider reconciliation");
        const refund = job.provider_id
          ? await stripe.refunds.retrieve(job.provider_id)
          : await stripe.refunds.create(
              { payment_intent: o.intent_id },
              { idempotencyKey: `program-refund:${o.id}` },
            );
        const recorded = await db
          .from("program_refund_requests")
          .update({ provider_id: refund.id })
          .eq("order_id", o.id);
        if (recorded.error) throw recorded.error;
        if (refund.status !== "succeeded") continue;
        const fresh = await stripe.charges.retrieve(charge.id);
        await adjustProgramCharge(stripe, fresh);
        if (fresh.amount_refunded < o.price_cents) continue;
      } else await adjustProgramCharge(stripe, charge);
      const done = await db
        .from("program_refund_requests")
        .update({ completed_at: new Date().toISOString() })
        .eq("order_id", o.id);
      if (done.error) throw done.error;
      completed++;
    } catch (error) {
      failed++;
      console.error(
        "Program refund retained for reconciliation",
        job.order_id,
        error,
      );
    }
  }
  return { completed, failed };
}
