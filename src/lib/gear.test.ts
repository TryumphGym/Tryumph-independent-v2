import { describe, it, expect } from "vitest";
import { fitsGear, fitScore, gearOf, encodeEquipment, friendlyOf } from "./data";
describe("gear & health recommendations", () => {
  it("workout fits only when member owns all its gear", () => {
    expect(fitsGear("Dumbbells, Yoga ball", ["Dumbbells"])).toBe(false);
    expect(fitsGear("Dumbbells, Yoga ball", ["Dumbbells", "Yoga ball"])).toBe(true);
    expect(fitsGear("No equipment", ["Mat"])).toBe(true);
  });
  it("no saved gear shows everything", () => expect(fitsGear("Kettlebell", [])).toBe(true));
  it("encodes and reads gear and health tags", () => {
    const e = encodeEquipment(["Sliders"], ["Knee friendly"]);
    expect(gearOf(e)).toEqual(["Sliders"]);
    expect(friendlyOf({ equipment: e })).toEqual(["Knee friendly"]);
  });
  it("knee-friendly match boosts, missing gear demotes", () => {
    expect(fitScore({ equipment: "Mat", friendly: ["Knee friendly"] }, ["Mat"], ["Knee friendly"])).toBe(3);
    expect(fitScore({ equipment: "Kettlebell" }, ["Mat"], [])).toBe(-6);
  });
});
