import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { PublicTrainer } from "@/lib/public-trainers";
import { PrivateBookingForm } from "@/components/PrivateBookingForm";
import { TrainerStorefront } from "@/components/TrainerStorefront";

export const Route = createFileRoute("/trainers/$id")({
  head: () => ({ meta: [{ title: "Trainer Profile — Tryumph Gym" }] }),
  component: TrainerProfile,
});
function TrainerProfile() {
  const { id } = Route.useParams();
  const [trainer, setTrainer] = useState<PublicTrainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/public/trainers", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Directory unavailable");
        return r.json() as Promise<{ trainers: PublicTrainer[] }>;
      })
      .then((r) => {
        setTrainer(r.trainers.find((t) => t.id === id) ?? null);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);
  return (
    <div className="space-y-6">
      <Link to="/trainers" className="text-sm text-muted-foreground">
        ← All trainers
      </Link>
      {loading && <p className="card p-8">Loading trainer…</p>}
      {error && (
        <p className="card p-8">Unable to load this profile right now.</p>
      )}
      {!loading && !error && !trainer && (
        <p className="card p-8">Trainer not found or not currently verified.</p>
      )}
      {trainer && (
        <section className="card flex flex-wrap items-center gap-6 p-6">
          {trainer.avatarUrl ? (
            <img
              src={trainer.avatarUrl}
              alt={`${trainer.name} profile`}
              className="h-20 w-20 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Avatar
              initials={trainer.name
                .split(/\s+/)
                .map((x) => x[0] ?? "")
                .join("")
                .slice(0, 2)
                .toUpperCase()}
              size="lg"
            />
          )}
          <div className="flex-1">
            <p className="eyebrow">Verified trainer</p>
            <h1 className="mt-1 text-3xl font-bold">{trainer.name}</h1>
            <p className="mt-2 text-muted-foreground">
              {trainer.bio || "This trainer has not added a bio yet."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...trainer.qualifications, ...trainer.specialties].map((q) => (
                <span key={q} className="chip">
                  {q}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-3">
              {trainer.website && (
                <a
                  className="text-primary underline"
                  href={trainer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Website
                </a>
              )}
              {trainer.instagram && (
                <a
                  className="text-primary underline"
                  href={trainer.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              )}
              <Link
                className="text-primary underline"
                to="/trybes"
                search={{ t: `coach-${trainer.id}` }}
              >
                Join free Trybe
              </Link>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold">${trainer.rate}</p>
            <p className="text-sm text-muted-foreground">per session</p>
          </div>
        </section>
      )}
      {trainer && trainer.rate > 0 && (
        <PrivateBookingForm trainerId={trainer.id} rate={trainer.rate} />
      )}
      {trainer && <TrainerStorefront trainerId={trainer.id} />}
    </div>
  );
}
