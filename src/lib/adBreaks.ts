// Guardrails so trainer-marked water breaks can't break playback or spam ads.
export const BREAK_LENGTHS = [15, 30] as const;
export const WARMUP_SECS = 180; // no breaks in the first 3 minutes
export const COOLDOWN_SECS = 120; // no breaks in the last 2 minutes
export const MIN_GAP_SECS = 300; // breaks at least 5 minutes apart

export function validateBreaks(secs: number[], minutes: number): string | null {
  if (
    secs.length &&
    (!Number.isFinite(minutes) ||
      minutes <= 0 ||
      secs.some((s) => !Number.isSafeInteger(s) || s < 0))
  )
    return "Enter valid timestamps and workout duration.";
  const total = minutes * 60;
  const sorted = [...secs].sort((a, b) => a - b);
  for (const s of sorted) {
    if (total && s >= total) return "A break is past the end of the video.";
    if (s < WARMUP_SECS)
      return "No breaks during the first 3 minutes (warm-up).";
    if (total && s > total - COOLDOWN_SECS)
      return "No breaks during the last 2 minutes (cool-down).";
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! - sorted[i - 1]! < MIN_GAP_SECS)
      return "Breaks need to be at least 5 minutes apart.";
  }
  return null;
}

export function parseBreaks(value: string): number[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (!/^\d+:[0-5]\d$/.test(s)) return NaN;
      const [minutes, seconds] = s.split(":").map(Number);
      return minutes! * 60 + seconds!;
    });
}
/** Seeking across a break never starts an advertisement during exercise. */
export function nextWaterBreak(
  markers: number[],
  done: ReadonlySet<number>,
  previous: number,
  current: number,
  minutes: number,
) {
  if (
    validateBreaks(markers, minutes) ||
    !Number.isFinite(current) ||
    current < previous ||
    current - previous > 3
  )
    return null;
  return (
    markers.find(
      (second) => !done.has(second) && previous < second && current >= second,
    ) ?? null
  );
}
