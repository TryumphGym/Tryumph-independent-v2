import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasVerifiedCpr, isCurrentVerified } from "@/lib/cpr";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const schema = z.object({ id: z.string().uuid() });
export const getVideoUrl = createServerFn({ method: "GET" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("trainer_videos")
      .select("path,user_id")
      .eq("id", data.id)
      .eq("review_status", "approved")
      .maybeSingle();
    if (result.error || !result.data)
      throw new Error("Approved workout not found");
    // An approved video is not public until its owner meets the verified trainer rules.
    const [profile, certifications] = await Promise.all([
      supabaseAdmin.from("profiles").select("role").eq("id", result.data.user_id).maybeSingle(),
      supabaseAdmin.from("certifications")
        .select("name,status,expires,verified_at,verified_by")
        .eq("user_id", result.data.user_id),
    ]);
    if (profile.error || profile.data?.role !== "trainer" || certifications.error ||
        !hasVerifiedCpr((certifications.data ?? []).filter(isCurrentVerified)))
      throw new Error("Workout is not available from a verified trainer");
    const { signVideoPath } = await import("./video-playback.server");
    return signVideoPath(result.data.path);
  });
export const getPrivateVideoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("trainer_videos")
      .select("path,user_id")
      .eq("id", data.id)
      .single();
    if (result.error) throw new Error("Workout not found");
    if (result.data.user_id !== context.userId) {
      const admin = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (admin.error || !admin.data)
        throw new Error("Not your private workout");
    }
    const { signVideoPath } = await import("./video-playback.server");
    return signVideoPath(result.data.path, 300);
  });
