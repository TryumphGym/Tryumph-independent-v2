import { supabase } from "@/integrations/supabase/client";
export type DemandSelection = {
  source: "workouts" | "programs" | "live";
  query?: string;
  tags?: string[];
  category?: string;
  equipment?: string[];
  minutes?: number;
  minMinutes?: number;
  exact?: boolean;
  categories?: string[];
  difficulty?: string;
};
/** Run after results render. No raw telemetry tables are client-readable. Failure never affects search. */
const terms = new Set([
  "strength",
  "cardio",
  "hiit",
  "core",
  "yoga",
  "pilates",
  "mobility",
  "running",
  "flexibility",
  "endurance",
  "functional fitness",
  "general wellness",
  "weight loss",
]);
const nonSensitiveGoals = new Set([
  "weight_loss",
  "strength",
  "core",
  "flexibility",
  "endurance",
  "functional",
  "running",
  "wellness",
]);
export function trackDiscoveryDemand(v: DemandSelection) {
  const term = (v.query ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  // Do not transmit arbitrary/sensitive text to the optional telemetry endpoint.
  // The database independently repeats its own allowlist checks.
  if (
    (term && !terms.has(term)) ||
    (v.tags ?? []).some((t) => !nonSensitiveGoals.has(t))
  )
    return;
  void supabase
    .rpc("record_discovery_demand", {
      p_source: v.source,
      p_query: term,
      p_tags: v.tags ?? [],
      p_category: v.category ?? "",
      p_equipment: v.equipment ?? [],
      p_length: v.minutes ?? 0,
      p_min_length: v.minMinutes ?? 0,
      p_exact: v.exact ?? false,
      p_categories: v.categories ?? [],
      p_difficulty: v.difficulty ?? "",
    })
    .then(
      () => {},
      () => {},
    );
}
