// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getTrainerAchievementIds, TRAINER_ACHIEVEMENTS } from "./trainer-achievements";

describe("trainer achievement badges", () => {
  it("never grants badges to an account with no activity", () => {
    expect(getTrainerAchievementIds({ publicWorkouts: 0, completedLives: 0 })).toEqual([]);
  });
  it("awards on-demand milestones without demanding live classes", () => {
    expect(getTrainerAchievementIds({ publicWorkouts: 5, completedLives: 0 }))
      .toEqual(["first-workout", "workout-builder"]);
    expect(getTrainerAchievementIds({ publicWorkouts: 25, completedLives: 0 }))
      .toContain("workout-library");
  });
  it("awards live milestones without demanding any on-demand uploads", () => {
    expect(getTrainerAchievementIds({ publicWorkouts: 0, completedLives: 1 }))
      .toEqual(["first-live"]);
    expect(getTrainerAchievementIds({ publicWorkouts: 0, completedLives: 10 }))
      .toEqual(["first-live", "live-regular"]);
  });
  it("does not trust impossible numeric values", () => {
    expect(getTrainerAchievementIds({ publicWorkouts: Number.NaN, completedLives: Number.POSITIVE_INFINITY }))
      .toEqual([]);
  });
  it("does not define automatic perks or privilege grants", () => {
    expect(TRAINER_ACHIEVEMENTS).toHaveLength(5);
    expect(TRAINER_ACHIEVEMENTS.every((item) => !("reward" in item || "access" in item)))
      .toBe(true);
  });
});
