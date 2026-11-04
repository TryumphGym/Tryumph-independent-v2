import { z } from "zod";
import { isLaunchWorkout } from "./launch";
import { safeExternalUrl } from "./launch-features";
const text = (max: number) => z.string().max(max);
const url = z
  .string()
  .max(2048)
  .refine((v) => !v || safeExternalUrl(v), "Use an HTTPS URL");
export const programVariationSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string().trim().min(1).max(80),
    video_id: z.string().uuid().optional(),
    description: z.string().max(2000).optional(),
    equipment: z.array(z.string().max(100)).max(20).optional(),
    safety_notes: z.string().max(2000).optional(),
    image_id: z.string().uuid().optional(),
    instructions: z.string().max(2000),
  })
  .strict();
export const programExerciseSchema = programVariationSchema.extend({
  variations: z.array(programVariationSchema).max(6).optional(),
});
export const programIntervalSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string().max(80),
    kind: z.enum(["work", "rest"]),
    seconds: z.number().int().min(1).max(3600),
    exercise_id: z.string().uuid().optional(),
  })
  .strict();
export const programWorkoutSchema = z
  .object({
    id: z.string().uuid(),
    video_id: z.string().uuid().optional(),
    title: z.string().max(180).optional(),
    instructions: text(4000),
    duration_seconds: z.number().int().min(0).max(18000).optional(),
    variations: z.array(programVariationSchema).max(6).optional(),
    exercises: z.array(programExerciseSchema).max(40).optional(),
    intervals: z.array(programIntervalSchema).max(50).optional(),
  })
  .strict();
export const programDaySchema = z
  .object({
    id: z.string().uuid(),
    title: text(160),
    rest: z.boolean(),
    instructions: text(4000),
    workouts: z.array(programWorkoutSchema).max(20),
  })
  .strict()
  .refine(
    (d) => !d.rest || d.workouts.length === 0,
    "Rest days cannot contain workouts",
  );
export const programDraftSchema = z
  .object({
    product_type: z
      .enum(["workout_program", "video_course", "challenge", "download"])
      .default("workout_program"),
    downloads: z.array(z.string().uuid()).max(20).default([]),
    discovery_tags: z.array(z.string()).max(24).default([]),
    intensity: z.enum(["", "gentle", "moderate", "challenging"]).default(""),
    title: z.string().trim().min(1).max(160),
    description: text(4000),
    cover_url: url,
    category: z
      .string()
      .min(1)
      .max(80)
      .refine(
        (category) => isLaunchWorkout({ category }),
        "This category is not available at launch",
      ),
    goals: z.array(z.string().max(100)).max(30),
    difficulty: z.enum(["Beginner", "Intermediate", "Advanced", "All levels"]),
    equipment: z.array(z.string().max(100)).max(30),
    pregnancy: z.enum(["not_assessed", "trainer_labeled", "not_suitable"]),
    postpartum: z.enum(["not_assessed", "trainer_labeled", "not_suitable"]),
    suitability_notes: text(2000),
    access_period: z.enum(["30", "90", "lifetime"]),
    mode: z.enum(["free", "native", "external", "members"]),
    subscription_access: z.boolean().default(false),
    price_cents: z.number().int().min(0).max(1000000),
    external_url: url,
    weeks: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            title: text(160),
            days: z.array(programDaySchema).min(1).max(7),
          })
          .strict(),
      )
      .min(1)
      .max(52),
  })
  .strict()
  .superRefine((p, c) => {
    if (p.mode === "native" && p.price_cents < 50)
      c.addIssue({
        code: "custom",
        message: "Native programs require a price of at least $0.50.",
      });
    if ((p.mode === "free" || p.mode === "members") && p.price_cents !== 0)
      c.addIssue({
        code: "custom",
        message: "Free programs must have a zero price.",
      });
    if (p.mode === "external" && !p.external_url)
      c.addIssue({
        code: "custom",
        message: "An external purchase URL is required.",
      });
    const ids = new Set<string>();
    let count = 0;
    for (const w of p.weeks) {
      if (ids.has(w.id))
        c.addIssue({
          code: "custom",
          message: "Week identifiers must be unique",
        });
      ids.add(w.id);
      for (const d of w.days) {
        for (const id of [
          d.id,
          ...d.workouts.flatMap((s) => [
            s.id,
            ...(s.variations ?? []).map((v) => v.id),
            ...(s.exercises ?? []).flatMap((ex) => [
              ex.id,
              ...(ex.variations ?? []).map((v) => v.id),
            ]),
            ...(s.intervals ?? []).map((v) => v.id),
          ]),
        ]) {
          if (ids.has(id))
            c.addIssue({
              code: "custom",
              message: "Day and workout identifiers must be unique.",
            });
          ids.add(id);
        }
        for (const step of d.workouts) {
          if ((step.intervals ?? []).reduce((n, p) => n + p.seconds, 0) > 18000)
            c.addIssue({
              code: "custom",
              message: "Interval plan exceeds five hours",
            });
          for (const phase of step.intervals ?? [])
            if (
              phase.exercise_id &&
              !step.exercises?.some((ex) => ex.id === phase.exercise_id)
            )
              c.addIssue({
                code: "custom",
                message: "Interval references an unknown exercise",
              });
        }
        count += d.workouts.length;
      }
    }
    if (count > 500)
      c.addIssue({ code: "custom", message: "Use at most 500 workouts." });
  });
