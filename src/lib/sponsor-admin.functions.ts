import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  creativeUrl: z.string().url().startsWith("https://"),
  destinationUrl: z.string().url().startsWith("https://"),
  creativeType: z.enum(["image", "video"]),
  active: z.boolean(),
});
async function requireAdmin(userId: string) {
  const { supabaseAdmin } =
    await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Admins only");
}
export const listSponsorCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("water_break_campaigns")
      .select(
        "id,title,creative_url,destination_url,creative_type,active,start_at,end_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const saveSponsorCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => campaignSchema.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const payload = {
      title: data.title,
      creative_url: data.creativeUrl,
      destination_url: data.destinationUrl,
      creative_type: data.creativeType,
      active: data.active,
    };
    const { error } = data.id
      ? await supabaseAdmin
          .from("water_break_campaigns")
          .update(payload)
          .eq("id", data.id)
      : await supabaseAdmin.from("water_break_campaigns").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
