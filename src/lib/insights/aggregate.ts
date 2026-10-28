/**
 * Tryumph Insights — disclosure-safe aggregate report helper.
 *
 * SERVER-SIDE use only. This module accepts pre-aggregated counts from
 * authorized queries, never individual member records. It neither tracks
 * people nor grants permission to sell data.
 */
export const MIN_PUBLIC_COHORT = 50;

export type AggregateCount = {
  category: string;
  count: number;
};

export type PublishedAggregate = {
  category: string;
  count: number;
  percent: number;
};

export function prepareAggregateReport(
  groups: readonly AggregateCount[],
  total: number,
  minCohort = MIN_PUBLIC_COHORT,
): PublishedAggregate[] {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error("Invalid aggregate population");
  }
  if (!Number.isSafeInteger(minCohort) || minCohort < MIN_PUBLIC_COHORT) {
    throw new Error("Minimum cohort cannot be below the disclosure threshold");
  }
  if (total < minCohort) return [];
  const seen = new Set<string>();
  let sum = 0;
  for (const { category, count } of groups) {
    if (!category || seen.has(category) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("Invalid aggregate category or count");
    }
    seen.add(category);
    sum += count;
  }
  // Require an exhaustive mutually exclusive partition. Do not leak suppressed
  // cells by publishing a total alongside all-but-one of the categories.
  if (sum !== total) throw new Error("Categories must partition the total");
  // A suppressed category cannot be inferred by subtracting reported cells.
  // Fail closed: suppress the whole breakdown until *every* category is safe.
  if (groups.some(({ count }) => count < minCohort)) return [];
  return groups.map(({ category, count }) => ({
    category,
    count,
    percent: Math.round((count / total) * 1000) / 10,
  }));
}
