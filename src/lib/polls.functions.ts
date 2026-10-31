import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pollInput, type TrybePoll } from "./polls";
export const saveTrybePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => pollInput.parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("save_trybe_poll", {
      p_trybe: data.trybe,
      p_question: data.question,
      p_description: data.description,
      p_options: data.options,
      p_max: data.maxSelections,
      ...(data.expiresAt ? { p_expires: data.expiresAt } : {}),
      p_notify: data.notify,
      p_public: data.public,
      ...(data.id ? { p_id: data.id } : {}),
      ...(data.revision ? { p_revision: data.revision } : {}),
    });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const voteTrybePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        options: z.array(z.string().uuid()).min(1).max(6),
        revision: z.number().int().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("vote_trybe_poll", {
      p_id: data.id,
      p_options: data.options,
      p_revision: data.revision,
    });
    if (r.error) throw new Error(r.error.message);
    return r.data as unknown as TrybePoll;
  });
export const closeTrybePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().max(1000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("close_trybe_poll", {
      p_id: data.id,
      p_reason: data.reason,
    });
    if (r.error) throw new Error(r.error.message);
    return r.data as unknown as TrybePoll;
  });
