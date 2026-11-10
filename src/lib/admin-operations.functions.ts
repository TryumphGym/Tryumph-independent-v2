import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const getOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (admin.error || !admin.data) throw new Error("Admins only");
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const [earnings, refunds, disputes, balances, shutdowns] =
      await Promise.all([
        supabaseAdmin
          .from("trainer_earnings")
          .select(
            "id,source,gross_cents,fee_cents,payout_cents,status,reversal_target_cents,transfer_reversed_cents",
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("refund_jobs")
          .select(
            "checkout_id,reason,requested_at,completed_at,last_error,attempts",
          )
          .order("requested_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("payment_disputes")
          .select("id,status,reconciled,created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("private_balance_operations")
          .select("booking_id,status,created_at,lease_until,last_error")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("private_room_shutdown_jobs")
          .select("booking_id,completed_at,last_error")
          .is("completed_at", null)
          .limit(100),
      ]);
    for (const result of [earnings, refunds, disputes, balances, shutdowns])
      if (result.error) throw new Error("Unable to read operational records");
    return {
      earnings: earnings.data ?? [],
      refunds: refunds.data ?? [],
      disputes: disputes.data ?? [],
      balances: balances.data ?? [],
      shutdowns: shutdowns.data ?? [],
    };
  });
