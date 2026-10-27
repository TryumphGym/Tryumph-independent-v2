import { safeExternalUrl } from "@/lib/launch-features";
import { runtimeEnv } from "@/lib/runtime-env.server";
import { createFileRoute } from "@tanstack/react-router";
import { hasVerifiedCpr, isCurrentVerified } from "@/lib/cpr";

// Public, allowlisted trainer directory. Never return certification documents or private profile JSON.
export const Route = createFileRoute("/api/public/trainers")({
  server: {
    handlers: {
      GET: async () => {
        try {
          if (!runtimeEnv("SUPABASE_SERVICE_ROLE_KEY"))
            return Response.json(
              { error: "Directory unavailable" },
              { status: 503 },
            );
          // Shared Supabase client supports both legacy service-role JWTs and sb_secret keys.
          const { supabaseAdmin: db } =
            await import("@/integrations/supabase/client.server");
          const { data: credentials, error: certError } = await db
            .from("certifications")
            .select("user_id,name,expires,status,verified_at,verified_by")
            .eq("status", "verified")
            .not("verified_at", "is", null)
            .not("verified_by", "is", null);
          if (certError) throw certError;
          const valid = (credentials ?? []).filter((c) => isCurrentVerified(c));
          let ids = [...new Set(valid.map((c) => c.user_id))].filter((id) =>
            hasVerifiedCpr(valid.filter((c) => c.user_id === id)),
          );
          const eligibility = await Promise.all(
            ids.map(async (id) => {
              const r = await db.rpc("trainer_is_eligible", {
                p_user_id: id,
                p_live: false,
              });
              if (r.error) throw r.error;
              return r.data ? id : null;
            }),
          );
          ids = eligibility.filter((id): id is string => id !== null);
          if (!ids.length) return Response.json({ trainers: [] });
          const { data: profiles, error: profileError } = await db
            .from("profiles")
            .select("id,name,role,extra,avatar_url")
            .in("id", ids)
            .eq("role", "trainer");
          if (profileError) throw profileError;
          const trainers = (profiles ?? []).map((p) => {
            const extra =
              p.extra && typeof p.extra === "object" && !Array.isArray(p.extra)
                ? (p.extra as Record<string, unknown>)
                : {};
            const trainer =
              extra["trainer"] &&
              typeof extra["trainer"] === "object" &&
              !Array.isArray(extra["trainer"])
                ? (extra["trainer"] as Record<string, unknown>)
                : {};
            const specialties = Array.isArray(trainer["specialties"])
              ? trainer["specialties"]
                  .filter((s): s is string => typeof s === "string")
                  .slice(0, 12)
              : [];
            return {
              website:
                typeof trainer["website"] === "string" &&
                safeExternalUrl(trainer["website"])
                  ? trainer["website"]
                  : null,
              instagram:
                typeof trainer["instagram"] === "string" &&
                safeExternalUrl(trainer["instagram"])
                  ? trainer["instagram"]
                  : null,
              id: p.id,
              name: p.name,
              bio:
                typeof trainer["bio"] === "string"
                  ? trainer["bio"].slice(0, 1500)
                  : "",
              specialties,
              rate:
                typeof trainer["rate"] === "number" &&
                Number.isFinite(trainer["rate"])
                  ? trainer["rate"]
                  : 0,
              qualifications: valid
                .filter((c) => c.user_id === p.id)
                .map((c) => c.name),
              avatarUrl:
                typeof p.avatar_url === "string" &&
                p.avatar_url.startsWith(`${p.id}/`)
                  ? db.storage.from("avatars").getPublicUrl(p.avatar_url).data
                      .publicUrl
                  : typeof p.avatar_url === "string" &&
                      /^https:\/\//i.test(p.avatar_url)
                    ? p.avatar_url
                    : null,
            };
          });
          return Response.json(
            { trainers },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          console.error("Public trainer directory failed", error);
          return Response.json(
            { error: "Directory unavailable" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
