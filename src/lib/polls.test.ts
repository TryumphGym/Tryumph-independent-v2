import { describe, it, expect } from "vitest";
import { pollInput, pollPercent, localPollDeadline } from "./polls";
const valid = {
  trybe: "coach-123",
  question: "When should we meet?",
  description: "Research only",
  options: ["Morning", "Evening"],
  maxSelections: 1,
  expiresAt: null,
  notify: false,
  public: false,
};
describe("poll inputs and aggregate display", () => {
  it("validates questions, distinct trimmed options, limits and future expiration", () => {
    expect(pollInput.parse(valid).options).toEqual(["Morning", "Evening"]);
    for (const change of [
      { question: " " },
      { options: ["Morning", " morning "] },
      { options: ["One"] },
      { maxSelections: 3 },
      { expiresAt: "2020-01-01T00:00:00Z" },
    ])
      expect(pollInput.safeParse({ ...valid, ...change }).success).toBe(false);
  });
  it("supports zero-vote percentages and multiple-choice totals above 100%", () => {
    expect(pollPercent(0, 0)).toBe(0);
    expect(pollPercent(2, 3)).toBe(67);
    expect(pollPercent(1, 1) + pollPercent(1, 1)).toBe(200);
  });
  it("converts a viewer-local deadline to an instant without inventing an expiration", () => {
    expect(localPollDeadline("")).toBeNull();
    expect(localPollDeadline("2027-01-01T09:00")).toBe(
      new Date("2027-01-01T09:00").toISOString(),
    );
    expect(() => localPollDeadline("invalid")).toThrow("valid local");
  });
});