export const programSchema = programDraftSchema.superRefine((p, c) => {
  if (p.product_type === "download") {
    if (!p.downloads.length)
      c.addIssue({
        code: "custom",
        message: "Add an approved PDF before submitting",
      });
  } else if (!p.weeks.some((w) => w.days.some((d) => d.workouts.length)))
    c.addIssue({
      code: "custom",
      message: "Add at least one approved workout before submitting",
    });
  if (
    p.weeks.some((w) => w.days.some((d) => d.workouts.some((s) => !s.video_id)))
  )
    c.addIssue({
      code: "custom",
      message: "Complete all included workouts before submitting",
    });
});
export type FitnessProgram = z.infer<typeof programDraftSchema>;
export type ProgramDay = z.infer<typeof programDaySchema>;
export type ProgramVariation = z.infer<typeof programVariationSchema>;
export type ProgramExercise = z.infer<typeof programExerciseSchema>;
export type ProgramInterval = z.infer<typeof programIntervalSchema>;
export type ProgramWorkout = z.infer<typeof programWorkoutSchema>;
export type ProgramSummary = Omit<FitnessProgram, "weeks"> & {
  duration_weeks: number;
  included_schedule?: {
    title: string;
    days: {
      title: string;
      rest: boolean;
      workouts: {
        title: string;
        duration_seconds: number;
        available: boolean;
      }[];
    }[];
  }[];
};
export const PROGRAM_SAFETY =
  "Suitability labels are trainer-supplied, not medical clearance. Pregnancy and postpartum recovery vary. Ask your clinician about appropriate activity. Do not assume exercising while holding a baby is safe; place your baby in a safe space before exercising.";
