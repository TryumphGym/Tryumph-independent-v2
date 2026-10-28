import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const schema = z.object({ id: z.string().uuid() });
export const getVideoUrl = createServerFn({ method: "GET" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("trainer_videos")
      .select("path")
      .eq("id", data.id)
      .eq("review_status", "approved")
      .maybeSingle();
    if (result.error || !result.data)
      throw new Error("Approved workout not found");
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
