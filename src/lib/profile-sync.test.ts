import { describe, it, expect } from "vitest";
import { changedFields, mergeSavedState } from "./profile-sync";
describe("concurrent profile persistence", () => {
  it("does not send a stale profile name when only preferences changed during a pending manual save", () => {
    const baseline = {
      id: "member",
      name: "Old name",
      extra: { gear: ["mat"] },
      updated_at: "before",
    };
    const preferences = {
      ...baseline,
      extra: { gear: ["mat", "weights"] },
      updated_at: "after",
    };
    expect(changedFields(baseline, preferences)).toEqual({
      extra: { gear: ["mat", "weights"] },
    });
  });
  it("preserves a new activity day and paid balance while applying a completed name save", () => {
    const before = {
      name: "Old name",
      activeDays: ["2026-10-26"],
      tokens: 1,
      profile: { goal: "Strength", weight: 100 },
    };
    const saved = {
      ...before,
      name: "New name",
      profile: { ...before.profile, weight: 99 },
    };
    const current = {
      ...before,
      activeDays: [...before.activeDays, "2026-10-27"],
      tokens: 2,
      profile: { ...before.profile, goal: "Endurance" },
    };
    expect(mergeSavedState(before, saved, current)).toEqual({
      ...current,
      name: "New name",
      profile: { goal: "Endurance", weight: 99 },
    });
  });
  it("keeps the most recent local edit when an older request for the same field completes", () => {
    expect(
      mergeSavedState(
        { name: "Initial" },
        { name: "First edit" },
        { name: "Second edit" },
      ),
    ).toEqual({ name: "Second edit" });
  });
});
