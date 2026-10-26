import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { reviewCheck } from "./store";
// Deterministic local moderation; no dependency on a former hosting provider.
export const moderateReview = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ text: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data }) => ({ ...reviewCheck(data.text), ai: false }));