export const newProgramDay = (): ProgramDay => ({
  id: crypto.randomUUID(),
  title: "Training day",
  rest: false,
  instructions: "",
  workouts: [],
});
export const newProgram = (): FitnessProgram => ({
  product_type: "workout_program",
  intensity: "",
  downloads: [],
  discovery_tags: [],
  title: "",
  description: "",
  cover_url: "",
  category: "Strength",
  goals: [],
  difficulty: "Beginner",
  equipment: [],
  pregnancy: "not_assessed",
  postpartum: "not_assessed",
  suitability_notes: "",
  mode: "free",
  subscription_access: false,
  access_period: "lifetime",
  price_cents: 0,
  external_url: "",
  weeks: [
    { id: crypto.randomUUID(), title: "Week 1", days: [newProgramDay()] },
  ],
});
export function programSteps(p: FitnessProgram) {
  return p.weeks.flatMap((w, wi) =>
    w.days.flatMap((d, di) =>
      d.workouts.map((s) => ({ ...s, week: wi, day: di, dayTitle: d.title })),
    ),
  );
}
export function programProgress(
  p: FitnessProgram,
  rows: { step_id: string; completed: boolean; resumed_at: string }[],
) {
  const steps = programSteps(p),
    valid = new Set(steps.map((s) => s.id));
  const complete = new Set(
    rows
      .filter((r) => r.completed && valid.has(r.step_id))
      .map((r) => r.step_id),
  );
  const last = [...rows]
    .filter((r) => valid.has(r.step_id))
    .sort((a, b) => b.resumed_at.localeCompare(a.resumed_at))[0];
  const resume =
    steps.find((s) => s.id === last?.step_id && !complete.has(s.id)) ??
    steps.find((s) => !complete.has(s.id)) ??
    steps[0];
  return {
    completed: complete.size,
    total: steps.length,
    percent: steps.length
      ? Math.round((complete.size * 100) / steps.length)
      : 0,
    resume,
  };
}
export function moveProgramItem<T>(items: T[], index: number, delta: number) {
  const result = [...items],
    next = index + delta;
  if (next < 0 || next >= items.length) return result;
  [result[index], result[next]] = [result[next]!, result[index]!];
  return result;
}
export function programSplit(
  gross: number,
  fee: number,
  bps: number,
  refunded = 0,
) {
  if (
    ![gross, fee, bps, refunded].every(Number.isSafeInteger) ||
    gross < 0 ||
    refunded < 0 ||
    refunded > gross ||
    fee < 0 ||
    fee > gross ||
    bps < 0 ||
    bps > 10000
  )
    throw new Error("Invalid program processing allocation");
  const net = Math.max(0, gross - refunded - fee);
  return {
    net,
    payout: Math.floor((net * (10000 - bps)) / 10000),
    commission: net - Math.floor((net * (10000 - bps)) / 10000),
  };
}

export type ProgramMetrics = Record<
  string,
  {
    enrollments: number;
    sales: number;
    gross: number;
    refunded: number;
    fees: number;
    payable: number;
    transferred: number;
  }
>;

export function programPhase(
  intervals: ProgramInterval[] | undefined,
  elapsed: number,
) {
  let start = 0;
  for (let i = 0; i < (intervals?.length ?? 0); i++) {
    const phase = intervals![i]!;
    if (elapsed < start + phase.seconds)
      return {
        phase,
        index: i,
        remaining: Math.max(0, start + phase.seconds - elapsed),
      };
    start += phase.seconds;
  }
  return null;
}
export const programAccessLabel = (period: string | undefined) =>
  period === "lifetime"
    ? "Lifetime access"
    : `${period ?? "30"} days from confirmation`;
export type ProgramReportRow = {
  program_id: string;
  title: string;
  trainer_id: string;
  sales: number;
  gross_cents: number;
  refunded_cents: number;
  processing_cents: number;
  trainer_cents: number;
  platform_cents: number;
  held_orders: number;
  playback_sessions: number;
  reported_seconds: number;
};
export function estimateProgramUsage(
  row: Pick<ProgramReportRow, "reported_seconds" | "playback_sessions">,
  rates: {
    gbPerHour: number | null;
    usdPerGb: number | null;
    usdPerThousandSessions: number | null;
  },
) {
  const estimatedGb =
    rates.gbPerHour === null
      ? null
      : (row.reported_seconds / 3600) * rates.gbPerHour;
  return {
    estimatedGb,
    estimatedBandwidthUsd:
      estimatedGb === null || rates.usdPerGb === null
        ? null
        : estimatedGb * rates.usdPerGb,
    estimatedInfrastructureUsd:
      rates.usdPerThousandSessions === null
        ? null
        : (row.playback_sessions / 1000) * rates.usdPerThousandSessions,
  };
}
