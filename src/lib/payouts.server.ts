import type Stripe from "stripe";

// Trainer shares are always applied to the amount left AFTER processing fees.
export const SHARES = { oneonone: 90, live: 50, ads: 50 } as const;
export type Source = keyof typeof SHARES;

export function split(grossCents: number, feeCents: number, source: Source) {
  if (
    !Number.isSafeInteger(grossCents) ||
    !Number.isSafeInteger(feeCents) ||
    grossCents < 0 ||
    feeCents < 0 ||
    feeCents > grossCents
  )
    throw new Error("Invalid processing allocation");
  const net = grossCents - feeCents;
  return {
    net,
    payout: Math.floor((net * SHARES[source]) / 100),
    pct: SHARES[source],
  };
}

// Require the actual settled Stripe processing fee for trainer accounting.
// Never silently replace it with an estimate in production.
export async function sessionFee(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  const gross = session.amount_total;
  if (!Number.isSafeInteger(gross) || gross === null || gross < 0)
    throw new Error("Missing checkout amount");
  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!intentId) throw new Error("Payment intent not yet available");
  const intent = await stripe.paymentIntents.retrieve(intentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = intent.latest_charge as Stripe.Charge | null;
  if (!charge || typeof charge !== "object")
    throw new Error("Charge not yet available");
  const transaction = charge.balance_transaction;
  if (!transaction || typeof transaction === "string")
    throw new Error("Processing fee not yet available; retry webhook");
  const fee = transaction.fee;
  if (!Number.isSafeInteger(fee) || fee < 0 || fee > gross)
    throw new Error("Invalid processing fee");
  return { gross, fee, chargeId: charge.id };
}
