import { AccessToken, TrackSource } from "livekit-server-sdk";
import { authorizeLiveRoom } from "./live-access.server";
import { runtimeEnv } from "./runtime-env.server";
export async function issueLiveRoomToken(
  userId: string,
  room: string,
  name: string,
) {
  const { isHost, isPrivate, waiting, expiresAt } = await authorizeLiveRoom(
    userId,
    room,
  );
  const key = runtimeEnv("LIVEKIT_API_KEY"),
    secret = runtimeEnv("LIVEKIT_API_SECRET"),
    url = runtimeEnv("LIVEKIT_URL");
  if (!key || !secret || !url) throw new Error("LiveKit is not configured");
  const token = new AccessToken(key, secret, {
    identity: userId,
    name: name.slice(0, 80) || "Member",
    ttl: Math.max(
      1,
      Math.min(900, Math.floor((expiresAt - Date.now()) / 1000)),
    ),
  });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: !waiting && (isHost || isPrivate),
    canSubscribe: !waiting,
    canPublishData: !waiting && !isPrivate && isHost,
    roomAdmin: isHost && !isPrivate,
    roomRecord: false,
    ...(isPrivate
      ? { canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE] }
      : {}),
  });
  return { token: await token.toJwt(), url, isHost, isPrivate, waiting };
}
