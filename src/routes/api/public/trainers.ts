import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public, allowlisted trainer directory. Never return certification documents or private profile JSON.
export const Route = createFileRoute("/api/public/trainers")({
  server: { handlers: { GET: async () => {
    try {
      const url = env.SUPABASE_URL;
      const key = env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return Response.json({ error: "Directory unavailable" }, { status: 503 });
      const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: credentials, error: certError } = await db.from("certifications")
        .select("user_id,name,expires").eq("status", "verified").not("verified_at", "is", null).not("verified_by", "is", null);
      if (certError) throw certError;
      const today = new Date().toISOString().slice(0, 10);
      const valid = (credentials ?? []).filter(c => !c.expires || /^\d{4}-\d{2}-\d{2}$/.test(c.expires) && c.expires >= today);
      const ids = [...new Set(valid.map(c => c.user_id))];
      if (!ids.length) return Response.json({ trainers: [] });
      const { data: profiles, error: profileError } = await db.from("profiles")
        .select("id,name,role,extra,avatar_url").in("id", ids).eq("role", "trainer");
      if (profileError) throw profileError;
      const trainers = (profiles ?? []).map(p => {
        const extra = p.extra && typeof p.extra === "object" && !Array.isArray(p.extra) ? p.extra as Record<string, unknown> : {};
        const trainer = extra.trainer && typeof extra.trainer === "object" && !Array.isArray(extra.trainer) ? extra.trainer as Record<string, unknown> : {};
        const specialties = Array.isArray(trainer.specialties) ? trainer.specialties.filter((s): s is string => typeof s === "string").slice(0, 12) : [];
        return { id: p.id, name: p.name, bio: typeof trainer.bio === "string" ? trainer.bio.slice(0, 1500) : "", specialties,
          rate: typeof trainer.rate === "number" && Number.isFinite(trainer.rate) ? trainer.rate : 0,
          qualifications: valid.filter(c => c.user_id === p.id).map(c => c.name), avatarUrl: p.avatar_url };
      });
      return Response.json({ trainers }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("Public trainer directory failed", error);
      return Response.json({ error: "Directory unavailable" }, { status: 500 });
    }
  } } },
});
