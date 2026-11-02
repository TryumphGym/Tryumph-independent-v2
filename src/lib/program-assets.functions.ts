import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const registerProgramAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        path: z.string().min(38).max(300),
        title: z.string().trim().min(1).max(160),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    if (data.path.split("/")[0] !== context.userId)
      throw new Error("Not your folder");
    const file = await supabaseAdmin.storage
      .from("program-downloads")
      .download(data.path);
    if (file.error || file.data.size > 10485760)
      throw new Error("PDF unavailable or oversized");
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const sample = new TextDecoder("latin1").decode(bytes);
    if (
      !sample.startsWith("%PDF-") ||
      /\/(JavaScript|JS\b|Launch|EmbeddedFile)/i.test(sample)
    )
      throw new Error(
        "Use a plain PDF without scripts, launch actions or embedded files",
      );
    const r = await context.supabase.rpc("register_program_asset", {
      p_path: data.path,
      p_title: data.title,
    });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const reviewProgramAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runtimeEnv } = await import("./runtime-env.server");
    if (
      data.status === "approved" &&
      runtimeEnv("PROGRAM_DOWNLOADS_VERIFIED") !== "true"
    )
      throw new Error(
        "Verify the private PDF security and malware-review workflow before approving downloads",
      );
    const r = await context.supabase.rpc("review_program_asset", {
      p_id: data.id,
      p_status: data.status,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const getProgramDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ editionId: z.string().uuid(), assetId: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runtimeEnv } = await import("./runtime-env.server");
    if (runtimeEnv("PROGRAM_DOWNLOADS_VERIFIED") !== "true")
      throw new Error("Protected PDF delivery awaits verified setup");
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const access = await supabaseAdmin.rpc("program_asset_access", {
      p_user: context.userId,
      p_edition: data.editionId,
      p_asset: data.assetId,
    });
    if (access.error || !access.data[0])
      throw new Error("Purchased file access denied");
    const a = access.data[0],
      seconds = a.deadline
        ? Math.min(
            120,
            Math.floor((Date.parse(a.deadline) - Date.now()) / 1000),
          )
        : 120;
    if (seconds < 1) throw new Error("Access expired");
    const r = await supabaseAdmin.storage
      .from("program-downloads")
      .createSignedUrl(a.path, seconds, { download: true });
    if (r.error) throw new Error("Download unavailable");
    return r.data.signedUrl;
  });
export const previewProgramAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase
      .from("program_assets")
      .select("path")
      .eq("id", data.id)
      .single();
    if (r.error) throw new Error("Not your review asset");
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage
      .from("program-downloads")
      .createSignedUrl(r.data.path, 120, { download: true });
    if (signed.error) throw signed.error;
    return signed.data.signedUrl;
  });
