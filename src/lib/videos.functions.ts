import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Mints a short-lived link to one uploaded workout file.
// Anyone may ask (the on-demand page is open to guests), but only for a video that is
// actually listed in trainer_videos — the caller cannot request an arbitrary stored file.
export const getVideoUrl = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase server settings missing");
    const publicDb = createClient(url, key);
    const { data: row, error: lookupError } = await publicDb.from("trainer_videos").select("path").eq("id", data.id).eq("review_status", "approved").maybeSingle();
    if (lookupError) throw new Error(`Video lookup failed: ${lookupError.message}`);
    if (!row?.path) throw new Error("Video not found");
    if (row.path.startsWith("bunny:")) {
      const match = /^bunny:(\d+):([a-f0-9-]{36})$/i.exec(row.path);
      if (!match) throw new Error("Invalid Bunny video reference");
      return `https://iframe.mediadelivery.net/embed/${match[1]}/${match[2]}`;
    }
    const { data: signed, error } = await publicDb.storage.from("videos").createSignedUrl(row.path, 60 * 60 * 3);
    if (error || !signed?.signedUrl) throw new Error("This video could not be opened");
    return signed.signedUrl;
  });
