import { describe, it, expect } from "vitest";
import {
  DEFAULT_PICK,
  pickCandidates,
  pickNext,
  pickReason,
  type PickWorkout,
} from "./pick-for-me";
import { matchesDiscovery } from "./discovery";
import { EVERYDAY_TRYUMPHS, EVERYDAY_SAFETY } from "./everyday-tryumphs";
const base: PickWorkout = {
  id: "a",
  title: "Steady workout",
  minutes: 20,
  category: "Strength",
  level: "Beginner",
  equipment: "No equipment",
  discovery_tags: ["postpartum", "seated", "low_impact"],
  intensity: "gentle",
  review_status: "approved",
};
describe("safe deterministic Pick For Me", () => {
  it("honors duration and only exceeds it with explicit approximate consent", () => {
    expect(pickCandidates([base], { ...DEFAULT_PICK, minutes: 15 })).toEqual(
      [],
    );
    expect(
      pickCandidates([base], {
        ...DEFAULT_PICK,
        minutes: 15,
        approximate: true,
      }),
    ).toEqual([base]);
    expect(
      pickReason(base, { ...DEFAULT_PICK, minutes: 15, approximate: true }),
    ).toContain("approximately +5 minutes");
  });
  it("always permits no-equipment workouts and checks every required item without requiring optional equipment", () => {
    const gear = { ...base, id: "b", required_equipment: ["Dumbbells", "Mat"] };
    expect(
      pickCandidates([base, gear], {
        ...DEFAULT_PICK,
        equipment: ["Dumbbells"],
      }),
    ).toEqual([base]);
    expect(
      pickCandidates([base, gear], {
        ...DEFAULT_PICK,
        equipment: ["Dumbbells", "Mat"],
      }),
    ).toHaveLength(2);
  });
  it("combines goals, stages and accessibility without community sentiment overriding safety", () => {
    expect(
      pickCandidates([base], {
        ...DEFAULT_PICK,
        focus: ["strength", "postpartum", "seated"],
        community: ["fun"],
      }),
    ).toEqual([base]);
    expect(
      pickCandidates(
        [
          {
            ...base,
            communityTags: ["low_impact_feeling", "beginner_friendly"],
          },
        ],
        { ...DEFAULT_PICK, focus: ["prenatal", "postpartum"] },
      ),
    ).toEqual([]);
    expect(
      pickCandidates([{ ...base, discovery_tags: ["prenatal"] }], {
        ...DEFAULT_PICK,
        focus: ["prenatal"],
      }),
    ).toEqual([]);
    expect(
      pickCandidates(
        [{ ...base, pregnancy_safe: true, discovery_tags: ["prenatal"] }],
        { ...DEFAULT_PICK, focus: ["prenatal"] },
      ),
    ).toHaveLength(1);
  });
  it("does not relax unknown intensity, experience, inaccessible query results or no-match conditions", () => {
    expect(
      pickCandidates([{ ...base, intensity: "" }], {
        ...DEFAULT_PICK,
        intensity: "gentle",
      }),
    ).toEqual([]);
    expect(
      pickCandidates([{ ...base, level: "Advanced" }], {
        ...DEFAULT_PICK,
        level: "Beginner",
      }),
    ).toEqual([]);
    expect(
      pickCandidates([{ ...base, review_status: "pending" }], DEFAULT_PICK),
    ).toEqual([]);
    expect(pickNext([], [])).toBeNull();
  });
  it("rotates suitable picks without resetting preferences or reintroducing rejected candidates", () => {
    const other = { ...base, id: "b" },
      c = pickCandidates([base, other], DEFAULT_PICK);
    expect(pickNext(c, [])?.id).toBe("a");
    expect(pickNext(c, ["a"])?.id).toBe("b");
    expect(pickNext(c, ["a", "b"])?.id).toBe("a");
  });
  it("maps existing goal metadata without rewriting it and requires every chosen focus", () => {
    const old = {
      category: "Strength",
      level: "Beginner",
      equipment: "Mat | Low impact | Improve core strength",
    };
    expect(matchesDiscovery(old, ["core", "strength", "beginner"])).toBe(true);
    expect(matchesDiscovery(old, ["core", "prenatal"])).toBe(false);
    expect(old.equipment).toBe("Mat | Low impact | Improve core strength");
  });
  it("keeps curated everyday content public, attributed and accompanied by safety guidance", () => {
    expect(
      EVERYDAY_TRYUMPHS.filter((x) => x.mobility === "seated").length,
    ).toBeGreaterThan(0);
    expect(
      EVERYDAY_TRYUMPHS.every(
        (x) => x.minutes <= 2 && x.instructions && x.modification,
      ),
    ).toBe(true);
    expect(EVERYDAY_SAFETY).toContain("carrying a baby");
    expect(EVERYDAY_SAFETY).toContain("driving");
  });
});
