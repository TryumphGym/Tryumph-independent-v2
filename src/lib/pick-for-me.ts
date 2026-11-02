import { EQUIPMENT, gearOf } from "./data";
import { matchesDiscovery, DISCOVERY } from "./discovery";
import { isSafetyCompatible } from "./workout-preferences";
export type PickWorkout = {
  id: string;
  title: string;
  minutes: number;
  category: string;
  level: string;
  equipment?: string;
  required_equipment?: string[];
  discovery_tags?: string[];
  pregnancy_safe?: boolean;
  intensity?: string;
  communityTags?: string[];
  review_status?: string;
};
export type PickPreferences = {
  minutes: number;
  approximate: boolean;
  equipment: string[];
  style: string;
  level: string;
  focus: string[];
  intensity: string;
  community: string[];
};
export const DEFAULT_PICK: PickPreferences = {
  minutes: 20,
  approximate: false,
  equipment: [],
  style: "any",
  level: "any",
  focus: [],
  intensity: "any",
  community: [],
};
export function pickCandidates(
  workouts: readonly PickWorkout[],
  p: PickPreferences,
) {
  if (!Number.isFinite(p.minutes) || p.minutes < 1 || p.minutes > 180)
    return [];
  const gear = p.equipment.includes("Full gym") ? [...EQUIPMENT] : p.equipment;
  const levels = ["Beginner", "Intermediate", "Advanced"];
  return workouts
    .filter((w) => {
      if (w.review_status && w.review_status !== "approved") return false;
      if (w.minutes <= 0 || w.minutes > p.minutes + (p.approximate ? 5 : 0))
        return false;
      if (
        p.style !== "any" &&
        w.category.toLowerCase() !== p.style.toLowerCase()
      )
        return false;
      if (
        p.level !== "any" &&
        w.level !== "All levels" &&
        (levels.indexOf(w.level) < 0 ||
          levels.indexOf(w.level) > levels.indexOf(p.level))
      )
        return false;
      if (p.intensity !== "any" && w.intensity !== p.intensity) return false;
      if (!matchesDiscovery(w, p.focus)) return false;
      if (
        !(w.required_equipment ?? gearOf(w.equipment)).every(
          (g) => g === "No equipment" || gear.includes(g),
        )
      )
        return false;
      return isSafetyCompatible(
        {
          ...w,
          pregnancySafe: w.pregnancy_safe === true,
          postpartum:
            w.discovery_tags?.includes("postpartum") ||
            w.level === "Postpartum",
        },
        {
          level: "All levels",
          styles: [],
          gear,
          needs: [],
          quiet: false,
          pregnant: p.focus.includes("prenatal"),
          postpartum: p.focus.includes("postpartum"),
        },
      );
    })
    .sort((a, b) => {
      const score = (w: PickWorkout) =>
        -Math.abs(p.minutes - w.minutes) +
        (w.minutes <= p.minutes ? 5 : 0) +
        p.community.filter((t) => w.communityTags?.includes(t)).length * 3;
      return score(b) - score(a) || a.id.localeCompare(b.id);
    });
}
/** Deterministic ranking plus rotation; safety is applied before novelty. */
export function pickNext(
  candidates: readonly PickWorkout[],
  seen: readonly string[],
) {
  return (
    candidates.find((w) => !seen.includes(w.id)) ??
    candidates.find((w) => w.id !== seen.at(-1)) ??
    candidates[0] ??
    null
  );
}
export function pickReason(w: PickWorkout, p: PickPreferences) {
  const labels = Object.values(DISCOVERY).flat();
  return [
    `${w.minutes} minutes${w.minutes > p.minutes ? " (approximately +" + (w.minutes - p.minutes) + " minutes)" : ""}`,
    (w.required_equipment ?? gearOf(w.equipment))
      .filter((g) => g !== "No equipment")
      .join(", ") || "No equipment",
    w.level,
    ...p.focus.map((id) => labels.find(([key]) => key === id)?.[1] ?? id),
    ...(w.intensity ? [w.intensity + " intensity"] : []),
  ].join(" · ");
}
