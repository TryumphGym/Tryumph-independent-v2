import { describe, expect, it } from "vitest";
import { prepareAggregateReport } from "./aggregate";

describe("Tryumph Insights aggregate disclosure guard", () => {
  it("returns complete sufficiently large groups", () => {
    expect(prepareAggregateReport([{ category: "HIIT", count: 120 }, { category: "Strength", count: 80 }], 200)).toEqual([
      { category: "HIIT", count: 120, percent: 60 },
      { category: "Strength", count: 80, percent: 40 },
    ]);
  });
  it("suppresses a breakdown containing a small group", () => {
    expect(prepareAggregateReport([{ category: "HIIT", count: 190 }, { category: "Other", count: 10 }], 200)).toEqual([]);
  });
  it("rejects totals that do not equal all categories", () => {
    expect(() => prepareAggregateReport([{ category: "HIIT", count: 190 }], 200)).toThrow();
  });
  it("does not permit lowering the disclosure threshold", () => {
    expect(() => prepareAggregateReport([{ category: "HIIT", count: 20 }], 20, 1)).toThrow();
  });
});
