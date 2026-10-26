/** Preserve paused sections in source, hide them in the January launch workflow. */
export const LAUNCH = {
  youth: false,
  nutrition: false,
  homeschool: false,
} as const;
export const isLaunchWorkout = (workout: { category: string }) =>
  !/youth|homeschool|nutrition/i.test(workout.category);
