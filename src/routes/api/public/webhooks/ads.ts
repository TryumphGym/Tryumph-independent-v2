import { createFileRoute } from "@tanstack/react-router";
import { runtimeEnv } from "@/lib/runtime-env.server";
import { settleVerifiedAd } from "@/lib/ad-settlement.server";

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function authenticated(body: string, signature: string, secret: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(body)),
  );
  // Compare full signature without short-circuiting individual bytes.
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  let diff = 0;
  for (let i = 0; i < 64; i++)
    diff |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  return diff === 0;
}
/** Advertiser/network settlement webhook. Browser impressions NEVER create earnings. */
export const Route = createFileRoute("/api/public/webhooks/ads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = runtimeEnv("AD_SETTLEMENT_WEBHOOK_SECRET");
        if (!secret || secret.length < 32)
          return new Response("Ad settlement not configured", { status: 503 });
        const body = await request.text();
        if (
          body.length > 8192 ||
          !(await authenticated(
            body,
            request.headers.get("x-tryumph-signature") ?? "",
            secret,
          ))
        )
          return new Response("Unauthorized", { status: 401 });
        try {
          const payload = JSON.parse(body) as Record<string, unknown>;
          // Require recent signed events; a unique networkEventId also prevents replayed credits.
          if (
            typeof payload["timestamp"] !== "number" ||
            Math.abs(Date.now() - payload["timestamp"]) > 300000
          )
            return new Response("Expired event", { status: 400 });
          await settleVerifiedAd({
            network: String(payload["network"] ?? ""),
            networkEventId: String(payload["networkEventId"] ?? ""),
            videoId: String(payload["videoId"] ?? ""),
            breakSecond: Number(payload["breakSecond"]),
            grossCents: Number(payload["grossCents"]),
            feeCents: Number(payload["feeCents"]),
          });
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Advertising settlement error", error);
          return new Response("Unable to process settlement", { status: 500 });
        }
      },
    },
  },
});
