import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runtimeEnv } from "./runtime-env.server";

export function roomService() {
  const url = runtimeEnv("LIVEKIT_URL"),
    key = runtimeEnv("LIVEKIT_API_KEY"),
    secret = runtimeEnv("LIVEKIT_API_SECRET");
  if (!url || !key || !secret) throw new Error("LiveKit is not configured");
  return new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
}

/** Called only after WebhookReceiver verifies the provider signature. Always re-read
 * current provider presence: replayed/out-of-order joined events cannot invent attendance. */
export async function handleVerifiedAttendance(room: string, identity: string) {
  const service = roomService();
  const participants = await service.listParticipants(room);
  if (!participants.some((p) => p.identity === identity)) return;
  const live = /^live-([0-9a-f-]{36})$/i.exec(room);
  if (live) {
    const session = await supabaseAdmin
      .from("live_sessions")
      .select("trainer_id,status")
      .eq("id", live[1]!)
      .single();
    if (session.error) throw session.error;
    if (session.data.trainer_id === identity) {
      const eligible = await supabaseAdmin.rpc("trainer_is_eligible", {
        p_user_id: identity,
        p_live: true,
      });
      if (eligible.error || !eligible.data) {
        await service.deleteRoom(room);
        return;
      }
      if (session.data.status === "scheduled") {
        const result = await supabaseAdmin
          .from("live_sessions")
          .update({ status: "live" })
          .eq("id", live[1]!)
          .eq("status", "scheduled");
        if (result.error) throw result.error;
      }
      return;
    }
    const paid = await supabaseAdmin.rpc("consume_attended_live_token", {
      p_user_id: identity,
      p_session_id: live[1]!,
    });
    if (paid.error) {
      await service.removeParticipant(room, identity);
      throw paid.error;
    }
    await service.updateParticipant(room, identity, {
      permission: {
        canSubscribe: true,
        canPublish: false,
        canPublishData: false,
      },
    });
    return;
  }
  if (/^oneonone-/.test(room)) {
    const { advancePrivateAttendance } =
      await import("./private-payments.server");
    await advancePrivateAttendance(
      room,
      participants.map((p) => p.identity),
      service,
    );
  }
}

export async function enablePrivateParticipants(
  room: string,
  member: string,
  trainer: string,
  service = roomService(),
) {
  const sources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
  for (const identity of [member, trainer])
    await service.updateParticipant(room, identity, {
      permission: {
        canSubscribe: true,
        canPublish: true,
        canPublishData: false,
        canPublishSources: sources,
      },
    });
}
