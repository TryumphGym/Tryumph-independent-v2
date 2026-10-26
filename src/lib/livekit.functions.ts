import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
export const getLiveKitToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        room: z.string().min(5).max(140),
        name: z.string().max(80).default("Member"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { issueLiveRoomToken } = await import("./live-token.server");
    return issueLiveRoomToken(context.userId, data.room, data.name);
  });
