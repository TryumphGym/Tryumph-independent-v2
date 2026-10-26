/** Server-only live room authorization. Do not issue tokens for arbitrary room names. */
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export async function authorizeLiveRoom(userId: string, room: string) {
  const match = /^live-([0-9a-f]{8}-[0-9a-f-]{27,})$/i.exec(room);
  if (!match) throw new Error('Invalid live room');
  const { data: session, error } = await supabaseAdmin.from('live_sessions')
    .select('id,trainer_id,starts_at').eq('id', match[1]).single();
  if (error || !session) throw new Error('Class not found');
  const now = Date.now();
  const start = new Date(session.starts_at).getTime();
  if (!Number.isFinite(start) || now < start - 20 * 60_000 || now > start + 4 * 60 * 60_000) {
    throw new Error('Class room is outside its access window');
  }
  if (session.trainer_id === userId) return { isHost: true };
  const { data: booking, error: bookingError } = await supabaseAdmin.from('live_room_access')
    .select('id').eq('session_id', session.id).eq('user_id', userId).eq('status', 'paid').maybeSingle();
  if (bookingError || !booking) throw new Error('A paid booking is required to join this class');
  return { isHost: false };
}
