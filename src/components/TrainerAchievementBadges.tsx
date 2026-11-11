import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { TRAINER_ACHIEVEMENTS, type TrainerAchievementId } from "@/lib/trainer-achievements";
import type { PublicTrainer } from "@/lib/public-trainers";

export function TrainerAchievementBadges({
  ids,
}: {
  ids: readonly TrainerAchievementId[];
}) {
  const earned = TRAINER_ACHIEVEMENTS.filter((achievement) => ids.includes(achievement.id));
  if (!earned.length) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Trainer achievement badges">
      {earned.map((achievement) => (
        <span
          key={achievement.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold"
          title={achievement.description}
        >
          <Award size={14} aria-hidden="true" />
          {achievement.label}
        </span>
      ))}
    </div>
  );
}

/** Trainer's own view uses the same server-derived badge list as the public directory. */
export function TrainerAchievementsPanel({ trainerId }: { trainerId: string }) {
  const [earned, setEarned] = useState<TrainerAchievementId[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setEarned(null);
    setUnavailable(false);
    fetch("/api/public/trainers", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Trainer achievements unavailable");
        return response.json() as Promise<{ trainers: PublicTrainer[] }>;
      })
      .then(({ trainers }) => {
        if (controller.signal.aborted) return;
        const trainer = trainers.find((entry) => entry.id === trainerId);
        setEarned(trainer?.achievements ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUnavailable(true);
      });
    return () => controller.abort();
  }, [trainerId]);

  return (
    <section className="card space-y-2 p-5" aria-label="Your trainer achievements">
      <h2 className="text-lg font-semibold">Your trainer achievements</h2>
      <p className="text-sm text-muted-foreground">
        Earn badges by publishing approved public on-demand workouts or completing
        live classes. You can focus on either format—or both.
      </p>
      {earned === null && !unavailable && (
        <p className="text-sm text-muted-foreground">Loading achievements…</p>
      )}
      {unavailable && (
        <p className="text-sm text-muted-foreground">Achievements are temporarily unavailable.</p>
      )}
      {earned && earned.length > 0 && <TrainerAchievementBadges ids={earned} />}
      {earned?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Your first public workout or completed live class will earn your first badge.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Badges recognize activity only. They do not unlock paid Spotlight, guaranteed
        placement, verification, or payout privileges.
      </p>
    </section>
  );
}
