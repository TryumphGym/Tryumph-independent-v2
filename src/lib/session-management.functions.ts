import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const manageClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["cancel", "end", "edit"]),
        title: z.string().trim().min(1).max(160).optional(),
        description: z.string().max(4000).optional(),
        recordingEnabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const row = await supabaseAdmin
      .from("live_sessions")
      .select("trainer_id,status,starts_at")
      .eq("id", data.id)
      .single();
    if (row.error || row.data.trainer_id !== context.userId)
      throw new Error("Only the class trainer can manage this class");
    if (data.action === "edit") {
      if (new Date(row.data.starts_at).getTime() <= Date.now())
        throw new Error("Only upcoming classes may be edited");
      const saved = await supabaseAdmin
        .from("live_sessions")
        .update({
          ...(data.title ? { title: data.title } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.recordingEnabled !== undefined
            ? { recording_enabled: data.recordingEnabled }
            : {}),
        })
        .eq("id", data.id);
      if (saved.error) throw saved.error;
    } else {
      const saved = await supabaseAdmin
        .from("live_sessions")
        .update({ status: data.action === "cancel" ? "cancelled" : "ended" })
        .eq("id", data.id);
      if (saved.error) throw saved.error;
      const { stopRecordedClass } = await import("./recording-control.server");
      await stopRecordedClass(data.id, context.userId);
      if (data.action === "cancel") {
        const { processRefundJobs } = await import("./refunds.server");
        await processRefundJobs();
      }
    }
    return { ok: true };
  });
export const cancelPrivateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ checkoutId: z.string().min(3).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("cancel_private_session", {
      p_checkout_id: data.checkoutId,
      p_user_id: context.userId,
    });
    if (result.error) throw result.error;
    const { processRefundJobs } = await import("./refunds.server");
    await processRefundJobs();
    return { ok: true };
  });
export const retryPendingRefunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (admin.error || !admin.data) throw new Error("Admins only");
    const { processRefundJobs } = await import("./refunds.server");
    return processRefundJobs();
  });

export const listClassRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const session = await supabaseAdmin
      .from("live_sessions")
      .select("trainer_id")
      .eq("id", data.sessionId)
      .single();
    if (session.error || session.data.trainer_id !== context.userId)
      throw new Error("Only the trainer can view registrations");
    const registrations = await supabaseAdmin
      .from("live_room_access")
      .select("user_id,status,first_joined_at")
      .eq("session_id", data.sessionId);
    if (registrations.error) throw registrations.error;
    const ids = registrations.data.map((row) => row.user_id);
    if (!ids.length) return [];
    const profiles = await supabaseAdmin
      .from("profiles")
      .select("id,name")
      .in("id", ids);
    if (profiles.error) throw profiles.error;
    return registrations.data.map((row) => ({
      id: row.user_id,
      name: profiles.data.find((p) => p.id === row.user_id)?.name ?? "Member",
      status: row.status,
      attended: row.first_joined_at !== null,
    }));
  });
