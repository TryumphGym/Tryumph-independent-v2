import { describe, expect, it } from "vitest";
import { validateBreaks } from "./adBreaks";

describe("water-break guardrails", () => {
  it("accepts well-spaced breaks", () => expect(validateBreaks([720, 1470], 45)).toBeNull());
  it("rejects breaks in the first 3 minutes", () => expect(validateBreaks([120], 30)).not.toBeNull());
  it("rejects breaks in the last 2 minutes", () => expect(validateBreaks([1700], 30)).not.toBeNull());
  it("rejects breaks past the end", () => expect(validateBreaks([2000], 30)).not.toBeNull());
  it("rejects breaks under 5 minutes apart", () => expect(validateBreaks([600, 840], 30)).not.toBeNull());
});
