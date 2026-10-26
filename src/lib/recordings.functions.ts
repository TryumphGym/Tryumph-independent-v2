import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runtimeEnv } from "@/lib/runtime-env.server";
import { z } from "zod";

/** Only the verified class trainer can start the recording. */
export const startClassRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("live_sessions")
      .select("id,trainer_id,starts_at,status,recording_enabled")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (
      error ||
      !session ||
      !session.recording_enabled ||
      !["scheduled", "live"].includes(session.status) ||
      session.trainer_id !== context.userId
    )
      throw new Error("Only the class trainer may record.");
    const start = new Date(session.starts_at).getTime();
    if (Date.now() < start - 20 * 60000 || Date.now() > start + 4 * 3600000)
      throw new Error("Outside the scheduled recording window");
    const eligibility = await supabaseAdmin.rpc("trainer_is_eligible", {
      p_user_id: context.userId,
      p_live: true,
    });
    if (eligibility.error || !eligibility.data)
      throw new Error("Trainer is no longer eligible");
    const { data: existing } = await supabaseAdmin
      .from("live_recordings")
      .select("egress_id")
      .eq("session_id", data.sessionId)
      .in("status", ["processing", "completed"])
      .limit(1)
      .maybeSingle();
    if (existing)
      return { egressId: existing.egress_id, alreadyRecording: true };
    const url = runtimeEnv("LIVEKIT_URL"),
      key = runtimeEnv("LIVEKIT_API_KEY"),
      secret = runtimeEnv("LIVEKIT_API_SECRET");
    const endpoint = runtimeEnv("R2_S3_ENDPOINT"),
      accessKey = runtimeEnv("R2_ACCESS_KEY_ID");
    const accessSecret = runtimeEnv("R2_SECRET_ACCESS_KEY"),
      bucket = runtimeEnv("R2_RECORDINGS_BUCKET");
    if (
      !url ||
      !key ||
      !secret ||
      !endpoint ||
      !accessKey ||
      !accessSecret ||
      !bucket
    )
      throw new Error(
        "LiveKit Egress / Cloudflare R2 recording is not configured",
      );
    const reservation = await supabaseAdmin.rpc("reserve_class_recording", {
      p_session_id: data.sessionId,
    });
    if (reservation.error) throw reservation.error;
    if (!reservation.data) return { egressId: null, alreadyRecording: true };
    const { EgressClient, EncodedFileOutput, S3Upload, EncodedFileType } =
      await import("livekit-server-sdk");
    const file = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `live-recordings/${data.sessionId}/recording.mp4`,
      output: {
        case: "s3",
        value: new S3Upload({
          accessKey,
          secret: accessSecret,
          bucket,
          region: "auto",
          endpoint,
          forcePathStyle: true,
        }),
      },
    });
    const egressClient = new EgressClient(
      url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"),
      key,
      secret,
    );
    const active = await egressClient.listEgress({
      roomName: `live-${data.sessionId}`,
      active: true,
    });
    const egress =
      active[0] ??
      (await egressClient.startRoomCompositeEgress(
        `live-${data.sessionId}`,
        file,
        { layout: "grid" },
      ));
    if (!egress.egressId)
      throw new Error("LiveKit failed to start the recording");
    const { error: saveError } = await supabaseAdmin
      .from("live_recordings")
      .upsert(
        {
          egress_id: egress.egressId,
          session_id: data.sessionId,
          trainer_id: context.userId,
          status: "processing",
          import_status: "pending",
          object_key: file.filepath,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "egress_id" },
      );
    if (saveError) throw new Error(saveError.message);
    return { egressId: egress.egressId, alreadyRecording: false };
  });

/** Retry an interrupted upload without republishing an unapproved recording. */
export const retryRecordingImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ egressId: z.string().min(1).max(150) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: recording } = await supabaseAdmin
      .from("live_recordings")
      .select("trainer_id")
      .eq("egress_id", data.egressId)
      .maybeSingle();
    if (!recording || recording.trainer_id !== context.userId)
      throw new Error("Not your recording");
    const { finishRecordedClass } = await import("@/lib/recordings.server");
    return finishRecordedClass(data.egressId);
  });
