import Stripe from "stripe";
import { runtimeEnv } from "./runtime-env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Only an authenticated admin calls this. Amounts and durable operation keys come from locked DB records. */
export async function reconcilePendingTrainerTransfers() {
  const secret = runtimeEnv("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("Stripe not configured");
  const stripe = new Stripe(secret);
  const restored = await supabaseAdmin.rpc("restore_won_disputes", {});
  if (restored.error) throw restored.error;
  const result = await supabaseAdmin
    .from("trainer_earnings")
    .select("id,trainer_slug,transfer_id")
    .in("status", ["pending", "transferring", "reversal_due"])
    .order("created_at")
    .limit(100);
  if (result.error) throw result.error;
  let paid = 0,
    reversed = 0,
    waiting = 0;
  for (const candidate of result.data ?? []) {
    const account = await supabaseAdmin
      .from("trainer_accounts")
      .select("stripe_account_id,payouts_enabled")
      .eq("user_id", candidate.trainer_slug)
      .maybeSingle();
    if (
      !candidate.transfer_id &&
      (!account.data?.stripe_account_id || !account.data.payouts_enabled)
    ) {
      waiting++;
      continue;
    }
    const claim = await supabaseAdmin.rpc("claim_earning_operation", {
      p_id: candidate.id,
    });
    if (claim.error) throw claim.error;
    const row = claim.data?.[0];
    if (!row?.operation_key || !row.operation_amount) {
      waiting++;
      continue;
    }
    let confirmation: string;
    if (row.operation_kind === "reversal" && row.transfer_id) {
      const reversal = await stripe.transfers.createReversal(
        row.transfer_id,
        { amount: row.operation_amount },
        { idempotencyKey: row.operation_key },
      );
      confirmation = reversal.id;
      reversed++;
    } else {
      const transfer = await stripe.transfers.create(
        {
          amount: row.operation_amount,
          currency: "usd",
          destination: account.data!.stripe_account_id!,
          metadata: { earning_id: row.id },
        },
        { idempotencyKey: row.operation_key },
      );
      confirmation = transfer.id;
      paid++;
    }
    const saved = await supabaseAdmin.rpc("finish_earning_operation", {
      p_id: row.id,
      p_key: row.operation_key,
      p_provider_id: confirmation,
    });
    if (saved.error) throw saved.error;
  }
  return { paid, reversed, waiting };
}
