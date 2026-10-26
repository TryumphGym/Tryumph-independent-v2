import { runtimeEnv } from "@/lib/runtime-env.server";
import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { split, sessionFee } from "@/lib/payouts.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeDay = /^\d{4}-\d{2}-\d{2}$/;
const safeTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

async function settleCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  if (session.currency !== "usd")
    throw new Error("Unsupported checkout currency");
  if (session.mode !== "payment" || session.payment_status !== "paid") return;
  const disputed = await supabaseAdmin
    .from("payment_disputes")
    .select("id")
    .eq("checkout_id", session.id)
    .in("status", ["open", "lost"])
    .limit(1);
  if (disputed.error) throw disputed.error;
  if (disputed.data?.length) return;
  const meta = session.metadata ?? {};
  if (!meta["userId"] || !uuid.test(meta["userId"]))
    throw new Error("Invalid payment customer");
  const { gross, fee } = await sessionFee(stripe, session);
  if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(fee) || fee > gross)
    throw new Error("Invalid payment fee");
  let result: { error: { message: string } | null };
  if (meta["type"] === "tokens") {
    const tokens = Number(meta["tokens"]);
    if (!Number.isInteger(tokens) || tokens < 1 || tokens > 100)
      throw new Error("Invalid token count");
    result = await supabaseAdmin.rpc("apply_paid_token_checkout", {
      p_checkout_id: session.id,
      p_user_id: meta["userId"],
      p_tokens: tokens,
      p_gross_cents: gross,
      p_fee_cents: fee,
    });
  } else if (meta["type"] === "booking") {
    if (
      !meta["trainerId"] ||
      !uuid.test(meta["trainerId"]) ||
      !meta["holdId"] ||
      !uuid.test(meta["holdId"]) ||
      !safeDay.test(meta["date"] ?? "") ||
      !safeTime.test(meta["time"] ?? "")
    )
      throw new Error("Invalid booking");
    result = await supabaseAdmin.rpc("apply_paid_private_booking", {
      p_checkout_id: session.id,
      p_user_id: meta["userId"],
      p_trainer_id: meta["trainerId"],
      p_day: meta["date"]!,
      p_time: meta["time"]!,
      p_gross_cents: gross,
      p_fee_cents: fee,
      p_trainer_cents: split(gross, fee, "oneonone").payout,
      p_hold_id: meta["holdId"],
    });
  } else if (meta["type"] === "live") {
    if (!meta["sessionId"] || !uuid.test(meta["sessionId"]))
      throw new Error("Invalid class");
    result = await supabaseAdmin.rpc("apply_paid_live_checkout", {
      p_checkout_id: session.id,
      p_user_id: meta["userId"],
      p_session_id: meta["sessionId"],
      p_gross_cents: gross,
      p_fee_cents: fee,
    });
  } else {
    return;
  }
  if (result.error) {
    if (
      (meta["type"] === "booking" || meta["type"] === "live") &&
      "code" in result.error &&
      result.error.code === "P0001"
    ) {
      const refund = await supabaseAdmin
        .from("refund_jobs")
        .upsert(
          { checkout_id: session.id, reason: "paid_booking_unfulfillable" },
          { onConflict: "checkout_id", ignoreDuplicates: true },
        );
      if (refund.error) throw refund.error;
      return;
    }
    throw new Error(result.error.message);
  }
}

async function handleRefund(stripe: Stripe, charge: Stripe.Charge) {
  const paymentIntent =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntent) return;
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntent,
    limit: 10,
  });
  for (const session of sessions.data) {
    const refunded = charge.amount_refunded ?? 0;
    const { error } = await supabaseAdmin.rpc("apply_checkout_refund", {
      p_checkout_id: session.id,
      p_refund_cents: refunded,
      p_fully_refunded: refunded >= (session.amount_total ?? charge.amount),
    });
    if (error) throw new Error(error.message);
  }
}

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = runtimeEnv("STRIPE_SECRET_KEY");
        const secret = runtimeEnv("STRIPE_WEBHOOK_SECRET");
        if (!key || !secret)
          return new Response("Stripe not configured", { status: 503 });
        const stripe = new Stripe(key);
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            await request.text(),
            request.headers.get("stripe-signature") ?? "",
            secret,
          );
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }
        try {
          if (
            event.type === "checkout.session.completed" ||
            event.type === "checkout.session.async_payment_succeeded"
          ) {
            await settleCheckout(
              stripe,
              event.data.object as Stripe.Checkout.Session,
            );
          }
          if (event.type === "charge.refunded")
            await handleRefund(stripe, event.data.object as Stripe.Charge);
          if (
            event.type === "charge.dispute.created" ||
            event.type === "charge.dispute.closed"
          ) {
            const dispute = event.data.object as Stripe.Dispute;
            const charge =
              typeof dispute.charge === "string"
                ? await stripe.charges.retrieve(dispute.charge)
                : dispute.charge;
            const intent =
              typeof charge.payment_intent === "string"
                ? charge.payment_intent
                : charge.payment_intent?.id;
            if (intent) {
              const sessions = await stripe.checkout.sessions.list({
                payment_intent: intent,
                limit: 10,
              });
              for (const session of sessions.data) {
                const status =
                  event.type === "charge.dispute.created"
                    ? "open"
                    : dispute.status === "won"
                      ? "won"
                      : "lost";
                const applied = await supabaseAdmin.rpc(
                  "apply_payment_dispute",
                  {
                    p_id: dispute.id,
                    p_checkout_id: session.id,
                    p_status: status,
                  },
                );
                if (applied.error) throw applied.error;
                if (status === "won") {
                  await settleCheckout(stripe, session);
                  const restored = await supabaseAdmin.rpc(
                    "restore_won_disputes",
                    {},
                  );
                  if (restored.error) throw restored.error;
                }
              }
            }
          }
          return new Response("ok", { status: 200 });
        } catch (error) {
          console.error("Stripe event settlement failed", event.id, error);
          return new Response("Settlement failed; retry event", {
            status: 500,
          });
        }
      },
    },
  },
});
