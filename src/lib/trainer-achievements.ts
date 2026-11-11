/** Display-only trainer milestones. Never use achievements for authorization or paid placement. */
export const TRAINER_ACHIEVEMENTS = [
  {
    id: "first-workout",
    label: "First Workout",
    description: "Published your first approved public on-demand workout.",
    metric: "publicWorkouts",
    threshold: 1,
  },
  {
    id: "workout-builder",
    label: "Workout Builder",
    description: "Published five approved public on-demand workouts.",
    metric: "publicWorkouts",
    threshold: 5,
  },
  {
    id: "workout-library",
    label: "Workout Library",
    description: "Published 25 approved public on-demand workouts.",
    metric: "publicWorkouts",
    threshold: 25,
  },
  {
    id: "first-live",
    label: "First Live",
    description: "Completed your first live class.",
    metric: "completedLives",
    threshold: 1,
  },
  {
    id: "live-regular",
    label: "Live Regular",
    description: "Completed ten live classes.",
    metric: "completedLives",
    threshold: 10,
  },
] as const;

export type TrainerAchievementId = (typeof TRAINER_ACHIEVEMENTS)[number]["id"];
export type TrainerAchievementStats = {
  publicWorkouts: number;
  completedLives: number;
};

/** Counts must come from server-controlled records, never client claims or profile JSON. */
export function getTrainerAchievementIds(
  stats: TrainerAchievementStats,
): TrainerAchievementId[] {
  return TRAINER_ACHIEVEMENTS.filter(
    (achievement) =>
      Number.isFinite(stats[achievement.metric]) &&
      stats[achievement.metric] >= achievement.threshold,
  ).map((achievement) => achievement.id);
}
