import { describe, it, expect } from "vitest";
import {
  newProgram,
  programDraftSchema,
  programSchema,
  programProgress,
  moveProgramItem,
  programSplit,
  PROGRAM_SAFETY,
} from "./programs";
const video = "11111111-1111-4111-8111-111111111111";
function complete() {
  const p = newProgram();
  p.title = "A real trainer program";
  p.weeks[0]!.days[0]!.workouts = [
    { id: crypto.randomUUID(), video_id: video, instructions: "Move slowly" },
  ];
  return p;
}
describe("program input, safety, ordering and progress", () => {
  it("allows unfinished drafts but requires approved workout references before submission", () => {
    const p = newProgram();
    p.title = "Draft";
    expect(programDraftSchema.safeParse(p).success).toBe(true);
    expect(programSchema.safeParse(p).success).toBe(false);
  });
  it("rejects unsupported prices and unsafe external links without assuming commission", () => {
    const p = complete();
    expect(
      programSchema.safeParse({ ...p, mode: "native", price_cents: 0 }).success,
    ).toBe(false);
    expect(
      programSchema.safeParse({
        ...p,
        mode: "external",
        external_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      programSchema.safeParse({ ...p, mode: "free", price_cents: 500 }).success,
    ).toBe(false);
    expect(() => programSplit(10000, 300, Number.NaN)).toThrow();
    expect(programSplit(10000, 300, 500)).toEqual({
      net: 9700,
      payout: 9215,
      commission: 485,
    });
  });
  it("rejects rest days with media, duplicate step ids and unlabeled variations", () => {
    const p = complete();
    p.weeks[0]!.days[0]!.rest = true;
    expect(programSchema.safeParse(p).success).toBe(false);
    p.weeks[0]!.days[0]!.rest = false;
    p.weeks[0]!.days[0]!.workouts.push({
      ...p.weeks[0]!.days[0]!.workouts[0]!,
    });
    expect(programSchema.safeParse(p).success).toBe(false);
    p.weeks[0]!.days[0]!.workouts.pop();
    p.weeks[0]!.days[0]!.workouts[0]!.variations = [
      { id: crypto.randomUUID(), label: "", video_id: video, instructions: "" },
    ];
    expect(programSchema.safeParse(p).success).toBe(false);
  });
  it("preserves primary step identity and chooses the next uncompleted workout when resuming", () => {
    const p = complete(),
      first = p.weeks[0]!.days[0]!.workouts[0]!;
    const second = {
      id: crypto.randomUUID(),
      video_id: video,
      instructions: "Repeat the same clip",
    };
    p.weeks[0]!.days[0]!.workouts.push(second);
    const result = programProgress(p, [
      {
        step_id: first.id,
        completed: true,
        resumed_at: "2026-10-31T01:00:00Z",
      },
    ]);
    expect(result).toMatchObject({ completed: 1, total: 2, percent: 50 });
    expect(result.resume?.id).toBe(second.id);
    expect(moveProgramItem([first, second], 0, 1).map((s) => s.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(moveProgramItem([first, second], 0, -1)).toEqual([first, second]);
    expect(PROGRAM_SAFETY).toContain(
      "Do not assume exercising while holding a baby is safe",
    );
  });
});

describe("program intervals and clearly separate cost estimates", () => {
  it("derives client work/rest boundaries without mutating the interval plan", async () => {
    const { programPhase } = await import("./programs");
    const plan = [
      {
        id: crypto.randomUUID(),
        label: "Work",
        kind: "work" as const,
        seconds: 30,
      },
      {
        id: crypto.randomUUID(),
        label: "Rest",
        kind: "rest" as const,
        seconds: 15,
      },
    ];
    expect(programPhase(plan, 29)).toMatchObject({ index: 0, remaining: 1 });
    expect(programPhase(plan, 30)).toMatchObject({
      index: 1,
      remaining: 15,
      phase: { kind: "rest" },
    });
    expect(programPhase(plan, 45)).toBeNull();
    expect(plan[0]!.seconds).toBe(30);
  });
  it("requires configured estimate rates and keeps the approved split independent of hosting", async () => {
    const { estimateProgramUsage } = await import("./programs");
    expect(
      estimateProgramUsage(
        { reported_seconds: 3600, playback_sessions: 10 },
        { gbPerHour: null, usdPerGb: null, usdPerThousandSessions: null },
      ),
    ).toEqual({
      estimatedGb: null,
      estimatedBandwidthUsd: null,
      estimatedInfrastructureUsd: null,
    });
    expect(
      estimateProgramUsage(
        { reported_seconds: 3600, playback_sessions: 10 },
        { gbPerHour: 2, usdPerGb: 0.01, usdPerThousandSessions: 0.5 },
      ),
    ).toEqual({
      estimatedGb: 2,
      estimatedBandwidthUsd: 0.02,
      estimatedInfrastructureUsd: 0.005,
    });
    expect(programSplit(5000, 175, 500)).toEqual({
      net: 4825,
      payout: 4583,
      commission: 242,
    });
    expect(programSplit(5000, 175, 500, 1000)).toEqual({
      net: 3825,
      payout: 3633,
      commission: 192,
    });
  });
});
