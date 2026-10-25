/** Hide paused launch offerings without removing stored content or contributor approvals. */
export const isLaunchWorkout = (workout: { category: string }) => workout.category !== "Homeschool PE";