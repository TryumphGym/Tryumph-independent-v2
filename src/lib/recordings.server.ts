import { runtimeEnv } from "@/lib/runtime-env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { env } from "cloudflare:workers";

/** R2 binding is defined in wrangler; raw recording never becomes a public URL. */
function recordingsBucket(): {
  get(key: string): Promise<{ body: ReadableStream<Uint8Array> } | null>;
} {
  const bucket = (env as unknown as Record<string, unknown>)["R2_RECORDINGS"];
  if (!bucket || typeof (bucket as { get?: unknown }).get !== "function")
    throw new Error("R2_RECORDINGS binding not configured");
  return bucket as ReturnType<typeof recordingsBucket>;
}

/** Stream the R2 recording to Bunny. Never expose the raw object or provider keys in the browser. */
export async function finishRecordedClass(egressId: string) {
  const { data: recording, error } = await supabaseAdmin
    .from("live_recordings")
    .select("*")
    .eq("egress_id", egressId)
    .maybeSingle();
  if (error || !recording) throw new Error("Unknown recording");
  if (recording.import_status === "ready" && recording.bunny_guid)
    return { videoId: recording.trainer_video_id };
  if (
    recording.status !== "completed" ||
    !recording.object_key ||
    !recording.object_key.startsWith(
      `live-recordings/${recording.session_id}/`,
    ) ||
    !recording.object_key.endsWith(".mp4") ||
    recording.object_key.includes("..")
  )
    throw new Error("Recording is not ready to import");
  const libraryId = runtimeEnv("BUNNY_STREAM_LIBRARY_ID");
  const apiKey = runtimeEnv("BUNNY_STREAM_API_KEY");
  if (!libraryId || !apiKey) throw new Error("Bunny Stream is not configured");
  const claim = await supabaseAdmin.rpc("claim_recording_import", {
    p_egress_id: egressId,
  });
  if (claim.error || !claim.data?.length)
    throw new Error("Import already running; retry after lease expiry");
  let guid: string | null = recording.bunny_guid;
  if (!guid) {
    const { data: session } = await supabaseAdmin
      .from("live_sessions")
      .select("title")
      .eq("id", recording.session_id)
      .single();
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: "POST",
        headers: { AccessKey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: session?.title ?? "Recorded Tryumph class",
        }),
      },
    );
    const result = (await response.json()) as { guid?: string };
    if (!response.ok || !result.guid)
      throw new Error("Failed to initialize Bunny import");
    guid = result.guid;
    const { error: saveError } = await supabaseAdmin
      .from("live_recordings")
      .update({
        bunny_guid: guid,
        import_status: "importing",
        updated_at: new Date().toISOString(),
      })
      .eq("egress_id", egressId);
    if (saveError) throw new Error(saveError.message);
  }
  const source = await recordingsBucket().get(recording.object_key);
  if (!source) throw new Error("R2 recording object not found");
  const uploaded = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`,
    {
      method: "PUT",
      headers: { AccessKey: apiKey, "Content-Type": "video/mp4" },
      body: source.body,
    },
  );
  if (!uploaded.ok)
    throw new Error(`Bunny video upload failed (${uploaded.status})`);
  // Review is mandatory; no recording is visible in On-Demand until the admin approves it.
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("live_sessions")
    .select("title,category,level,minutes")
    .eq("id", recording.session_id)
    .single();
  if (sessionError || !session) throw new Error("Original class not found");
  // Derive a stable UUID from the unique egress ID so webhook retries cannot create duplicates.
  const hash = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(recording.egress_id),
    ),
  );
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = [...hash.slice(0, 16)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const stableVideoId =
    recording.trainer_video_id ??
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const { error: videoError } = await supabaseAdmin
    .from("trainer_videos")
    .upsert(
      {
        id: stableVideoId,
        user_id: recording.trainer_id,
        title: `${session.title} (live recording)`,
        category: session.category,
        level: session.level,
        minutes: session.minutes,
        path: `bunny:${libraryId}:${guid}`,
        breaks: [],
        break_seconds: 0,
        review_status: "pending",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (videoError) throw videoError;
  const existing = await supabaseAdmin
    .from("trainer_videos")
    .select("id")
    .eq("id", stableVideoId)
    .single();
  const video = existing.data;
  if (existing.error || !video)
    throw new Error(
      existing.error?.message ?? "Unable to submit recording for approval",
    );
  const { error: markError } = await supabaseAdmin
    .from("live_recordings")
    .update({
      trainer_video_id: video.id,
      import_status: "ready",
      import_lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("egress_id", egressId);
  if (markError) throw new Error(markError.message);
  return { videoId: video.id };
}
