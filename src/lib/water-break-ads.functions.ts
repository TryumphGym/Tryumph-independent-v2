import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runtimeEnv } from "@/lib/runtime-env.server";

const requestSchema = z.object({
  videoId: z.string().uuid(),
  second: z.number().int().nonnegative(),
  playbackId: z.string().uuid(),
});
const receiptSchema = requestSchema.extend({
  campaignId: z.string().uuid(),
  timestamp: z.number().int(),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});
async function sign(data: string) {
  const secret = runtimeEnv("WATER_BREAK_EVENT_SIGNING_SECRET");
  if (!secret || secret.length < 32)
    throw new Error("Water-break impression verification is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return [
    ...new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
/** Deliver a vetted sponsor only at a verified break on an admin-approved video. */
export const getWaterBreakCreative = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => requestSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: video, error } = await supabaseAdmin
      .from("trainer_videos")
      .select("id,review_status,breaks")
      .eq("id", data.videoId)
      .maybeSingle();
    if (
      error ||
      !video ||
      video.review_status !== "approved" ||
      !Array.isArray(video.breaks) ||
      !video.breaks.some(
        (n: unknown) => typeof n === "number" && n === data.second,
      )
    )
      return null;
    const now = new Date().toISOString();
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("water_break_campaigns")
      .select("id,title,creative_url,destination_url,creative_type")
      .eq("active", true)
      .or(`start_at.is.null,start_at.lte.${now}`)
      .or(`end_at.is.null,end_at.gte.${now}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (campaignError || !campaign) return null;
    const timestamp = Date.now();
    const signature = await sign(
      `${campaign.id}:${data.videoId}:${data.second}:${data.playbackId}:${context.userId}:${timestamp}`,
    );
    return {
      ...campaign,
      videoId: data.videoId,
      second: data.second,
      timestamp,
      signature,
    };
  });

/** First-party impression measurements are not payments. Signed network invoices are required for earnings. */
export const recordWaterBreakImpression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => receiptSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (
      Date.now() - data.timestamp < 2000 ||
      Date.now() - data.timestamp > 120000
    )
      return { ok: false };
    const expected = await sign(
      `${data.campaignId}:${data.videoId}:${data.second}:${data.playbackId}:${context.userId}:${data.timestamp}`,
    );
    let diff = 0;
    for (let i = 0; i < 64; i++)
      diff |= expected.charCodeAt(i) ^ data.signature.charCodeAt(i);
    if (diff !== 0) return { ok: false };
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("record_water_break_impression", {
      p_campaign_id: data.campaignId,
      p_video_id: data.videoId,
      p_break_second: data.second,
      p_playback_id: data.playbackId,
      p_viewer_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
