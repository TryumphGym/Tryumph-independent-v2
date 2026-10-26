/** Server-only settlement: a signed, trusted payment/network event must precede ledger credit. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { split } from "@/lib/payouts.server";

export type VerifiedAdEvent = {
  network: string;
  networkEventId: string;
  videoId: string;
  breakSecond: number;
  grossCents: number;
  feeCents: number;
};
export async function settleVerifiedAd(event: VerifiedAdEvent) {
  if (
    !/^[a-zA-Z0-9_-]{2,40}$/.test(event.network) ||
    !/^[a-zA-Z0-9._:-]{3,200}$/.test(event.networkEventId) ||
    !Number.isSafeInteger(event.breakSecond) ||
    event.breakSecond < 0 ||
    !Number.isSafeInteger(event.grossCents) ||
    event.grossCents < 0 ||
    !Number.isSafeInteger(event.feeCents) ||
    event.feeCents < 0 ||
    event.feeCents > event.grossCents
  ) {
    throw new Error("Invalid advertising settlement");
  }
  const { data: video, error: videoError } = await supabaseAdmin
    .from("trainer_videos")
    .select("id,user_id,review_status,breaks")
    .eq("id", event.videoId)
    .maybeSingle();
  if (
    videoError ||
    !video ||
    video.review_status !== "approved" ||
    !Array.isArray(video.breaks) ||
    !video.breaks.includes(event.breakSecond)
  ) {
    throw new Error(
      "Only approved videos with a marked water break can earn ad revenue",
    );
  }
  const payout = split(event.grossCents, event.feeCents, "ads");
  const { error } = await supabaseAdmin.rpc("apply_verified_ad_settlement", {
    p_network: event.network,
    p_network_event_id: event.networkEventId,
    p_video_id: event.videoId,
    p_trainer_id: video.user_id,
    p_break_second: event.breakSecond,
    p_gross_cents: event.grossCents,
    p_fee_cents: event.feeCents,
    p_trainer_cents: payout.payout,
  });
  if (error) throw new Error(error.message);
  return {
    reference: `ad:${event.network}:${event.networkEventId}`,
    trainerCents: payout.payout,
  };
}
