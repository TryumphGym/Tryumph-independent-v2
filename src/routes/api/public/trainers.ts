import { offersPrivateCoaching } from "@/lib/trainer-services";
import { getTrainerAchievementIds } from "@/lib/trainer-achievements";
import { mayPublishFitnessCopy } from "@/lib/professional-claims";
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
            .select(
              "user_id,name,expires,status,verified_at,verified_by,document_path",
            )
            .eq("status", "verified")
            .not("verified_at", "is", null)
            .not("verified_by", "is", null);
          if (certError) throw certError;
          const valid = (credentials ?? []).filter(
            (c) => isCurrentVerified(c) && c.verified_by !== c.user_id,
          );
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
            .select("id,name,role,extra,avatar_url,focus_tags")
            .in("id", ids)
            .eq("role", "trainer");
          if (profileError) throw profileError;
          const [programs, videos, lives, offers, completedLives] = await Promise.all([
            db
              .from("trainer_programs")
              .select("trainer_id")
              .eq("builder_version", 2)
              .eq("published", true)
              .eq("blocked", false),
            db.from("public_workout_catalog").select("user_id"),
            db
              .from("live_sessions")
              .select("trainer_id")
              .in("status", ["scheduled", "live"])
              .gte("starts_at", new Date(Date.now() - 7200000).toISOString()),
            db
              .from("creator_offers")
              .select("trainer_id")
              .eq("enabled", true)
              .eq("blocked", false),
            db.from("live_sessions").select("trainer_id").in("trainer_id", ids).eq("status", "ended"),
          ]);
          if (programs.error || videos.error || lives.error || offers.error || completedLives.error)
            throw new Error("Service directory unavailable");
          const workoutCounts = new Map<string, number>();
          for (const workout of videos.data ?? []) {
            workoutCounts.set(workout.user_id, (workoutCounts.get(workout.user_id) ?? 0) + 1);
          }
          const liveCounts = new Map<string, number>();
          for (const completed of completedLives.data ?? []) {
            liveCounts.set(completed.trainer_id, (liveCounts.get(completed.trainer_id) ?? 0) + 1);
          }
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
                  .filter(
                    (s): s is string =>
                      typeof s === "string" &&
                      mayPublishFitnessCopy(
                        s,
                        p.id,
                        valid.filter((c) => c.user_id === p.id),
                      ),
                  )
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
              achievements: getTrainerAchievementIds({
                publicWorkouts: workoutCounts.get(p.id) ?? 0,
                completedLives: liveCounts.get(p.id) ?? 0,
              }),
              name: p.name,
              bio:
                typeof trainer["bio"] === "string"
                  ? mayPublishFitnessCopy(
                      trainer["bio"],
                      p.id,
                      valid.filter((c) => c.user_id === p.id),
                    )
                    ? trainer["bio"].slice(0, 1500)
                    : "Biography awaiting professional-title review."
                  : "",
              specialties,
              focus_tags: p.focus_tags,
              services: [
                "community",
                ...(programs.data.some((x) => x.trainer_id === p.id)
                  ? ["programs"]
                  : []),
                ...(videos.data.some((x) => x.user_id === p.id)
                  ? ["workouts"]
                  : []),
                ...(lives.data.some((x) => x.trainer_id === p.id)
                  ? ["live"]
                  : []),
                ...(offers.data.some((x) => x.trainer_id === p.id)
                  ? ["membership"]
                  : []),
                ...(offersPrivateCoaching({
                  rate: trainer["rate"],
                  services: trainer["services"],
                })
                  ? ["coaching"]
                  : []),
              ],
              rate:
                typeof trainer["rate"] === "number" &&
                Number.isFinite(trainer["rate"])
                  ? trainer["rate"]
                  : 0,
              qualifications: valid
                .filter(
                  (c) =>
                    c.user_id === p.id &&
                    mayPublishFitnessCopy(
                      c.name,
                      p.id,
                      valid.filter((v) => v.user_id === p.id),
                    ),
                )
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
