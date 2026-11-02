import type Stripe from "stripe";
/** Shared Connect execution for program and recurring-invoice ledgers. Claims/targets stay transactional in SQL. */
export async function executeConnectOperation(
  stripe: Stripe,
  op: {
    kind: string;
    amount: number;
    transfer_id: string | null;
    destination: string;
    idempotencyKey: string;
    group: string;
    metadata?: Record<string, string>;
  },
) {
  if (op.kind === "reversal") {
    if (!op.transfer_id) throw new Error("Missing original transfer");
    const r = await stripe.transfers.createReversal(
      op.transfer_id,
      { amount: op.amount },
      { idempotencyKey: op.idempotencyKey },
    );
    if (r.amount !== op.amount)
      throw new Error("Reversal confirmation mismatch");
    return r.id;
  }
  if (
    op.kind !== "transfer" ||
    !Number.isSafeInteger(op.amount) ||
    op.amount <= 0
  )
    throw new Error("Invalid payout operation");
  const a = await stripe.accounts.retrieve(op.destination);
  if (a.deleted || !a.payouts_enabled || a.capabilities?.transfers !== "active")
    throw new Error("Payout account unavailable");
  const t = await stripe.transfers.create(
    {
      amount: op.amount,
      currency: "usd",
      destination: op.destination,
      transfer_group: op.group,
      ...(op.metadata ? { metadata: op.metadata } : {}),
    },
    { idempotencyKey: op.idempotencyKey },
  );
  if (t.amount !== op.amount) throw new Error("Transfer confirmation mismatch");
  return t.id;
}
