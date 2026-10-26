import { runtimeEnv } from "./lib/runtime-env.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { liveClasses } from "./data";
import { split } from "./payouts.server";

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
    const origin = runtimeEnv("APP_ORIGIN") ?? "http://localhost:8080";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("role").eq("id", context.userId).single();
    if (prof?.role !== "trainer") throw new Error("Only trainers can set up payouts.");
    const { data: acct } = await supabaseAdmin.from("trainer_accounts").select("stripe_account_id").eq("user_id", context.userId).maybeSingle();
    let id = acct?.stripe_account_id ?? null;
    if (!id) {
      const email = (context.claims as { email?: string }).email;
      const a = await s.accounts.create({ type: "express", ...(email ? { email } : {}), capabilities: { transfers: { requested: true } } });
      id = a.id;
      await supabaseAdmin.from("trainer_accounts").upsert({ user_id: context.userId, stripe_account_id: id });
    }
    const link = await s.accountLinks.create({ account: id, type: "account_onboarding", refresh_url: `${origin}/studio?payouts=retry`, return_url: `${origin}/studio?payouts=done` });
    return { url: link.url };
  });

// Trainer: refresh payout status and summarise earnings (all after fees).
export const getPayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: acct } = await supabaseAdmin.from("trainer_accounts").select("*").eq("user_id", context.userId).maybeSingle();
    let enabled = acct?.payouts_enabled ?? false;
    if (acct?.stripe_account_id && !enabled) {
      const a = await stripe().accounts.retrieve(acct.stripe_account_id);
      enabled = !!a.payouts_enabled;
      if (enabled) await supabaseAdmin.from("trainer_accounts").update({ payouts_enabled: true }).eq("user_id", context.userId);
    }
    const slugs = [context.userId, acct?.slug].filter(Boolean) as string[];
    const { data: rows } = await supabaseAdmin.from("trainer_earnings").select("source, gross_cents, fee_cents, payout_cents, status, created_at").in("trainer_slug", slugs);
    const sum = (f: (r: NonNullable<typeof rows>[number]) => boolean) => (rows ?? []).filter(f).reduce((a, r) => a + r.payout_cents, 0);
    const monthAgo = Date.now() - 30 * 864e5;
    const recent = (rows ?? []).filter((r) => new Date(r.created_at).getTime() >= monthAgo);
    // Real follower count: members whose saved "followed" list includes this coach.
    let followers = 0;
    for (const sl of slugs) {
      const { count } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).contains("extra", { followed: [sl] });
      followers += count ?? 0;
    }
    const { data: trybePosts } = await supabaseAdmin.from("posts").select("author_id").eq("trybe", `coach-${context.userId}`);
    const trybeMembers = new Set((trybePosts ?? []).map((p) => p.author_id).filter((a) => a && a !== context.userId)).size;
    return {
      linked: !!acct?.stripe_account_id,
      enabled,
      pending: sum((r) => r.status === "pending"),
      paid: sum((r) => r.status === "paid"),
      bySource: { oneonone: sum((r) => r.source === "oneonone"), live: sum((r) => r.source === "live"), ads: sum((r) => r.source === "ads") },
      fees: (rows ?? []).reduce((a, r) => a + r.fee_cents, 0),
      stats: {
        liveAttendanceMonth: recent.filter((r) => r.source === "live").length,
        oneononeSessions: (rows ?? []).filter((r) => r.source === "oneonone").length,
        followers,
        trybeMembers,
      },
    };
  });

// Member: record the trainer's live-class share when a token is spent entering the room.
export const recordLiveAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ liveId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const live = liveClasses.find((l) => l.id === data.liveId);
    if (!live) throw new Error("Unknown class.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("ledger").eq("id", context.userId).single();
    const ledger = (prof?.ledger as { netPerToken?: number }[] | null) ?? [];
    const netPerToken = ledger.find((e) => typeof e.netPerToken === "number")?.netPerToken ?? 479;
    const fee = 500 - netPerToken;
    const sp = split(500, fee, "live");
    await supabaseAdmin.from("trainer_earnings").upsert(
      { trainer_slug: live.trainerId, source: "live", ref: `live-${context.userId}-${live.id}-${new Date().toISOString().slice(0, 10)}`, gross_cents: 500, fee_cents: fee, net_cents: sp.net, share_pct: sp.pct, payout_cents: sp.payout },
      { onConflict: "ref", ignoreDuplicates: true },
    );
    return { ok: true };
  });

// Admin: pay out every pending earning to trainers whose bank is linked.
export const payOutPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = stripe();
    const { data: accts } = await supabaseAdmin.from("trainer_accounts").select("*").eq("payouts_enabled", true);
    const { data: pend } = await supabaseAdmin.from("trainer_earnings").select("*").eq("status", "pending");
    let paid = 0, cents = 0, waiting = 0;
    for (const a of accts ?? []) {
      const mine = (pend ?? []).filter((e) => e.trainer_slug === a.user_id || e.trainer_slug === a.slug);
      const total = mine.reduce((x, e) => x + e.payout_cents, 0);
      if (!total || !a.stripe_account_id) continue;
      const tr = await s.transfers.create({ amount: total, currency: "usd", destination: a.stripe_account_id, description: "Tryumph earnings (after fees)" });
      await supabaseAdmin.from("trainer_earnings").update({ status: "paid", transfer_id: tr.id }).in("id", mine.map((e) => e.id));
      paid += 1; cents += total;
    }
    const { count } = await supabaseAdmin.from("trainer_earnings").select("id", { count: "exact", head: true }).eq("status", "pending");
    waiting = count ?? 0;
    return { trainers: paid, cents, waiting };
  });
