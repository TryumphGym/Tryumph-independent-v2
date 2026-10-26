import { FRIENDLY, friendlyOf, gearOf } from "./data";

export type WorkoutMatch = { category: string; level: string; equipment?: string; required_equipment?: string[]; optional_equipment?: string[]; friendly?: string[]; postpartum?: boolean; pregnancySafe?: boolean };
export type WorkoutPreferences = { level: string; styles: string[]; gear: string[]; needs: string[]; quiet: boolean; postpartum?: boolean; pregnant?: boolean };
export const SAFETY_OPTIONS = ["Pregnancy safe", "Postpartum", ...FRIENDLY, "Quiet / Apartment-friendly"];

export function matchesWorkout(workout: WorkoutMatch, preferences: WorkoutPreferences) {
  const { level, styles, gear, needs, quiet } = preferences;
  if (level !== "All levels" && (level === "Postpartum" ? !workout.postpartum : workout.level !== level)) return false;
  if (styles.length && !styles.includes(workout.category)) return false;
  const required = workout.required_equipment ?? gearOf(workout.equipment);
  if (gear.length && !required.every((item) => gear.includes(item))) return false;
  if (!needs.filter((need) => FRIENDLY.some((tag) => tag === need)).every((need) => friendlyOf(workout).includes(need))) return false;
  if ((preferences.pregnant || needs.includes("Pregnant") || needs.includes("Pregnancy safe")) && !workout.pregnancySafe) return false;
  if ((preferences.postpartum || needs.includes("Postpartum")) && !workout.postpartum) return false;
  if ((quiet || needs.includes("Quiet / Apartment-friendly")) && !( ["Yoga", "Pilates", "Core", "Mobility", "Stretch"].includes(workout.category) || (workout.category !== "HIIT" && workout.level === "Beginner"))) return false;
  return true;
}