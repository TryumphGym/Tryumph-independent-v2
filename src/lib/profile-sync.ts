/** Send only fields changed locally; unrelated saved fields must not be replaced
 * by a stale whole-profile snapshot. Financial/activity authority stays in SQL. */
export function changedFields<T extends object>(
  before: T,
  after: T,
): Partial<T> {
  return Object.fromEntries(
    Object.keys(after)
      .filter(
        (key) =>
          key !== "id" &&
          key !== "updated_at" &&
          JSON.stringify(before[key as keyof T]) !==
            JSON.stringify(after[key as keyof T]),
      )
      .map((key) => [key, after[key as keyof T]]),
  ) as Partial<T>;
}
/** A manual save can finish after a newer edit or authoritative balance refresh.
 * Apply its intended changes while retaining concurrent changes in memory. */
export function mergeSavedState<T>(before: T, saved: T, current: T): T {
  const equal = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  if (equal(before, saved)) return current;
  if (equal(before, current)) return saved;
  if (
    before &&
    saved &&
    current &&
    typeof before === "object" &&
    typeof saved === "object" &&
    typeof current === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(saved) &&
    !Array.isArray(current)
  ) {
    const result = { ...current };
    for (const key of Object.keys(saved) as (keyof T)[])
      result[key] = mergeSavedState(before[key], saved[key], current[key]);
    return result;
  }
  return current;
}
