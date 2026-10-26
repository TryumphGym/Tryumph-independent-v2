import { runtimeEnv } from "../../../../lib/runtime-env.server";
import { createFileRoute } from "@tanstack/react-router";
import { buildPushHTTPRequest } from "@pushforge/builder";

// Called every 5 minutes by the scheduler. Sends due class reminders as phone/computer push alerts.
// Caller must present the private scheduler token (stored in the database, never exposed).
export const Route = createFileRoute("/api/public/hooks/push-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-cron-token") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: t } = await supabaseAdmin.from("cron_tokens").select("token").eq("name", "push").single();
        if (!t || !token || token !== t.token) return new Response("Unauthorized", { status: 401 });
        const jwk = runtimeEnv("VAPID_PRIVATE_JWK");
        if (!jwk) return new Response("Push not configured", { status: 500 });
        const privateJWK = JSON.parse(jwk);

        const now = Date.now();
        const { data: due } = await supabaseAdmin.from("push_reminders").select("*").eq("sent", false)
          .lte("fire_at", new Date(now + 5 * 60000).toISOString()).gte("fire_at", new Date(now - 6 * 60000).toISOString()).limit(500);
        if (!due?.length) return Response.json({ sent: 0 });
        await supabaseAdmin.from("push_reminders").update({ sent: true }).in("id", due.map((r) => r.id));
        const users = [...new Set(due.map((r) => r.user_id))];
        const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("*").in("user_id", users);
        let sent = 0;
        for (const r of due) {
          for (const sub of (subs ?? []).filter((x) => x.user_id === r.user_id)) {
            try {
              const req = await buildPushHTTPRequest({
                privateJWK,
                subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                message: { payload: { title: "Tryumph Gym", body: r.body, url: "/live" }, adminContact: "mailto:mackenzie@tryumphgym.com", options: { ttl: 300 } },
              });
              const res = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
              if (res.status === 404 || res.status === 410) await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              else if (res.ok) sent++;
            } catch (e) { console.error("push failed", e); }
          }
        }
        return Response.json({ sent });
      },
    },
  },
});
