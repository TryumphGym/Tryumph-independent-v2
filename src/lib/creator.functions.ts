import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const uuid = z.string().uuid();
export const saveCreatorOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().max(3000),
        priceCents: z.number().int().min(50).max(1000000),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.enabled) {
      const { checkCreatorConnect } = await import("./creator-payments.server");
      await checkCreatorConnect(context.userId);
    }
    const r = await context.supabase.rpc("save_creator_offer", {
      p_title: data.title,
      p_description: data.description,
      p_price: data.priceCents,
      p_enabled: data.enabled,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const getCreatorDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await context.supabase.rpc("creator_dashboard");
    if (r.error) throw new Error(r.error.message);
    return r.data as unknown as import("./creators").CreatorDashboard;
  });
export const subscribeToCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ trainerId: uuid, consent: z.literal("monthly-auto-renew-v1") })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createCreatorCheckout } = await import("./creator-payments.server");
    return createCreatorCheckout(context.userId, data.trainerId);
  });
export const cancelCreatorSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { cancelCreatorMembership } =
      await import("./creator-payments.server");
    return cancelCreatorMembership(context.userId, data.orderId);
  });
export const creatorPaymentPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { creatorBillingPortal } = await import("./creator-payments.server");
    return creatorBillingPortal(context.userId);
  });
export const creatorCheckoutEnabled = createServerFn({ method: "GET" }).handler(
  async () => {
    const { runtimeEnv } = await import("./runtime-env.server");
    if (runtimeEnv("CREATOR_MEMBERSHIPS_ENABLED") !== "true") return false;
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin
      .from("creator_commerce")
      .select("enabled")
      .eq("singleton", true)
      .single();
    return !r.error && r.data.enabled;
  },
);
export const publishCreatorPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        text: z.string().trim().min(1).max(2000),
        audience: z.enum(["public", "subscribers", "both"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("save_creator_post", {
      p_text: data.text,
      p_audience: data.audience,
    });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const setCreatorVideoAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        videoId: uuid,
        audience: z.enum(["public", "subscribers", "early"]),
        publicAt: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("set_creator_video_audience", {
      p_video: data.videoId,
      p_audience: data.audience,
      ...(data.publicAt ? { p_public_at: data.publicAt } : {}),
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const getCreatorVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const a = await supabaseAdmin.rpc("creator_video_token", {
      p_user: context.userId,
      p_video: data.videoId,
    });
    if (a.error || !a.data[0])
      throw new Error("Subscriber video access denied");
    const access = a.data[0],
      seconds = access.deadline
        ? Math.min(
            600,
            Math.floor((Date.parse(access.deadline) - Date.now()) / 1000),
          )
        : 600;
    if (seconds < 1) throw new Error("Access expired");
    const r = await supabaseAdmin
      .from("trainer_videos")
      .select("id,title,minutes,breaks,break_seconds")
      .eq("id", data.videoId)
      .eq("review_status", "approved")
      .single();
    if (r.error) throw r.error;
    const { signProgramPath } = await import("./program-media.server");
    return {
      url: await signProgramPath(access.path, "program", seconds),
      video: { ...r.data, breaks: access.is_public ? r.data.breaks : [] },
      expiresAt: Date.now() + seconds * 1000,
    };
  });
export const approveCreatorTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        commissionBps: z.literal(1000),
        termsVersion: z.string().trim().min(3).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runtimeEnv } = await import("./runtime-env.server");
    if (runtimeEnv("PROGRAM_TERMS_OWNER_ID") !== context.userId)
      throw new Error(
        "Only the configured owner can approve commercial settings",
      );
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.rpc("approve_creator_terms", {
      p_owner: context.userId,
      p_enabled: data.enabled,
      p_bps: data.commissionBps,
      p_terms: data.termsVersion,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const moderateCreatorOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        trainerId: uuid,
        blocked: z.boolean(),
        reason: z.string().trim().min(3).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("moderate_creator_offer", {
      p_trainer: data.trainerId,
      p_blocked: data.blocked,
      p_reason: data.reason,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const requestCreatorRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ receiptId: uuid, reason: z.string().trim().min(3).max(1000) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("request_creator_refund", {
      p_receipt: data.receiptId,
      p_reason: data.reason,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const getCreatorAdminReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (r.error || !r.data) throw new Error("Admins only");
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const [offers, receipts, terms] = await Promise.all([
      supabaseAdmin
        .from("creator_offers")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("creator_receipts")
        .select(
          "id,trainer_id,invoice_id,price_cents,fee_cents,commission_bps,refunded_cents,refund_pending,paid_at",
        )
        .order("paid_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("creator_commerce")
        .select("enabled,commission_bps,terms_version")
        .eq("singleton", true)
        .single(),
    ]);
    if (offers.error || receipts.error || terms.error)
      throw new Error("Membership report unavailable");
    const { runtimeEnv } = await import("./runtime-env.server");
    return {
      offers: offers.data,
      receipts: receipts.data,
      terms: terms.data,
      ownerCanApprove: runtimeEnv("PROGRAM_TERMS_OWNER_ID") === context.userId,
    };
  });
