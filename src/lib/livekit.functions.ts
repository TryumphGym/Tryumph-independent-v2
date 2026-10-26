import { runtimeEnv } from './runtime-env.server';
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getLiveKitToken = createServerFn({ method: 'POST' })
  .inputValidator((d: { room: string; name: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { authorizeLiveRoom } = await import('@/lib/live-access.server');
    const { isHost } = await authorizeLiveRoom(context.userId, data.room);
    const apiKey = runtimeEnv('LIVEKIT_API_KEY');
    const apiSecret = runtimeEnv('LIVEKIT_API_SECRET');
    const url = runtimeEnv('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !url) throw new Error('Live streaming is not configured');
    const { AccessToken } = await import('livekit-server-sdk');
    const token = new AccessToken(apiKey, apiSecret, {
      identity: context.userId, name: data.name?.slice(0, 80) || 'Member', ttl: '2h',
    });
    token.addGrant({ room: data.room, roomJoin: true, canPublish: true, canSubscribe: true,
      roomAdmin: isHost, roomRecord: false });
    return { token: await token.toJwt(), url };
  });
