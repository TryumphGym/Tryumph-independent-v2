import { runtimeEnv } from "./runtime-env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signVideoPath } from "./video-playback.server";

export function assertProgramMediaReady() {
  const library = runtimeEnv("BUNNY_PROGRAM_LIBRARY_ID");
  if (
    runtimeEnv("BUNNY_PROGRAM_MEDIA_VERIFIED") !== "true" ||
    !library ||
    library === runtimeEnv("BUNNY_STREAM_LIBRARY_ID") ||
    !runtimeEnv("BUNNY_PROGRAM_TOKEN_KEY")
  )
    throw new Error(
      "Protected program delivery is not configured and independently verified.",
    );
  return library;
}
export async function signProgramPath(
  path: string,
  scope: string,
  seconds = 900,
) {
  if (scope === "public") return signVideoPath(path, seconds);
  const library = assertProgramMediaReady(),
    match = /^bunny:(\d+):([a-f0-9-]{36})$/i.exec(path);
  if (!match || match[1] !== library)
    throw new Error("Protected video library mismatch");
  const expires = Math.floor(Date.now() / 1000) + seconds;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `${runtimeEnv("BUNNY_PROGRAM_TOKEN_KEY")}${match[2]}${expires}`,
    ),
  );
  const token = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `https://iframe.mediadelivery.net/embed/${library}/${match[2]}?token=${token}&expires=${expires}&autoplay=true`;
}
export async function programPlayback(
  userId: string,
  editionId: string,
  stepId: string,
  variationId?: string,
) {
  const access = await supabaseAdmin.rpc("program_media_access", {
    p_user: userId,
    p_edition: editionId,
    p_step: stepId,
    ...(variationId ? { p_variation: variationId } : {}),
  });
  if (access.error || !access.data?.[0])
    throw new Error("Program access denied or approved workout unavailable");
  const video = access.data[0];
  const seconds = video.access_expires_at
    ? Math.min(
        900,
        Math.floor(
          (new Date(video.access_expires_at).getTime() - Date.now()) / 1000,
        ),
      )
    : 900;
  if (seconds < 1) throw new Error("Program access expired");
  const metadata = await supabaseAdmin
    .from("trainer_videos")
    .select("id,title,minutes,breaks,break_seconds")
    .eq("id", video.id)
    .eq("review_status", "approved")
    .single();
  if (metadata.error) throw new Error("Approved workout unavailable");
  let imageUrl: string | null = null;
  if (video.image_path) {
    const image = await supabaseAdmin.storage
      .from("program-demonstrations")
      .createSignedUrl(video.image_path, Math.min(seconds, 300));
    if (image.error) throw new Error("Approved image unavailable");
    imageUrl = image.data.signedUrl;
  }
  const usage = await supabaseAdmin.rpc("start_program_usage", {
    p_user: userId,
    p_edition: editionId,
    p_step: stepId,
    ...(variationId ? { p_variation: variationId } : {}),
  });
  if (usage.error)
    throw new Error("Program playback authorization unavailable");
  return {
    imageUrl,
    usageId: usage.data,
    url:
      (await signProgramPath(video.path, video.access_scope, seconds)) +
      (variationId ? "&loop=true" : ""),
    expiresAt: Date.now() + seconds * 1000,
    video: {
      ...metadata.data,
      breaks: video.ads_allowed ? metadata.data.breaks : [],
    },
  };
}
