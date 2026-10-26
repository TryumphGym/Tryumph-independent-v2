import { describe, expect, it } from "vitest";
import { dayName, isTaken, openTimes, type BusyRow } from "./availability";

// 2026-10-11 Sun · 2026-10-12 Mon · 2026-10-13 Tue
const personalAll: BusyRow[] = [
  { day: "2026-10-13", time: "ALL", source: "personal" },
];
const personalOne: BusyRow[] = [
  { day: "2026-10-13", time: "15:00", source: "personal" },
];
const paid: BusyRow[] = [
  { day: "2026-10-13", time: "19:00", source: "booked" },
];

describe("1-on-1 booking checks the trainer's calendar", () => {
  it("names the weekday of an ISO date", () => {
    expect(dayName("2026-10-11")).toBe("Sun");
    expect(dayName("2026-10-13")).toBe("Tue");
  });

  it("keeps a whole closed day unbookable", () => {
    expect(
      isTaken("maya", "2026-10-11", "12:00", [
        { day: "2026-10-11", time: "ALL", source: "personal" },
      ]),
    ).toBe(true); // Maya is off Sundays
    expect(isTaken("dre", "2026-10-13", "19:00", personalAll)).toBe(true);
  });

  it("blocks a recurring time the trainer is never free", () => {
    expect(
      isTaken("maya", "2026-10-12", "09:00", [
        { day: "2026-10-12", time: "09:00", source: "personal" },
      ]),
    ).toBe(true);
    expect(
      isTaken("maya", "2026-10-12", "12:00", [
        { day: "2026-10-11", time: "ALL", source: "personal" },
      ]),
    ).toBe(false);
  });

  it("blocks only the exact time when the trainer blocked part of a day", () => {
    expect(isTaken("dre", "2026-10-13", "15:00", personalOne)).toBe(true);
    expect(isTaken("dre", "2026-10-13", "19:00", personalOne)).toBe(false);
  });

  it("holds a slot another client already paid for", () => {
    expect(isTaken("dre", "2026-10-13", "19:00", paid)).toBe(true);
  });

  it("does not carry a block onto other days", () => {
    expect(isTaken("dre", "2026-10-14", "19:00", personalAll)).toBe(false);
  });

  it("lists only genuinely open times", () => {
    expect(
      openTimes("lena", "2026-10-11", [
        { day: "2026-10-11", time: "ALL", source: "personal" },
      ]),
    ).toEqual([]); // Lena is off weekends
    expect(openTimes("lena", "2026-10-13", paid)).toEqual([
      "07:00",
      "09:00",
      "12:00",
      "15:00",
    ]);
  });

  it("refuses until a date and time are picked", () => {
    expect(isTaken("maya", "", "", [])).toBe(true);
  });
});
