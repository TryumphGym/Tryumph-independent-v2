import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  save: vi.fn(),
  submit: vi.fn(),
  metrics: vi.fn(),
}));
vi.mock("@/lib/community", () => ({
  useUserId: () => "11111111-1111-4111-8111-111111111111",
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("./PrivateVideoPreview", () => ({
  PrivateVideoPreview: () => <button type="button">Private preview</button>,
}));
vi.mock("@/lib/programs.functions", () => ({
  saveFitnessProgram: f.save,
  submitFitnessProgram: f.submit,
  getTrainerProgramMetrics: f.metrics,
  setFitnessProgramVisibility: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const r = {
        data:
          table === "trainer_videos"
            ? [
                {
                  id: "22222222-2222-4222-8222-222222222222",
                  title: "Public approved",
                  minutes: 20,
                  access_scope: "public",
                },
                {
                  id: "33333333-3333-4333-8333-333333333333",
                  title: "Protected approved",
                  minutes: 10,
                  access_scope: "program",
                },
              ]
            : [],
        error: null,
      };
      const b = {
        select: () => b,
        eq: () => b,
        like: () => b,
        not: () => b,
        order: () => b,
        then: (resolve: (x: unknown) => unknown) =>
          Promise.resolve(r).then(resolve),
      };
      return b;
    },
  },
}));
import { TrainerProgramBuilder } from "./TrainerProgramBuilder";
beforeEach(() => {
  f.save.mockReset().mockResolvedValue("44444444-4444-4444-8444-444444444444");
  f.submit.mockReset();
  f.metrics.mockReset().mockResolvedValue({});
});
afterEach(cleanup);
describe("connected trainer program form", () => {
  it("saves weeks, rest days, ordered approved workouts, variation labels/media and a fixed timer", async () => {
    render(<TrainerProgramBuilder />);
    await screen.findByRole("option", { name: /Public approved/ });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "A trainer-created program" },
    });
    fireEvent.change(screen.getByLabelText("Add an approved Bunny workout"), {
      target: { value: "22222222-2222-4222-8222-222222222222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add variation" }));
    fireEvent.change(screen.getByLabelText("Variation name"), {
      target: { value: "Seated variation" },
    });
    fireEvent.change(screen.getByLabelText("Approved demonstration video"), {
      target: { value: "33333333-3333-4333-8333-333333333333" },
    });
    fireEvent.change(screen.getByLabelText(/Step timer \(seconds/), {
      target: { value: "120" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add week" }));
    fireEvent.click(screen.getAllByLabelText("Rest day")[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(f.save).toHaveBeenCalledOnce());
    const saved = f.save.mock.calls[0]![0].data.document;
    expect(saved.title).toBe("A trainer-created program");
    expect(saved.weeks).toHaveLength(2);
    expect(saved.weeks[1].days[0].rest).toBe(true);
    expect(saved.weeks[0].days[0].workouts[0]).toMatchObject({
      duration_seconds: 120,
      variations: [
        {
          label: "Seated variation",
          video_id: "33333333-3333-4333-8333-333333333333",
        },
      ],
    });
    expect(f.submit).not.toHaveBeenCalled();
  });
});

it("saves planned filming drafts, nested exercise variations, exercise reordering and interval plans", async () => {
  render(<TrainerProgramBuilder />);
  await screen.findByRole("option", { name: /Public approved/ });
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "While filming" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Add planned workout (draft only)" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add exercise step" }));
  fireEvent.change(screen.getByLabelText("Exercise name"), {
    target: { value: "Squat" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Add variation" })[1]!);
  fireEvent.change(screen.getByLabelText("Variation name"), {
    target: { value: "Bodyweight" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add exercise step" }));
  fireEvent.change(screen.getAllByLabelText("Exercise name")[1]!, {
    target: { value: "Lunge" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Move exercise 2 up" }));
  fireEvent.click(screen.getByRole("button", { name: "Add work interval" }));
  fireEvent.click(screen.getByRole("button", { name: "Add rest interval" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(f.save).toHaveBeenCalledOnce());
  const step =
    f.save.mock.calls[0]![0].data.document.weeks[0].days[0].workouts[0];
  expect(step.video_id).toBeUndefined();
  expect(step.exercises.map((ex: { label: string }) => ex.label)).toEqual([
    "Lunge",
    "Squat",
  ]);
  expect(step.exercises[1].variations[0].label).toBe("Bodyweight");
  expect(step.intervals.map((p: { kind: string }) => p.kind)).toEqual([
    "work",
    "rest",
  ]);
  expect(f.submit).not.toHaveBeenCalled();
});
