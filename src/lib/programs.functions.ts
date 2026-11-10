import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { programDraftSchema } from "./programs";
import type { Json } from "@/integrations/supabase/types";
const id = z.string().uuid();
export const saveFitnessProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: id.optional(), document: programDraftSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("save_fitness_program", {
      p_data: data.document as unknown as Json,
      ...(data.id ? { p_id: data.id } : {}),
    });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const submitFitnessProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("submit_fitness_program", {
      p_id: data.id,
    });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const setFitnessProgramVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id, published: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("set_fitness_program_visibility", {
      p_id: data.id,
      p_published: data.published,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const enrollFitnessProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("enroll_fitness_program", {
      p_id: data.id,
    });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const updateProgramProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ editionId: id, stepId: id, completed: z.boolean().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("set_program_progress", {
      p_edition: data.editionId,
      p_step: data.stepId,
      ...(data.completed === undefined ? {} : { p_completed: data.completed }),
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const getProgramVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ editionId: id, stepId: id, variationId: id.optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { programPlayback } = await import("./program-media.server");
    return programPlayback(
      context.userId,
      data.editionId,
      data.stepId,
      data.variationId,
    );
  });
export const buyFitnessProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const { createProgramCheckout } = await import("./program-payments.server");
    return createProgramCheckout(context.userId, data.id);
  });
export const programCheckoutAvailability = createServerFn({
  method: "GET",
}).handler(async () => {
  const { runtimeEnv } = await import("./runtime-env.server");
  if (runtimeEnv("PROGRAM_NATIVE_CHECKOUT_ENABLED") !== "true")
    return { enabled: false };
  const { supabaseAdmin } =
    await import("@/integrations/supabase/client.server");
  const r = await supabaseAdmin
    .from("program_commerce")
    .select("enabled,commission_bps,approved_by")
    .eq("singleton", true)
    .single();
  return {
    enabled:
      !r.error &&
      r.data.enabled &&
      r.data.commission_bps !== null &&
      !!r.data.approved_by,
  };
});
export const getTrainerProgramMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await context.supabase.rpc("program_metrics");
    if (r.error) throw new Error("Program metrics unavailable");
    return r.data as unknown as import("./programs").ProgramMetrics;
  });
export const reviewFitnessProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        editionId: id,
        status: z.enum(["approved", "rejected", "revoked"]),
        note: z.string().max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("review_fitness_program", {
      p_edition: data.editionId,
      p_status: data.status,
      p_note: data.note,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const moderateFitnessProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ id, blocked: z.boolean(), note: z.string().min(3).max(2000) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("moderate_fitness_program", {
      p_id: data.id,
      p_blocked: data.blocked,
      p_note: data.note,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const grantExternalProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        editionId: id,
        memberId: id,
        reference: z.string().min(8).max(500),
        confirmedAt: z.string().datetime().optional(),
        verified: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("grant_external_program", {
      p_edition: data.editionId,
      p_member: data.memberId,
      p_reference: data.reference,
      ...(data.confirmedAt ? { p_confirmed: data.confirmedAt } : {}),
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const requestProgramRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ orderId: id, reason: z.string().min(3).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("request_program_refund", {
      p_order: data.orderId,
      p_reason: data.reason,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const approveProgramTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        commissionBps: z.literal(1000),
        termsVersion: z.string().trim().min(3).max(120),
        approved: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runtimeEnv } = await import("./runtime-env.server");
    if (runtimeEnv("PROGRAM_TERMS_OWNER_ID") !== context.userId)
      throw new Error("Only the configured owner can approve commercial terms");
    const { supabaseAdmin: db } =
      await import("@/integrations/supabase/client.server");
    const r = await db.rpc("approve_program_terms", {
      p_owner: context.userId,
      p_enabled: data.enabled,
      p_bps: data.commissionBps,
      p_terms: data.termsVersion,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const getProgramCommercialTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("Admins only");
    const { runtimeEnv } = await import("./runtime-env.server");
    const { supabaseAdmin: db } =
      await import("@/integrations/supabase/client.server");
    const r = await db
      .from("program_commerce")
      .select("enabled,commission_bps,terms_version,approved_at")
      .eq("singleton", true)
      .single();
    if (r.error) throw r.error;
    return {
      ...r.data,
      ownerCanApprove: runtimeEnv("PROGRAM_TERMS_OWNER_ID") === context.userId,
      runtimeEnabled: runtimeEnv("PROGRAM_NATIVE_CHECKOUT_ENABLED") === "true",
    };
  });

export const checkpointProgramStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        editionId: id,
        stepId: id,
        elapsedSeconds: z.number().int().min(0).max(18000),
        variationId: id.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("checkpoint_program_step", {
      p_edition: data.editionId,
      p_step: data.stepId,
      p_elapsed: data.elapsedSeconds,
      ...(data.variationId ? { p_variation: data.variationId } : {}),
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });

export const previewProgramImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const image = await context.supabase
      .from("program_images")
      .select("object_path")
      .eq("id", data.id)
      .single();
    if (image.error) throw new Error("Image access denied");
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.storage
      .from("program-demonstrations")
      .createSignedUrl(image.data.object_path, 300);
    if (r.error) throw new Error("Image preview unavailable");
    return r.data.signedUrl;
  });
export const registerProgramImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ path: z.string().min(38).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("register_program_image", {
      p_path: data.path,
    });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const reviewProgramImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id, status: z.enum(["approved", "rejected"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("review_program_image", {
      p_id: data.id,
      p_status: data.status,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });

export const reportProgramUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id, seconds: z.number().int().min(0).max(18000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("report_program_usage", {
      p_id: data.id,
      p_seconds: data.seconds,
    });
    if (r.error) throw new Error(r.error.message);
    return true;
  });
export const getProgramAdminReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await context.supabase.rpc("program_admin_report");
    if (r.error) throw new Error(r.error.message);
    const { runtimeEnv } = await import("./runtime-env.server");
    const rate = (key: string) => {
      const raw = runtimeEnv(key);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const gbPerHour = rate("PROGRAM_ESTIMATED_GB_PER_HOUR"),
      usdPerGb = rate("PROGRAM_ESTIMATED_USD_PER_GB"),
      usdPerThousandSessions = rate("PROGRAM_ESTIMATED_USD_PER_1000_SESSIONS");
    return {
      rows: r.data as unknown as import("./programs").ProgramReportRow[],
      gbPerHour,
      usdPerGb,
      usdPerThousandSessions,
    };
  });
