import { goalScore } from "./fitness-goals";
import { FRIENDLY, friendlyOf, gearOf } from "./data";

export type WorkoutMatch = {
  category: string;
  level: string;
  equipment?: string;
  required_equipment?: string[];
  optional_equipment?: string[];
  friendly?: string[];
  postpartum?: boolean;
  pregnancySafe?: boolean;
  goals?: string[];
};
export type WorkoutPreferences = {
  level: string;
  styles: string[];
  gear: string[];
  needs: string[];
  quiet: boolean;
  postpartum?: boolean;
  pregnant?: boolean;
  goals?: string[];
  equipmentChosen?: boolean;
};
export const SAFETY_OPTIONS = [
  "Pregnancy safe",
  "Postpartum",
  ...FRIENDLY,
  "Quiet / Apartment-friendly",
];

/** Explicitly incompatible safety tags are NEVER broadened into Close Matches / Explore All. */
export function isSafetyCompatible(
  workout: WorkoutMatch,
  p: WorkoutPreferences,
) {
  const pregnant = !!(
    p.pregnant ||
    p.needs.includes("Pregnant") ||
    p.needs.includes("Pregnancy safe")
  );
  const postpartum = !!(p.postpartum || p.needs.includes("Postpartum"));
  if (pregnant && !workout.pregnancySafe) return false;
  if (postpartum && !workout.postpartum) return false;
  const tags = friendlyOf(workout);
  if (
    p.needs.some((n) => FRIENDLY.some((tag) => tag === n) && !tags.includes(n))
  )
    return false;
  if (
    (p.quiet || p.needs.includes("Quiet / Apartment-friendly")) &&
    (workout.category === "HIIT" ||
      (workout.level === "Advanced" &&
        !["Yoga", "Pilates", "Stretch", "Mobility"].includes(workout.category)))
  )
    return false;
  return true;
}

export function matchesWorkout(workout: WorkoutMatch, p: WorkoutPreferences) {
  if (!isSafetyCompatible(workout, p)) return false;
  if (
    p.level !== "All levels" &&
    workout.level !== "All levels" &&
    p.level !== workout.level &&
    !(p.level === "Postpartum" && workout.postpartum)
  )
    return false;
  if (p.styles.length && !p.styles.includes(workout.category)) return false;
  if (p.goals?.length && goalScore(workout, p.goals) === 0) return false;
  const required = workout.required_equipment ?? gearOf(workout.equipment);
  // No equipment is always compatible. Members with an empty gear list can still do bodyweight workouts.
  if (
    (p.equipmentChosen || p.gear.length > 0) &&
    !required.every((g) => g === "No equipment" || p.gear.includes(g))
  )
    return false;
  return true;
}
