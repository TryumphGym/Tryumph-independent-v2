import { AccessToken, TrackSource } from "livekit-server-sdk";
import { authorizeLiveRoom } from "./live-access.server";
import { runtimeEnv } from "./runtime-env.server";
export async function issueLiveRoomToken(
  userId: string,
  room: string,
  name: string,
) {
  const { isHost, isPrivate } = await authorizeLiveRoom(userId, room);
  const key = runtimeEnv("LIVEKIT_API_KEY"),
    secret = runtimeEnv("LIVEKIT_API_SECRET"),
    url = runtimeEnv("LIVEKIT_URL");
  if (!key || !secret || !url) throw new Error("LiveKit is not configured");
  const token = new AccessToken(key, secret, {
    identity: userId,
    name: name.slice(0, 80) || "Member",
    ttl: "15m",
  });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: isHost || isPrivate,
    canSubscribe: true,
    canPublishData: isHost || isPrivate,
    roomAdmin: isHost,
    roomRecord: false,
    ...(isPrivate && !isHost
      ? { canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE] }
      : {}),
  });
  return { token: await token.toJwt(), url, isHost, isPrivate };
}
