import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
export const getCommunityAdSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ postIds: z.array(z.string().uuid()).max(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runtimeEnv } = await import("./runtime-env.server");
    const key = runtimeEnv("COMMUNITY_AD_SESSION_KEY");
    if (
      runtimeEnv("COMMUNITY_FEED_ADS_VERIFIED") !== "true" ||
      runtimeEnv("COMMUNITY_AD_MODE") !== "manual-sponsored" ||
      !key ||
      key.length < 32
    )
      return null;
    const { supabaseAdmin: db } =
      await import("@/integrations/supabase/client.server");
    const creatives = await db
      .from("community_ad_creatives")
      .select("id,title,body,external_url")
      .eq("enabled", true)
      .limit(20);
    if (creatives.error || !creatives.data.length) return null;
    const { safeExternalUrl } = await import("./launch-features");
    const creative = creatives.data.find((c) =>
      safeExternalUrl(c.external_url),
    );
    if (!creative) return null;
    const signingKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    const sign = async (payload: string) =>
      hex(
        await crypto.subtle.sign(
          "HMAC",
          signingKey,
          new TextEncoder().encode(payload),
        ),
      );
    let session: string | undefined;
    const token = getCookie("tryumph-feed-session");
    if (token) {
      const match = /^([a-f0-9-]{36})\.(\d+)\.([a-f0-9]{64})$/.exec(token);
      if (match && Number(match[2]) > Date.now()) {
        const payload = `${match[1]}.${match[2]}`,
          signature = Uint8Array.from(match[3]!.match(/../g)!, (h) =>
            parseInt(h, 16),
          );
        if (
          await crypto.subtle.verify(
            "HMAC",
            signingKey,
            signature,
            new TextEncoder().encode(payload),
          )
        )
          session = match[1];
      }
    }
    if (!session) {
      session = crypto.randomUUID();
      const payload = `${session}.${Date.now() + 3600000}`;
      setCookie("tryumph-feed-session", `${payload}.${await sign(payload)}`, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      });
    }
    // Re-authorize all submitted posts through the request's RLS client before accounting organic spacing.
    const visible = await context.supabase
      .from("posts")
      .select("id")
      .in("id", data.postIds);
    if (visible.error) throw new Error("Feed unavailable");
    const allowed = new Set(visible.data.map((p) => p.id));
    const r = await db.rpc("community_ad_slot", {
      p_session: session,
      p_user: context.userId,
      p_posts: data.postIds.filter((id) => allowed.has(id)),
    });
    if (r.error) throw new Error("Ad policy unavailable");
    return r.data ? { afterPost: r.data, creative } : null;
  });
