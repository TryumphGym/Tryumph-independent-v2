import { runtimeEnv } from "./runtime-env.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// AI kindness check for reviews. Falls back to "ok" only when the AI is unreachable;
// the client always runs the free word filter first.
export const moderateReview = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ text: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const key = runtimeEnv("LOVABLE_API_KEY");
    if (!key) return { ok: true, note: "", ai: false };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "You moderate reviews of fitness trainers. Reject reviews that are harassing, hateful, sexual, body-shaming, contain personal contact info, or attack the person rather than the service. Honest criticism of the class or coaching is allowed. If rejected, give one short friendly suggestion for rewording (max 25 words).",
        input: data.text,
        text: { format: { type: "json_schema", name: "verdict", strict: true, schema: { type: "object", additionalProperties: false, required: ["ok", "note"], properties: { ok: { type: "boolean" }, note: { type: "string" } } } } },
      }),
    });
    if (!res.ok || !res.body) return { ok: true, note: "", ai: false };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(l.slice(5).trim());
          if (ev.type === "response.output_text.delta") out += ev.delta;
        } catch { /* ignore */ }
      }
    }
    try {
      const v = JSON.parse(out) as { ok: boolean; note: string };
      return { ok: v.ok, note: v.ok ? "Looks kind and helpful — thanks!" : v.note, ai: true };
    } catch {
      return { ok: true, note: "", ai: false };
    }
  });
