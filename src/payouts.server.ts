import type Stripe from "stripe";

// Trainer shares are always applied to the amount left AFTER processing fees.
export const SHARES = { oneonone: 90, live: 50, ads: 50 } as const;
export type Source = keyof typeof SHARES;

export function split(grossCents: number, feeCents: number, source: Source) {
  const net = Math.max(0, grossCents - feeCents);
  return { net, payout: Math.floor((net * SHARES[source]) / 100), pct: SHARES[source] };
}

// Real Stripe fee for a completed checkout (falls back to 2.9% + 30¢ if not settled yet).
export async function sessionFee(stripe: Stripe, session: Stripe.Checkout.Session) {
  const gross = session.amount_total ?? 0;
  let fee = Math.round(gross * 0.029) + 30;
  let chargeId: string | null = null;
  if (typeof session.payment_intent === "string") {
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ["latest_charge.balance_transaction"] });
    const charge = pi.latest_charge as Stripe.Charge | null;
    chargeId = charge?.id ?? null;
    const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
    if (bt && typeof bt === "object") fee = bt.fee;
  }
  return { gross, fee, chargeId };
}
