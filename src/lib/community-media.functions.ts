import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const id = z.string().uuid();
export const communityPhotoAvailability = createServerFn({
  method: "GET",
}).handler(async () => {
  const { communityPhotosReady } = await import("./community-photos.server");
  if (!communityPhotosReady()) return false;
  const { supabaseAdmin } =
    await import("@/integrations/supabase/client.server");
  const r = await supabaseAdmin
    .from("community_media_config")
    .select("enabled")
    .eq("singleton", true)
    .single();
  return !r.error && r.data.enabled;
});
export const prepareCommunityPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        postId: id,
        alt: z.string().trim().min(1).max(300),
        ext: z.enum(["jpg", "png", "webp"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { communityPhotosReady } = await import("./community-photos.server");
    if (!communityPhotosReady())
      throw new Error("Photo processing and moderation await verification");
    const r = await context.supabase.rpc("begin_post_photo", {
      p_post: data.postId,
      p_alt: data.alt,
      p_ext: data.ext,
    });
    if (r.error) throw new Error(r.error.message);
    const photo = r.data?.[0];
    if (!photo) throw new Error("Photo upload intent unavailable");
    return { id: photo.id, path: photo.original_path };
  });
export const finishCommunityPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const { processCommunityPhoto } = await import("./community-photos.server");
    return processCommunityPhoto(context.userId, data.id);
  });
export const getCommunityPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id, review: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const access = await supabaseAdmin.rpc("post_photo_access", {
      p_user: context.userId,
      p_photo: data.id,
      p_review: data.review,
    });
    const a = access.data?.[0];
    if (access.error || !a) throw new Error("Image access denied");
    const seconds = a.deadline
      ? Math.min(90, Math.floor((Date.parse(a.deadline) - Date.now()) / 1000))
      : 90;
    if (seconds < 1) throw new Error("Photo access expired");
    const [main, thumb] = await Promise.all([
      supabaseAdmin.storage
        .from("community-photos")
        .createSignedUrl(a.path, seconds),
      supabaseAdmin.storage
        .from("community-photos")
        .createSignedUrl(a.thumbnail, seconds),
    ]);
    if (main.error || thumb.error) throw new Error("Image unavailable");
    return {
      url: main.data.signedUrl,
      thumbnail: thumb.data.signedUrl,
      alt: a.alt,
    };
  });
export const getCommunityPhotoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("Administrators only");
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin
      .from("post_photos")
      .select("id,post_id,user_id,alt,status,specialist_cleared,created_at")
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (r.error) throw new Error("Image review report unavailable");
    return r.data;
  });
export const getPublicCommunityPhoto = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.rpc("public_post_photo_access", {
      p_photo: data.id,
    });
    const a = r.data?.[0];
    if (r.error || !a) throw new Error("Public image unavailable");
    const seconds = a.deadline
      ? Math.min(90, Math.floor((Date.parse(a.deadline) - Date.now()) / 1000))
      : 90;
    if (seconds < 1) throw new Error("Photo access expired");
    const [main, thumb] = await Promise.all([
      supabaseAdmin.storage
        .from("community-photos")
        .createSignedUrl(a.path, seconds),
      supabaseAdmin.storage
        .from("community-photos")
        .createSignedUrl(a.thumbnail, seconds),
    ]);
    if (main.error || thumb.error) throw new Error("Image unavailable");
    return {
      url: main.data.signedUrl,
      thumbnail: thumb.data.signedUrl,
      alt: a.alt,
    };
  });
