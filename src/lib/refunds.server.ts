import Stripe from "stripe";
import { runtimeEnv } from "./runtime-env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
/** Persisted jobs + stable Stripe keys survive network/process failures. */
export async function processRefundJobs() {
  const key = runtimeEnv("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured; refund remains queued");
  const stripe = new Stripe(key);
  const jobs = await supabaseAdmin
    .from("refund_jobs")
    .select("checkout_id,target_cents")
    .is("completed_at", null)
    .limit(100);
  if (jobs.error) throw jobs.error;
  let completed = 0;
  for (const job of jobs.data ?? []) {
    const session = await stripe.checkout.sessions.retrieve(job.checkout_id);
    const intent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!intent || session.payment_status !== "paid") continue;
    const intentRecord = await stripe.paymentIntents.retrieve(intent, {
      expand: ["latest_charge"],
    });
    const charge = intentRecord.latest_charge;
    if (!charge || typeof charge === "string")
      throw new Error("Charge not available for refund");
    const target = job.target_cents ?? session.amount_total ?? 0;
    const delta = Math.max(0, target - charge.amount_refunded);
    let providerId = charge.id;
    if (delta > 0) {
      const refund = await stripe.refunds.create(
        { payment_intent: intent, amount: delta },
        { idempotencyKey: `refund-job:${session.id}:${target}` },
      );
      const confirmed = await stripe.refunds.retrieve(refund.id);
      if (confirmed.status !== "succeeded") continue;
      providerId = confirmed.id;
    }
    const saved = await supabaseAdmin.rpc("apply_checkout_refund", {
      p_checkout_id: session.id,
      p_refund_cents: target,
      p_fully_refunded: target === (session.amount_total ?? 0),
    });
    if (saved.error) throw saved.error;
    const done = await supabaseAdmin
      .from("refund_jobs")
      .update({
        completed_at: new Date().toISOString(),
        provider_id: providerId,
      })
      .eq("checkout_id", session.id);
    if (done.error) throw done.error;
    completed++;
  }
  return { completed };
}
