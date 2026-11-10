import type Stripe from "stripe";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { runtimeEnv } from "./runtime-env.server";
import { appOrigin } from "./app-origin.server";
import { programStripe } from "./program-payments.server";
import { intentFee } from "./private-payments.server";
import { executeConnectOperation } from "./native-commerce.server";
import type { Tables } from "@/integrations/supabase/types";
type Order = Tables<"creator_orders">;
const idOf = (v: string | { id: string } | null | undefined) =>
  typeof v === "string" ? v : v?.id;
const optional = <T>(r: { data: T; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data;
};
const checked = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  if (r.data == null) throw new Error("Native commerce record unavailable");
  return r.data as NonNullable<T>;
};
export async function checkCreatorConnect(
  trainer: string,
  stripe = programStripe(),
) {
  const row = checked(
    await db
      .from("trainer_accounts")
      .select("stripe_account_id")
      .eq("user_id", trainer)
      .maybeSingle(),
  );
  if (!row?.stripe_account_id)
    throw new Error(
      "Set up your payout account before activating paid services",
    );
  const a = await stripe.accounts.retrieve(row.stripe_account_id);
  const ready =
    !a.deleted &&
    a.payouts_enabled === true &&
    a.capabilities?.transfers === "active";
  optional(
    await db
      .from("trainer_accounts")
      .update({ payouts_enabled: ready })
      .eq("user_id", trainer),
  );
  if (!ready) throw new Error("Stripe transfers and payouts are not eligible");
  return a.id;
}
export async function createCreatorCheckout(
  user: string,
  trainer: string,
  stripe = programStripe(),
) {
  if (runtimeEnv("CREATOR_MEMBERSHIPS_ENABLED") !== "true")
    throw new Error(
      "Optional memberships await sandbox configuration and owner activation",
    );
  await checkCreatorConnect(trainer, stripe);
  let order = checked(
    await db.rpc("begin_creator_order", { p_user: user, p_trainer: trainer }),
  )[0];
  if (!order) throw new Error("Membership unavailable");
  if (order.state === "confirmed")
    throw new Error(
      "A subscription already exists. Manage its payment or cancellation instead of starting another charge.",
    );
  if (order.checkout_id) {
    const previous = await stripe.checkout.sessions.retrieve(order.checkout_id);
    if (previous.status === "open" && previous.url)
      return { url: previous.url };
    if (previous.status !== "expired" || previous.payment_status !== "unpaid")
      throw new Error(
        "Existing checkout requires confirmation; do not start another charge",
      );
    const sub = idOf(previous.subscription);
    if (sub)
      await stripe.subscriptions.cancel(sub, {
        invoice_now: false,
        prorate: false,
      });
    optional(
      await db
        .from("creator_orders")
        .update({ state: "cancelled", billing_status: "incomplete_expired" })
        .eq("id", order.id)
        .eq("state", "pending"),
    );
    order = checked(
      await db.rpc("begin_creator_order", { p_user: user, p_trainer: trainer }),
    )[0];
    if (!order) throw new Error("Membership unavailable");
  }
  if (
    Date.parse(order.expires_at) < Date.now() + 31 * 60000 ||
    Date.parse(order.created_at) < Date.now() - 23 * 3600000
  )
    throw new Error(
      "Unconfirmed checkout requires provider reconciliation before retrying",
    );
  let customer = optional(
    await db
      .from("creator_customers")
      .select("customer_id")
      .eq("user_id", user)
      .maybeSingle(),
  )?.customer_id;
  if (!customer) {
    const c = await stripe.customers.create(
      { metadata: { creator_user: user } },
      { idempotencyKey: `creator-customer:${user}` },
    );
    customer = c.id;
    optional(
      await db
        .from("creator_customers")
        .upsert({ user_id: user, customer_id: customer }),
    );
  }
  optional(
    await db
      .from("creator_orders")
      .update({ customer_id: customer })
      .eq("id", order.id),
  );
  const priceRow = checked(
    await db
      .from("creator_prices")
      .select("*")
      .eq("trainer_id", trainer)
      .eq("revision", order.revision)
      .single(),
  );
  let price = priceRow.stripe_price_id;
  if (!price) {
    const p = await stripe.prices.create(
      {
        currency: "usd",
        unit_amount: order.price_cents,
        recurring: { interval: "month" },
        product_data: {
          name: "Trybe monthly membership",
          metadata: { trainer_id: trainer },
        },
        metadata: { trainer_id: trainer, revision: String(order.revision) },
      },
      { idempotencyKey: `creator-price:${trainer}:${order.revision}` },
    );
    price = p.id;
    optional(
      await db
        .from("creator_prices")
        .update({ stripe_price_id: price })
        .eq("trainer_id", trainer)
        .eq("revision", order.revision),
    );
  }
  const metadata = {
    type: "trybe_membership",
    orderId: order.id,
    userId: user,
    trainerId: trainer,
  };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      custom_text: {
        submit: {
          message:
            "Optional monthly trainer membership. Renews until cancelled; cancel future renewal in your Tryumph account. Separate program purchases are not included.",
        },
      },
      customer,
      client_reference_id: order.id,
      allowed_payment_method_types: ["card"],
      line_items: [{ price, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      expires_at: Math.floor(Date.parse(order.expires_at) / 1000),
      success_url: `${appOrigin()}/trybes?t=coach-${trainer}&membership=received`,
      cancel_url: `${appOrigin()}/trybes?t=coach-${trainer}`,
    },
    { idempotencyKey: `creator-checkout:${order.id}` },
  );
  if (!session.url) throw new Error("Checkout unavailable");
  optional(
    await db.rpc("attach_creator_subscription", {
      p_order: order.id,
      p_checkout: session.id,
      p_subscription: "",
      p_customer: customer,
      p_status: "incomplete",
      p_cancel: false,
    }),
  );
  return { url: session.url };
}
async function boundSubscription(stripe: Stripe, input: string) {
  const sub = await stripe.subscriptions.retrieve(input);
  if (sub.metadata["type"] !== "trybe_membership") return null;
  const o = checked(
    await db
      .from("creator_orders")
      .select("*")
      .eq("id", sub.metadata["orderId"] ?? "")
      .single(),
  );
  if (
    o.user_id !== sub.metadata["userId"] ||
    o.trainer_id !== sub.metadata["trainerId"] ||
    idOf(sub.customer) !== o.customer_id ||
    (o.subscription_id && o.subscription_id !== sub.id)
  )
    throw new Error("Subscription identity mismatch");
  const price = checked(
    await db
      .from("creator_prices")
      .select("stripe_price_id")
      .eq("trainer_id", o.trainer_id)
      .eq("revision", o.revision)
      .single(),
  );
  if (
    sub.items.has_more ||
    sub.items.data.length !== 1 ||
    sub.items.data[0]?.price.id !== price.stripe_price_id ||
    sub.items.data[0]?.quantity !== 1 ||
    sub.items.data[0].price.unit_amount !== o.price_cents ||
    sub.items.data[0].price.currency !== "usd" ||
    sub.items.data[0].price.recurring?.interval !== "month" ||
    sub.items.data[0].price.recurring.interval_count !== 1
  )
    throw new Error("Unsupported or altered recurring price");
  let checkout = o.checkout_id;
  if (!checkout) {
    const sessions = await stripe.checkout.sessions.list({
      subscription: sub.id,
      limit: 10,
    });
    const s = sessions.data.find(
      (s) =>
        s.client_reference_id === o.id &&
        s.metadata?.["orderId"] === o.id &&
        s.mode === "subscription" &&
        idOf(s.customer) === o.customer_id,
    );
    if (!s) throw new Error("Checkout identity not yet available; retry event");
    checkout = s.id;
  }
  optional(
    await db.rpc("attach_creator_subscription", {
      p_order: o.id,
      p_checkout: checkout,
      p_subscription: sub.id,
      p_customer: o.customer_id!,
      p_status: sub.status,
      p_cancel: sub.cancel_at_period_end,
    }),
  );
  return { order: o, subscription: sub };
}
export async function settleCreatorInvoice(stripe: Stripe, invoiceId: string) {
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const subId = idOf(invoice.parent?.subscription_details?.subscription);
  if (!subId) return false;
  const bound = await boundSubscription(stripe, subId);
  if (!bound) return false;
  if (invoice.status !== "paid") return true;
  const { order: o } = bound;
  const lines = await stripe.invoices.listLineItems(invoice.id, { limit: 100 });
  const price = checked(
    await db
      .from("creator_prices")
      .select("stripe_price_id")
      .eq("trainer_id", o.trainer_id)
      .eq("revision", o.revision)
      .single(),
  );
  const line = lines.data[0];
  if (
    invoice.currency !== "usd" ||
    invoice.amount_paid !== o.price_cents ||
    idOf(invoice.customer) !== o.customer_id ||
    lines.has_more ||
    lines.data.length !== 1 ||
    line?.quantity !== 1 ||
    line.pricing?.price_details?.price !== price.stripe_price_id ||
    line.amount !== o.price_cents
  )
    throw new Error("Invoice amount, customer or recurring line mismatch");
  const payments = await stripe.invoicePayments.list({
    invoice: invoice.id,
    status: "paid",
    limit: 100,
  });
  const payment = payments.data[0];
  const intentId =
    payment?.payment.type === "payment_intent"
      ? idOf(payment.payment.payment_intent)
      : undefined;
  if (
    payments.has_more ||
    payments.data.length !== 1 ||
    !intentId ||
    idOf(payment!.invoice) !== invoice.id
  )
    throw new Error("Exactly one settled native invoice payment required");
  const paid = await intentFee(stripe, intentId);
  if (
    paid.gross !== o.price_cents ||
    idOf(paid.intent.customer) !== o.customer_id
  )
    throw new Error("Invoice payment identity or amount mismatch");
  // Refresh payout eligibility; a failed check makes the DB receipt unfulfillable, never earned.
  try {
    await checkCreatorConnect(o.trainer_id, stripe);
  } catch (e) {
    const account = checked(
      await db
        .from("trainer_accounts")
        .select("payouts_enabled")
        .eq("user_id", o.trainer_id)
        .maybeSingle(),
    );
    if (account?.payouts_enabled) throw e;
  }
  const paidAt = invoice.status_transitions.paid_at;
  if (!paidAt) throw new Error("Confirmed payment time unavailable");
  checked(
    await db.rpc("record_creator_invoice", {
      p_order: o.id,
      p_invoice: invoice.id,
      p_intent: intentId,
      p_gross: paid.gross,
      p_fee: paid.fee,
      p_refunded: paid.refunded,
      p_start: new Date(line.period.start * 1000).toISOString(),
      p_end: new Date(line.period.end * 1000).toISOString(),
      p_paid: new Date(paidAt * 1000).toISOString(),
    }),
  );
  return true;
}
async function stopRenewal(stripe: Stripe, o: Order) {
  optional(
    await db
      .from("creator_orders")
      .update({ renewal_stop_requested: true })
      .eq("id", o.id),
  );
  if (o.subscription_id) {
    const sub = await stripe.subscriptions.retrieve(o.subscription_id);
    if (sub.status !== "canceled")
      await stripe.subscriptions.cancel(sub.id, {
        invoice_now: false,
        prorate: false,
      });
    await boundSubscription(stripe, sub.id);
  }
}
export async function handleCreatorBillingEvent(
  stripe: Stripe,
  event: Stripe.Event,
) {
  if (event.type === "checkout.session.completed") {
    const input = event.data.object as Stripe.Checkout.Session;
    if (input.metadata?.["type"] !== "trybe_membership") return false;
    const s = await stripe.checkout.sessions.retrieve(input.id);
    const sub = idOf(s.subscription);
    if (!sub) throw new Error("Subscription confirmation unavailable");
    const b = await boundSubscription(stripe, sub);
    if (
      !b ||
      s.client_reference_id !== b.order.id ||
      s.metadata?.["userId"] !== b.order.user_id ||
      s.metadata?.["trainerId"] !== b.order.trainer_id ||
      s.mode !== "subscription"
    )
      throw new Error("Checkout identity mismatch");
    return true;
  }
  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as Stripe.Subscription;
    return !!(await boundSubscription(stripe, sub.id));
  }
  if (event.type.startsWith("invoice.")) {
    const input = event.data.object as Stripe.Invoice;
    const invoice = await stripe.invoices.retrieve(input.id);
    const subId = idOf(invoice.parent?.subscription_details?.subscription);
    if (!subId) return false;
    const b = await boundSubscription(stripe, subId);
    if (!b) return false;
    if (event.type === "invoice.created") {
      const eligible = checked(
        await db.rpc("creator_can_sell", { p_trainer: b.order.trainer_id }),
      );
      const offer = checked(
        await db
          .from("creator_offers")
          .select("enabled,blocked")
          .eq("trainer_id", b.order.trainer_id)
          .single(),
      );
      let ready =
        eligible &&
        offer.enabled &&
        !offer.blocked &&
        !b.order.renewal_stop_requested;
      if (ready) {
        try {
          await checkCreatorConnect(b.order.trainer_id, stripe);
        } catch (e) {
          if (
            e instanceof Error &&
            e.message === "Stripe transfers and payouts are not eligible"
          )
            ready = false;
          else throw e;
        }
      }
      if (!ready) {
        await stopRenewal(stripe, b.order);
        try {
          const current = await stripe.invoices.retrieve(invoice.id);
          if (current.status === "draft") await stripe.invoices.del(invoice.id);
          else if (current.status === "open")
            await stripe.invoices.voidInvoice(invoice.id);
          else if (current.status === "paid")
            await settleCreatorInvoice(stripe, invoice.id);
        } catch (e) {
          if ((e as { code?: string }).code !== "resource_missing") throw e;
        }
      }
      return true;
    }
    if (invoice.status === "paid")
      await settleCreatorInvoice(stripe, invoice.id);
    return true;
  }
  return false;
}
export async function adjustCreatorCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
  dispute?: Stripe.Dispute,
) {
  const intent = idOf(charge.payment_intent);
  if (!intent) return false;
  let r = optional(
    await db
      .from("creator_receipts")
      .select("*")
      .eq("intent_id", intent)
      .maybeSingle(),
  );
  if (!r) {
    const payments = await stripe.invoicePayments.list({
      payment: { type: "payment_intent", payment_intent: intent },
      limit: 10,
    });
    for (const p of payments.data) {
      const invoiceId = idOf(p.invoice);
      if (invoiceId && (await settleCreatorInvoice(stripe, invoiceId))) {
        r = optional(
          await db
            .from("creator_receipts")
            .select("*")
            .eq("intent_id", intent)
            .maybeSingle(),
        );
        break;
      }
    }
    if (!r) return false;
  }
  const fresh = await stripe.charges.retrieve(charge.id);
  if (
    idOf(fresh.payment_intent) !== r.intent_id ||
    fresh.currency !== "usd" ||
    fresh.amount !== r.price_cents
  )
    throw new Error("Receipt charge mismatch");
  const d = dispute ? await stripe.disputes.retrieve(dispute.id) : null;
  if (d && idOf(d.charge) !== fresh.id)
    throw new Error("Dispute identity mismatch");
  optional(
    await db.rpc("adjust_creator_receipt", {
      p_receipt: r.id,
      p_refunded: fresh.amount_refunded,
      p_dispute: d?.id ?? "",
      p_status:
        d?.status === "won" ? "won" : d?.status === "lost" ? "lost" : "open",
    }),
  );
  return true;
}
export async function cancelCreatorMembership(
  user: string,
  order: string,
  stripe = programStripe(),
) {
  const o = checked(
    await db
      .from("creator_orders")
      .select("*")
      .eq("id", order)
      .eq("user_id", user)
      .single(),
  );
  if (!o.subscription_id) throw new Error("No subscription to cancel");
  const b = await boundSubscription(stripe, o.subscription_id);
  if (!b || b.order.user_id !== user) throw new Error("Not your subscription");
  if (b.subscription.status !== "canceled")
    await stripe.subscriptions.update(o.subscription_id, {
      cancel_at_period_end: true,
    });
  await boundSubscription(stripe, o.subscription_id);
  return true;
}
export async function creatorBillingPortal(
  user: string,
  stripe = programStripe(),
) {
  const c = checked(
    await db
      .from("creator_customers")
      .select("customer_id")
      .eq("user_id", user)
      .single(),
  );
  const config = runtimeEnv("CREATOR_PORTAL_CONFIGURATION_ID");
  if (!config)
    throw new Error("Configure the membership payment-management portal first");
  const session = await stripe.billingPortal.sessions.create({
    customer: c.customer_id,
    configuration: config,
    return_url: `${appOrigin()}/account`,
    flow_data: { type: "payment_method_update" },
  });
  return { url: session.url };
}
export async function reconcileCreatorTransfers(stripe = programStripe()) {
  const rows = await db
    .from("creator_receipts")
    .select("id,destination")
    .eq("payout_dirty", true)
    .order("created_at")
    .limit(200);
  if (rows.error) {
    if (["42P01", "PGRST205"].includes(rows.error.code))
      return { paid: 0, reversed: 0, waiting: 0 };
    throw rows.error;
  }
  let paid = 0,
    reversed = 0,
    waiting = 0;
  for (const r of rows.data)
    for (let i = 0; i < 10; i++) {
      const op = checked(
        await db.rpc("claim_creator_payout", { p_order: r.id }),
      )[0];
      if (!op) {
        waiting++;
        break;
      }
      const provider = await executeConnectOperation(stripe, {
        ...op,
        destination: r.destination,
        idempotencyKey: `creator-payout:${op.id}`,
        group: `membership:${r.id}`,
      });
      optional(
        await db.rpc("finish_creator_payout", {
          p_operation: op.id,
          p_provider: provider,
        }),
      );
      if (op.kind === "transfer") paid++;
      else reversed++;
    }
  return { paid, reversed, waiting };
}
export async function processCreatorRefunds(stripe = programStripe()) {
  const jobs = await db
    .from("creator_refund_jobs")
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
  for (const job of jobs.data)
    try {
      const r = checked(
        await db
          .from("creator_receipts")
          .select("*")
          .eq("id", job.receipt_id)
          .single(),
      );
      const intent = await stripe.paymentIntents.retrieve(r.intent_id, {
        expand: ["latest_charge"],
      });
      const charge = intent.latest_charge;
      if (!charge || typeof charge === "string")
        throw new Error("Refund charge unavailable");
      if (charge.amount_refunded < r.price_cents) {
        if (
          !job.provider_id &&
          Date.parse(job.created_at) < Date.now() - 23 * 3600000
        )
          throw new Error("Ambiguous refund requires provider reconciliation");
        const refund = job.provider_id
          ? await stripe.refunds.retrieve(job.provider_id)
          : await stripe.refunds.create(
              { payment_intent: r.intent_id },
              { idempotencyKey: `creator-refund:${r.id}` },
            );
        optional(
          await db
            .from("creator_refund_jobs")
            .update({ provider_id: refund.id })
            .eq("receipt_id", r.id),
        );
        if (refund.status !== "succeeded") continue;
        const fresh = await stripe.charges.retrieve(charge.id);
        await adjustCreatorCharge(stripe, fresh);
        if (fresh.amount_refunded < r.price_cents) continue;
      } else await adjustCreatorCharge(stripe, charge);
      optional(
        await db
          .from("creator_refund_jobs")
          .update({ completed_at: new Date().toISOString() })
          .eq("receipt_id", r.id),
      );
      completed++;
    } catch (e) {
      failed++;
      console.error(
        "Membership refund retained for reconciliation",
        job.receipt_id,
        e,
      );
    }
  return { completed, failed };
}
export async function maintainCreatorRenewals(stripe = programStripe()) {
  const batch = await db.rpc("creator_renewal_batch", { p_limit: 100 });
  if (batch.error) {
    if (["42883", "PGRST202"].includes(batch.error.code)) return;
    throw batch.error;
  }
  const eligibility = new Map<string, boolean>();
  for (const o of batch.data) {
    let ready = eligibility.get(o.trainer_id);
    if (ready === undefined) {
      ready = checked(
        await db.rpc("creator_can_sell", { p_trainer: o.trainer_id }),
      );
      const offer = checked(
        await db
          .from("creator_offers")
          .select("enabled,blocked")
          .eq("trainer_id", o.trainer_id)
          .single(),
      );
      ready = ready && offer.enabled && !offer.blocked;
      if (ready)
        try {
          await checkCreatorConnect(o.trainer_id, stripe);
        } catch (e) {
          if (
            e instanceof Error &&
            e.message === "Stripe transfers and payouts are not eligible"
          )
            ready = false;
          else throw e;
        }
      eligibility.set(o.trainer_id, ready);
    }
    if (!ready || o.renewal_stop_requested) await stopRenewal(stripe, o);
  }
}
