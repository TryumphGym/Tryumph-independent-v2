import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Owner-only, read-only operational overview. All privileged database reads
 * happen on the server. No private records, identities or email addresses are
 * returned to the browser.
 */
export const getFounderHQSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || role.data !== true)
      throw new Error("Founder-only access required");

    const { runtimeEnv } = await import("./runtime-env.server");
    const ownerId = runtimeEnv("PROGRAM_TERMS_OWNER_ID");
    if (!ownerId)
      throw new Error(
        "Tryumph HQ needs the PROGRAM_TERMS_OWNER_ID server binding before it can show private metrics.",
      );
    if (ownerId !== context.userId)
      throw new Error("Founder-only access required");

    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Exact, server-side aggregate counts. Never download a person's data.
    const queries = await Promise.all([
      supabaseAdmin
        .from("certifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("trainer_videos")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "pending"),
      supabaseAdmin
        .from("content_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabaseAdmin
        .from("moderation_appeals")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabaseAdmin
        .from("refund_jobs")
        .select("checkout_id", { count: "exact", head: true })
        .is("completed_at", null),
      supabaseAdmin
        .from("creator_refund_jobs")
        .select("receipt_id", { count: "exact", head: true })
        .is("completed_at", null),
      supabaseAdmin
        .from("contact_delivery_requests")
        .select("request_id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("waitlist_entries")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      supabaseAdmin
        .from("live_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "scheduled")
        .gte("starts_at", now.toISOString()),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("trainer_videos")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "approved"),
    ]);
    if (queries.some((result) => result.error || result.count === null))
      throw new Error("Tryumph HQ could not verify all operational counts");
    const counts = queries.map((result) => result.count as number);

    const settings = await Promise.all([
      supabaseAdmin
        .from("creator_commerce")
        .select("enabled")
        .eq("singleton", true)
        .single(),
      supabaseAdmin
        .from("program_commerce")
        .select("enabled")
        .eq("singleton", true)
        .single(),
      supabaseAdmin
        .from("community_media_config")
        .select("enabled")
        .eq("singleton", true)
        .single(),
      supabaseAdmin
        .from("community_ad_config")
        .select("enabled")
        .eq("singleton", true)
        .single(),
    ]);
    if (settings.some((result) => result.error || !result.data))
      throw new Error("Tryumph HQ could not verify feature settings");

    return {
      fetchedAt: now.toISOString(),
      pendingCredentials: counts[0]!,
      pendingVideos: counts[1]!,
      openReports: counts[2]!,
      openAppeals: counts[3]!,
      pendingRefunds: counts[4]! + counts[5]!,
      queuedContactRequests: counts[6]!,
      recentWaitlist: counts[7]!,
      upcomingLives: counts[8]!,
      registeredProfiles: counts[9]!,
      approvedVideos: counts[10]!,
      settings: {
        creatorMembershipsEnabled: settings[0]!.data!.enabled,
        nativeProgramPaymentsEnabled: settings[1]!.data!.enabled,
        communityPhotosEnabled: settings[2]!.data!.enabled,
        communityAdsEnabled: settings[3]!.data!.enabled,
      },
    };
  });
