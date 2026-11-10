import { it, expect } from "vitest";
import { offersPrivateCoaching } from "./trainer-services";
it("preserves existing valid trainer-defined coaching rates without introducing compulsory offerings", () => {
  expect(offersPrivateCoaching({ rate: 55 })).toBe(true);
  expect(offersPrivateCoaching({ rate: 0 })).toBe(false);
  expect(offersPrivateCoaching({ rate: NaN })).toBe(false);
});
it("honors program-only/live-only trainers who explicitly opt out of coaching even with a historical price", () => {
  expect(offersPrivateCoaching({ rate: 55, services: [] })).toBe(false);
  expect(
    offersPrivateCoaching({ rate: 55, services: ["programs", "live"] }),
  ).toBe(false);
  expect(offersPrivateCoaching({ rate: 55, services: ["coaching"] })).toBe(
    true,
  );
});
