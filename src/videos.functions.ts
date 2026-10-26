import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Mints a short-lived link to one uploaded workout file.
// Anyone may ask (the on-demand page is open to guests), but only for a video that is
// actually listed in trainer_videos — the caller cannot request an arbitrary stored file.
export const getVideoUrl = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("trainer_videos").select("path").eq("id", data.id).eq("review_status", "approved").maybeSingle();
    if (!row?.path) throw new Error("Video not found");
    const { data: signed, error } = await supabaseAdmin.storage.from("videos").createSignedUrl(row.path, 60 * 60 * 3);
    if (error || !signed?.signedUrl) throw new Error("This video could not be opened");
    return signed.signedUrl;
  });
