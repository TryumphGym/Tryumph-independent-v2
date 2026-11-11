// @vitest-environment node
import { describe, expect, it } from "vitest";
import { trainerWelcomeGuides, trainerWelcomeMatch } from "./TrainerWelcomeGuides";

describe("Trainer School welcome guides", () => {
  it("shows the introduction and the full first-time guide when search is empty", () => {
    const result = trainerWelcomeMatch("");
    expect(result.introMatches).toBe(true);
    expect(result.guides).toHaveLength(trainerWelcomeGuides.length);
    expect(result.guides.length).toBeGreaterThanOrEqual(6);
  });

  it("finds onboarding guidance from title or step text", () => {
    expect(trainerWelcomeMatch("CPR/AED").guides.some((g) =>
      g.title.includes("profile"),
    )).toBe(true);
    expect(trainerWelcomeMatch("PDF").guides.some((g) =>
      g.title.includes("program"),
    )).toBe(true);
    expect(trainerWelcomeMatch("water-break").guides.some((g) =>
      g.title.includes("workout"),
    )).toBe(true);
  });

  it("does not hide the welcome introduction when someone searches for Tryumph", () => {
    expect(trainerWelcomeMatch("what is tryumph").introMatches).toBe(true);
  });

  it("returns no welcome results for an unrelated query", () => {
    const result = trainerWelcomeMatch("zz__not_a_topic__zz");
    expect(result.introMatches).toBe(false);
    expect(result.guides).toHaveLength(0);
  });

  it("links every topic to a known trainer Studio section", () => {
    const sections = [
      "settings",
      "content-library",
      "trybe-community",
      "live-studio",
      "programs",
      "earnings-payouts",
      "analytics",
    ];
    for (const guide of trainerWelcomeGuides) {
      expect(sections).toContain(guide.section);
      expect(guide.steps.length).toBeGreaterThan(1);
    }
  });
});
