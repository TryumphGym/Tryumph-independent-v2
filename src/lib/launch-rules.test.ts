import { describe, it, expect } from "vitest";
import { hasVerifiedCpr } from "./cpr";
import { matchesWorkout, isSafetyCompatible } from "./workout-preferences";
import { nextWaterBreak, validateBreaks, parseBreaks } from "./adBreaks";
import { split } from "./payouts.server";
const prefs = {
  level: "Beginner",
  styles: ["Yoga"],
  gear: ["Dumbbells"],
  needs: [],
  quiet: false,
  equipmentChosen: true,
  goals: ["Stress relief"],
};
describe("launch business rules", () => {
  it("requires separately verified, current CPR and AED", () => {
    const credential = {
      status: "verified",
      expires: "2099-01-01",
      verified_at: "2026-10-26",
      verified_by: "admin",
    };
    expect(hasVerifiedCpr([{ ...credential, name: "CPR" }])).toBe(false);
    expect(hasVerifiedCpr([{ ...credential, name: "CPR/AED" }])).toBe(true);
    expect(
      hasVerifiedCpr([
        { ...credential, name: "CPR/AED", expires: "2020-01-01" },
      ]),
    ).toBe(false);
    expect(
      hasVerifiedCpr([{ ...credential, name: "CPR/AED", verified_by: null }]),
    ).toBe(false);
  });
  it("keeps no-equipment workouts eligible regardless of owned gear", () => {
    expect(
      matchesWorkout(
        { category: "Yoga", level: "Beginner", required_equipment: [] },
        prefs,
      ),
    ).toBe(true);
    expect(
      matchesWorkout(
        {
          category: "Yoga",
          level: "Beginner",
          required_equipment: ["No equipment"],
        },
        { ...prefs, gear: [] },
      ),
    ).toBe(true);
  });
  it("honors goals and never broadens explicit safety preferences", () => {
    expect(
      matchesWorkout(
        { category: "Yoga", level: "Beginner", goals: ["Build muscle & tone"] },
        prefs,
      ),
    ).toBe(false);
    expect(
      isSafetyCompatible(
        { category: "Yoga", level: "Beginner" },
        { ...prefs, pregnant: true },
      ),
    ).toBe(false);
    expect(
      isSafetyCompatible(
        { category: "Yoga", level: "Beginner" },
        { ...prefs, needs: ["Knee friendly"] },
      ),
    ).toBe(false);
  });
  it("never interrupts videos with zero or invalid water breaks", () => {
    expect(nextWaterBreak([], new Set(), 179, 180, 20)).toBeNull();
    expect(nextWaterBreak([NaN], new Set(), 179, 180, 20)).toBeNull();
    expect(validateBreaks(parseBreaks("not-a-time"), 20)).not.toBeNull();
    expect(validateBreaks([Infinity], 20)).not.toBeNull();
  });
  it("starts only at natural marked crossings; seeking and replay cannot repeat a break", () => {
    expect(nextWaterBreak([180], new Set(), 179, 180, 20)).toBe(180);
    expect(nextWaterBreak([180], new Set(), 0, 180, 20)).toBeNull();
    expect(nextWaterBreak([180], new Set([180]), 179, 180, 20)).toBeNull();
  });
  it("splits actual processing fees first, rounding the trainer share down to cents", () => {
    expect(split(500, 50, "live")).toEqual({ net: 450, payout: 225, pct: 50 });
    expect(split(1000, 100, "oneonone").payout).toBe(810);
    expect(split(501, 50, "ads").payout).toBe(225);
    // There is no infrastructure-fee parameter: hosting costs cannot reduce the shareable amount.
  });
});
