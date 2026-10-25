import { describe, it, expect } from "vitest";
import { canSubmitCoach } from "./data";
describe("coach application", () => {
  it("adult without certification cannot submit", () => expect(canSubmitCoach(0, "none")).toBe(false));
  it("adult with a certification can submit", () => expect(canSubmitCoach(1, "none")).toBe(true));
  it("youth with guardian consent sent can submit", () => expect(canSubmitCoach(0, "pending")).toBe(true));
  it("rejected youth without certification cannot submit", () => expect(canSubmitCoach(0, "rejected")).toBe(false));
});
