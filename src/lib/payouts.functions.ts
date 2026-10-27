import { appOrigin } from "./app-origin.server";
import { runtimeEnv } from "./runtime-env.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function stripe() {
  const key = runtimeEnv("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured yet.");
  return new Stripe(key);
}

// Trainer: create (or reuse) their Stripe payout account and return the bank-linking page.
export const startPayoutOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = stripe();
    const origin = appOrigin();
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();
    if (prof?.role !== "trainer")
      throw new Error("Only trainers can set up payouts.");
    const { data: acct } = await supabaseAdmin
      .from("trainer_accounts")
      .select("stripe_account_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    let id = acct?.stripe_account_id ?? null;
    if (!id) {
      const email = (context.claims as { email?: string }).email;
      const a = await s.accounts.create(
        {
          type: "express",
          ...(email ? { email } : {}),
          capabilities: { transfers: { requested: true } },
          metadata: { user_id: context.userId },
        },
        { idempotencyKey: `connect:${context.userId}` },
      );
      id = a.id;
      const saved = await supabaseAdmin
        .from("trainer_accounts")
        .upsert({ user_id: context.userId, stripe_account_id: id });
      if (saved.error) throw saved.error;
    }
    const link = await s.accountLinks.create({
      account: id,
      type: "account_onboarding",
      refresh_url: `${origin}/studio?payouts=retry`,
      return_url: `${origin}/studio?payouts=done`,
    });
    return { url: link.url };
  });

// Trainer: refresh payout status and summarise earnings (all after fees).
export const getPayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: acct } = await supabaseAdmin
      .from("trainer_accounts")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    let enabled = acct?.payouts_enabled ?? false;
    if (acct?.stripe_account_id) {
      const a = await stripe().accounts.retrieve(acct.stripe_account_id);
      enabled = !!a.payouts_enabled;
      await supabaseAdmin
        .from("trainer_accounts")
        .update({ payouts_enabled: enabled })
        .eq("user_id", context.userId);
    }
    const slugs = [context.userId, acct?.slug].filter(Boolean) as string[];
    const { data: rows, error: earningsError } = await supabaseAdmin
      .from("trainer_earnings")
      .select(
        "source, gross_cents, fee_cents, payout_cents, reversal_target_cents, status, created_at",
      )
      .in("trainer_slug", slugs);
    if (earningsError) throw new Error("Unable to load verified earnings");
    const sum = (f: (r: NonNullable<typeof rows>[number]) => boolean) =>
      (rows ?? [])
        .filter(f)
        .reduce(
          (a, r) => a + Math.max(0, r.payout_cents - r.reversal_target_cents),
          0,
        );
    const monthAgo = Date.now() - 30 * 864e5;
    const recent = (rows ?? []).filter(
      (r) => new Date(r.created_at).getTime() >= monthAgo,
    );
    // Real follower count: members whose saved "followed" list includes this coach.
    let followers = 0;
    for (const sl of slugs) {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .contains("extra", { followed: [sl] });
      followers += count ?? 0;
    }
    const membership = await supabaseAdmin
      .from("trybe_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("trybe_id", `coach-${context.userId}`);
    const trybeMembers = membership.count ?? 0;
    const classCount = await supabaseAdmin
      .from("live_sessions")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", context.userId)
      .in("status", ["live", "ended"])
      .gte("starts_at", new Date(monthAgo).toISOString())
      .lte("starts_at", new Date().toISOString());
    const attendance = await supabaseAdmin.rpc("trainer_attendance_count", {
      p_trainer_id: context.userId,
    });
    if (membership.error || classCount.error || attendance.error)
      throw new Error("Unable to load verified trainer statistics");
    return {
      linked: !!acct?.stripe_account_id,
      enabled,
      pending: sum((r) => r.status === "pending"),
      paid: sum((r) => r.status === "paid"),
      bySource: {
        oneonone: sum((r) => r.source === "oneonone"),
        live: sum((r) => r.source === "live"),
        ads: sum((r) => r.source === "ads"),
      },
      fees: (rows ?? []).reduce((a, r) => a + r.fee_cents, 0),
      stats: {
        liveAttendanceMonth: attendance.data ?? 0,
        liveClassesMonth: classCount.count ?? 0,
        oneononeSessions: (rows ?? []).filter((r) => r.source === "oneonone")
          .length,
        followers,
        trybeMembers,
      },
    };
  });

// Earnings are created only by signed, server-side payment settlement.
// A browser request must never mint a trainer earning or initiate a transfer.
export const recordLiveAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ liveId: z.string() }).parse(d))
  .handler(async () => {
    throw new Error(
      "Live attendance is settled from verified payments, not the browser.",
    );
  });

// Payouts must be reconciled against immutable Stripe transfer IDs first.
// Disabled until the settlement migration and reconciliation workflow are installed.
export const payOutPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error || !admin) throw new Error("Admins only");
    const { reconcilePendingTrainerTransfers } =
      await import("@/lib/transfer-reconciliation.server");
    return reconcilePendingTrainerTransfers();
  });
