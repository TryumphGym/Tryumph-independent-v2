/** Server-only advertising accounting. Never accept a client-supplied revenue amount. */
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { split } from '@/lib/payouts.server';

export type AdSettlement = {
  network: string; networkEventId: string; trainerId: string; videoId: string;
  breakSecond: number; grossCents: number; feeCents: number;
};

/** Only call after validating a signed, server-to-server network settlement. */
export async function settleVerifiedAd(event: AdSettlement) {
  if (!event.network || !event.networkEventId || !event.trainerId || !event.videoId ||
      !Number.isInteger(event.breakSecond) || event.breakSecond < 0 ||
      !Number.isSafeInteger(event.grossCents) || event.grossCents < 0 ||
      !Number.isSafeInteger(event.feeCents) || event.feeCents < 0 || event.feeCents > event.grossCents) {
    throw new Error('Invalid advertising settlement');
  }
  const { data: video, error: videoError } = await supabaseAdmin.from('trainer_videos')
    .select('id,user_id,review_status').eq('id', event.videoId).single();
  if (videoError || !video || video.review_status !== 'approved' || video.user_id !== event.trainerId) {
    throw new Error('Video is not eligible for advertising settlement');
  }
  const reference = `ad:${event.network}:${event.networkEventId}`;
  const payout = split(event.grossCents, event.feeCents, 'ads');
  const { error } = await supabaseAdmin.from('trainer_earnings').upsert({
    trainer_slug: event.trainerId, source: 'ads', ref: reference,
    gross_cents: event.grossCents, fee_cents: event.feeCents,
    net_cents: payout.net, share_pct: payout.pct, payout_cents: payout.payout,
    status: 'pending',
  }, { onConflict: 'ref', ignoreDuplicates: true });
  if (error) throw error;
  return { reference, trainerCents: payout.payout };
}
