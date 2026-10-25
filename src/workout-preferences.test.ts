import { describe, expect, it } from "vitest";
import { matchesWorkout, type WorkoutPreferences } from "./workout-preferences";

const base: WorkoutPreferences = { level: "All levels", styles: [], gear: [], needs: [], quiet: false };
const workout = { category: "Pilates", level: "Intermediate", equipment: "Mat, Yoga ball, Sliders" };
describe("profile and guest workout matching", () => {
  it("supports multiple equipment selections and requires all workout gear", () => {
    expect(matchesWorkout(workout, { ...base, gear: ["Mat", "Yoga ball"] })).toBe(false);
    expect(matchesWorkout(workout, { ...base, gear: ["Mat", "Yoga ball", "Sliders"] })).toBe(true);
  });
  it("filters by the profile level", () => {
    expect(matchesWorkout(workout, { ...base, level: "Beginner" })).toBe(false);
    expect(matchesWorkout(workout, { ...base, level: "Intermediate" })).toBe(true);
  });
  it("includes any selected workout style", () => {
    expect(matchesWorkout(workout, { ...base, styles: ["Yoga", "Pilates"] })).toBe(true);
    expect(matchesWorkout(workout, { ...base, styles: ["Strength"] })).toBe(false);
  });
  it("requires every selected health tag, including encoded upload tags", () => {
    expect(matchesWorkout({ ...workout, equipment: "Mat | Knee friendly, Low impact" }, { ...base, needs: ["Knee friendly", "Low impact"] })).toBe(true);
    expect(matchesWorkout(workout, { ...base, needs: ["Knee friendly"] })).toBe(false);
  });
  it("uses pregnancy preferences for uploaded and preview workouts", () => {
    expect(matchesWorkout(workout, { ...base, pregnant: true })).toBe(false);
    expect(matchesWorkout({ ...workout, pregnancySafe: true }, { ...base, needs: ["Pregnancy safe"] })).toBe(true);
  });
  it("allows only equipment-free workouts when no equipment is explicitly selected", () => {
    expect(matchesWorkout(workout, { ...base, gear: ["No equipment"] })).toBe(false);
    expect(matchesWorkout({ ...workout, equipment: "No equipment" }, { ...base, gear: ["No equipment"] })).toBe(true);
  });
  it("leaves unspecified preferences unrestricted", () => expect(matchesWorkout(workout, base)).toBe(true));
  it("applies quiet and postpartum preferences", () => {
    expect(matchesWorkout({ ...workout, category: "HIIT" }, { ...base, quiet: true })).toBe(false);
    expect(matchesWorkout(workout, { ...base, quiet: true })).toBe(true);
    expect(matchesWorkout(workout, { ...base, postpartum: true })).toBe(false);
    expect(matchesWorkout({ ...workout, postpartum: true }, { ...base, postpartum: true })).toBe(true);
  });
});