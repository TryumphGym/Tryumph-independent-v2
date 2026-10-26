// Pure availability rules — no browser or server clients here so both sides can use them.
import { TRAINING_TIMES, trainers } from "./data";

export type BusyRow = { day: string; time: string; source: string };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "2026-10-11" -> "Sun" (local-safe: parsed at noon so timezones can't shift the day). */
export function dayName(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return DAY_NAMES[d.getDay()] ?? "";
}

/** Is this trainer's slot unavailable? Whole-day rows ("ALL"), a specific time, a paid booking, or the trainer's weekly pattern. */
export function isTaken(
  trainerId: string,
  date: string,
  time: string,
  rows: BusyRow[],
): boolean {
  if (!date || !time) return true;
  // Actual calendar records are the source of truth; no demo trainer schedules.
  return rows.some(
    (r) => r.day === date && (r.time === "ALL" || r.time === time),
  );
}

/** Which of the trainer's bookable times are still open on a date. */
export function openTimes(
  trainerId: string,
  date: string,
  rows: BusyRow[],
): string[] {
  return TRAINING_TIMES.filter((x) => !isTaken(trainerId, date, x, rows));
}
