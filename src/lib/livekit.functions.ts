import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Mints a short-lived LiveKit access token for a signed-in member joining a room.
export const getLiveKitToken = createServerFn({ method: "POST" })
  .inputValidator((d: { room: string; name: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LIVEKIT_API_KEY"];
    const apiSecret = process.env["LIVEKIT_API_SECRET"];
    const url = process.env["LIVEKIT_URL"];
    if (!apiKey || !apiSecret || !url) throw new Error("Live streaming is not configured yet.");
    const { AccessToken } = await import("livekit-server-sdk");
    const at = new AccessToken(apiKey, apiSecret, {
      identity: context.userId,
      name: data.name || "Member",
      ttl: "2h",
    });
    at.addGrant({
      room: data.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    return { token: await at.toJwt(), url };
  });
