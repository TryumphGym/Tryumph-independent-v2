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
    .select("checkout_id,target_cents,attempts")
    .is("completed_at", null)
    .limit(100);
  if (jobs.error) throw jobs.error;
  let completed = 0,
    failed = 0;
  for (const job of jobs.data ?? []) {
    try {
      const session = job.checkout_id.startsWith("pi_")
        ? null
        : await stripe.checkout.sessions.retrieve(job.checkout_id);
      const intent = session
        ? typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id
        : job.checkout_id;
      if (!intent || (session && session.payment_status !== "paid")) continue;
      const intentRecord = await stripe.paymentIntents.retrieve(intent, {
        expand: ["latest_charge"],
      });
      const charge = intentRecord.latest_charge;
      if (!charge || typeof charge === "string")
        throw new Error("Charge not available for refund");
      const target = job.target_cents ?? intentRecord.amount_received;
      const delta = Math.max(0, target - charge.amount_refunded);
      let providerId = charge.id;
      if (delta > 0) {
        const refund = await stripe.refunds.create(
          { payment_intent: intent, amount: delta },
          { idempotencyKey: `refund-job:${job.checkout_id}:${target}` },
        );
        const confirmed = await stripe.refunds.retrieve(refund.id);
        if (confirmed.status !== "succeeded") continue;
        providerId = confirmed.id;
      }
      const saved = await supabaseAdmin.rpc("apply_checkout_refund", {
        p_checkout_id: job.checkout_id,
        p_refund_cents: target,
        p_fully_refunded: target === intentRecord.amount_received,
      });
      if (saved.error) throw saved.error;
      let doneQuery = supabaseAdmin
        .from("refund_jobs")
        .update({
          completed_at: new Date().toISOString(),
          provider_id: providerId,
          last_error: null,
          attempts: job.attempts + 1,
        })
        .eq("checkout_id", job.checkout_id);
      doneQuery =
        job.target_cents === null
          ? doneQuery.is("target_cents", null)
          : doneQuery.eq("target_cents", job.target_cents);
      const done = await doneQuery;
      if (done.error) throw done.error;
      completed++;
    } catch (error) {
      failed++;
      const saved = await supabaseAdmin
        .from("refund_jobs")
        .update({
          attempts: job.attempts + 1,
          last_error:
            "Refund not confirmed. Retained for retry; inspect provider event and server logs.",
        })
        .eq("checkout_id", job.checkout_id);
      if (saved.error) throw saved.error;
      console.error("Refund job retained for retry", job.checkout_id, error);
    }
  }
  return { completed, failed };
}
