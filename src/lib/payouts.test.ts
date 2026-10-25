import { describe, expect, it } from "vitest";
import { split } from "./payouts.server";

describe("trainer payouts are after fees", () => {
  it("1-on-1: trainer gets 90% of the amount after fees", () => {
    expect(split(10000, 320, "oneonone")).toEqual({ net: 9680, payout: 8712, pct: 90 });
  });
  it("live: trainer gets 50% of a token after fees", () => {
    expect(split(500, 21, "live").payout).toBe(239);
  });
  it("ads: trainer gets 50% of ad revenue after fees", () => {
    expect(split(1000, 100, "ads").payout).toBe(450);
  });
});
