/** Shared labels for member goals and creator workout tags; preserve existing saved values. */
export const FITNESS_GOALS = [
  "Lose weight", "Build muscle & tone", "Build strength", "Strengthen core",
  "Functional fitness", "Endurance", "Run a 5K", "Run a 10K",
  "Run a half-marathon", "Run a marathon", "Cardiovascular fitness",
  "Flexibility", "Improve balance", "Low-impact fitness", "Stress relief",
  "Build a habit", "Postpartum recovery", "Increase energy", "Complete a hike",
  "Do a push-up", "Do a pull-up",
] as const;

const supportingStyles: Record<string, string[]> = {
  "Lose weight": ["Strength", "Cardio", "HIIT"], "Build muscle & tone": ["Strength", "Pilates"],
  "Build strength": ["Strength"], "Strengthen core": ["Core", "Pilates"],
  "Functional fitness": ["Strength", "Core", "Mobility"], "Endurance": ["Cardio", "HIIT"],
  "Run a 5K": ["Cardio", "Strength", "Mobility"], "Run a 10K": ["Cardio", "Strength", "Mobility"],
  "Run a half-marathon": ["Cardio", "Strength", "Mobility"], "Run a marathon": ["Cardio", "Strength", "Mobility"],
  "Cardiovascular fitness": ["Cardio", "HIIT"], "Flexibility": ["Yoga", "Mobility"],
  "Improve balance": ["Yoga", "Pilates", "Core"], "Low-impact fitness": ["Yoga", "Pilates", "Mobility"],
  "Stress relief": ["Yoga", "Mobility"], "Build a habit": ["Strength", "Cardio", "Core", "Yoga", "Pilates", "Mobility"],
  "Postpartum recovery": ["Core", "Pilates"], "Increase energy": ["Cardio", "Yoga"],
  "Complete a hike": ["Strength", "Cardio", "Mobility"], "Do a push-up": ["Strength", "Core"], "Do a pull-up": ["Strength"],
};

export const goalsOf = (workout: { goals?: string[]; equipment?: string }) => workout.goals ?? (workout.equipment?.split("|")[2] ?? "").split(",").map((goal) => goal.trim()).filter(Boolean);

export function goalScore(workout: { category: string; goals?: string[]; equipment?: string }, goals: readonly string[]) {
  // Explicit creator tags take precedence; legacy untagged workouts get a style-based boost, not a medical claim.
  const tags = goalsOf(workout);
  if (tags.length) return goals.filter((goal) => tags.includes(goal)).length * 4;
  return goals.some((goal) => supportingStyles[goal]?.includes(workout.category)) ? 1 : 0;
}