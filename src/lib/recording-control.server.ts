import { runtimeEnv } from "./runtime-env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
export async function stopRecordedClass(sessionId: string, userId: string) {
  const session = await supabaseAdmin
    .from("live_sessions")
    .select("trainer_id")
    .eq("id", sessionId)
    .single();
  if (session.error || session.data.trainer_id !== userId)
    throw new Error("Only the class owner can stop recording");
  const url = runtimeEnv("LIVEKIT_URL"),
    key = runtimeEnv("LIVEKIT_API_KEY"),
    secret = runtimeEnv("LIVEKIT_API_SECRET");
  if (!url || !key || !secret)
    throw new Error("LiveKit not configured; shutdown remains queued");
  const { EgressClient, RoomServiceClient } =
    await import("livekit-server-sdk");
  const base = url.replace(/^wss:/, "https:");
  const client = new EgressClient(base, key, secret);
  const recordings = await client.listEgress({
    roomName: `live-${sessionId}`,
    active: true,
  });
  for (const recording of recordings)
    await client.stopEgress(recording.egressId);
  // Room deletion is performed server-side, never via an attendee token.
  try {
    await new RoomServiceClient(base, key, secret).deleteRoom(
      `live-${sessionId}`,
    );
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.toLowerCase().includes("not found")
    )
      throw error;
  }
}
