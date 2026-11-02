import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { runtimeEnv, runtimeBinding } from "./runtime-env.server";
import { inspectCommunityImage, stripWebpMetadata } from "./community-images";
interface ImagesBinding {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width: number; height: number; fit: "scale-down" }): {
      output(options: {
        format: "image/webp";
        quality: number;
      }): Promise<{ response(): Response }>;
    };
  };
}
export function communityPhotosReady() {
  return (
    runtimeEnv("COMMUNITY_PHOTOS_VERIFIED") === "true" &&
    !!runtimeBinding<ImagesBinding>("COMMUNITY_IMAGES") &&
    !!runtimeEnv("COMMUNITY_MODERATION_URL") &&
    !!runtimeEnv("COMMUNITY_MODERATION_KEY")
  );
}
export async function processCommunityPhoto(user: string, id: string) {
  if (!communityPhotosReady())
    throw new Error(
      "Photo processing and specialist moderation have not been verified",
    );
  const r = await db.rpc("claim_post_photo_processing", {
    p_user: user,
    p_photo: id,
  });
  const a = r.data?.[0];
  if (r.error || !a)
    throw new Error(
      "Photo is held, already reviewed, or processing. Wait a minute before retrying. Five attempts per photo are allowed.",
    );
  const p = await db
    .from("posts")
    .select("text,media_revision")
    .eq("id", a.post_id)
    .single();
  if (p.error) throw new Error("Post unavailable");
  const original = await db.storage
    .from("community-photo-uploads")
    .download(a.original_path);
  if (original.error) throw new Error("Upload unavailable");
  const bytes = new Uint8Array(await original.data.arrayBuffer());
  inspectCommunityImage(bytes);
  const limits = await db
    .from("community_media_config")
    .select("max_bytes")
    .eq("singleton", true)
    .single();
  if (limits.error || bytes.length > limits.data.max_bytes)
    throw new Error("Image exceeds the configured upload limit");
  const images = runtimeBinding<ImagesBinding>("COMMUNITY_IMAGES")!;
  const encode = async (size: number) => {
    const output = await images
      .input(new Blob([bytes as BlobPart]).stream())
      .transform({ width: size, height: size, fit: "scale-down" })
      .output({ format: "image/webp", quality: 80 });
    const b = stripWebpMetadata(
      new Uint8Array(await output.response().arrayBuffer()),
    );
    const dimensions = inspectCommunityImage(b);
    if (dimensions.width > size || dimensions.height > size)
      throw new Error("Image transform limits not respected");
    return b;
  };
  const display = await encode(1600),
    thumb = await encode(480);
  const url = new URL(runtimeEnv("COMMUNITY_MODERATION_URL")!);
  if (url.protocol !== "https:") throw new Error("Moderation requires HTTPS");
  // Contract deliberately requires specialist clearance. A generic nudity classifier is insufficient.
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${runtimeEnv("COMMUNITY_MODERATION_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: 1,
      requestId: `${id}:${p.data.media_revision}`,
      imageBase64: Buffer.from(display).toString("base64"),
      originalImageBase64: Buffer.from(bytes).toString("base64"),
      text: p.data.text,
      context: "fitness-pregnancy-postpartum-body-recovery-inclusive",
      requireSpecialistIllegalContentScreen: true,
    }),
  });
  if (!response.ok)
    throw new Error("Moderation unavailable; photo remains unpublished");
  const decision = (await response.json()) as {
    decision?: string;
    specialistCleared?: boolean;
  };
  let status: "approved" | "review" | "rejected" | "specialist";
  if (decision.decision === "specialist") status = "specialist";
  else if (!decision.specialistCleared)
    throw new Error(
      "Specialist safety assessment unavailable; photo remains unpublished",
    );
  else if (["approved", "review", "rejected"].includes(decision.decision ?? ""))
    status = decision.decision as typeof status;
  else
    throw new Error(
      "Unrecognized moderation response; photo remains unpublished",
    );
  let displayPath = "",
    thumbPath = "";
  if (status === "approved" || status === "review") {
    const prefix = `${user}/${id}/${p.data.media_revision}-${crypto.randomUUID()}`;
    displayPath = prefix + ".webp";
    thumbPath = prefix + "-thumb.webp";
    for (const [path, body] of [
      [displayPath, display],
      [thumbPath, thumb],
    ] as const) {
      const upload = await db.storage
        .from("community-photos")
        .upload(path, body, { contentType: "image/webp", upsert: false });
      if (upload.error)
        throw new Error("Private image processing could not finish");
    }
  }
  const saved = await db.rpc("review_post_photo", {
    p_photo: id,
    p_status: status,
    p_revision: p.data.media_revision,
    p_display: displayPath,
    p_thumb: thumbPath,
    p_specialist: decision.specialistCleared === true,
  });
  if (saved.error)
    throw new Error("Post changed during moderation; retry review");
  // Originals and specialist holds require a reviewed retention/legal procedure; never expose them in UI/logs.
  return { status };
}
