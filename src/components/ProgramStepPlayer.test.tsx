import {
  act,
  fireEvent,
  render,
  screen,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({ video: vi.fn(), checkpoint: vi.fn() }));
vi.mock("@/lib/programs.functions", () => ({
  getProgramVideo: f.video,
  checkpointProgramStep: f.checkpoint,
  reportProgramUsage: vi.fn().mockResolvedValue(true),
}));
vi.mock("./OnDemandPlayer", () => ({
  OnDemandPlayer: ({
    initialUrl,
    synchronization,
  }: {
    initialUrl: string;
    synchronization: { onPause: () => void; onPlay: () => void };
  }) => (
    <div>
      <span data-testid="demo-media">{initialUrl}</span>
      <button onClick={synchronization.onPause}>Media pause</button>
      <button onClick={synchronization.onPlay}>Media play</button>
    </div>
  ),
}));
import { ProgramStepPlayer } from "./ProgramStepPlayer";
const step = {
  id: "11111111-1111-4111-8111-111111111111",
  video_id: "22222222-2222-4222-8222-222222222222",
  title: "Work step",
  instructions: "Steady movement",
  duration_seconds: 90,
  variations: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      label: "Seated variation",
      video_id: "44444444-4444-4444-8444-444444444444",
      instructions: "Trainer-defined demonstration",
    },
  ],
};
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "Date",
      "performance",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  });
  f.video
    .mockReset()
    .mockImplementation(
      async ({ data }: { data: { variationId?: string } }) => ({
        url: data.variationId ? "signed-alternate" : "signed-primary",
        expiresAt: Date.now() + 900000,
        video: {
          id: data.variationId ?? step.video_id,
          title: "Approved",
          minutes: 20,
          breaks: [],
          break_seconds: 0,
        },
      }),
    );
  f.checkpoint.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
describe("member variation selection and a synchronized step clock", () => {
  it("switches approved media without restarting elapsed time or changing the original duration", async () => {
    render(
      <ProgramStepPlayer
        editionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        step={step}
        onClose={() => {}}
      />,
    );
    await flush();
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByTestId("program-step-timer")).toHaveTextContent(
      "0:30 / 1:30",
    );
    fireEvent.change(screen.getByLabelText("Exercise variation"), {
      target: { value: step.variations[0]!.id },
    });
    await flush();
    expect(screen.getByTestId("demo-media")).toHaveTextContent(
      "signed-alternate",
    );
    expect(screen.getByTestId("program-step-timer")).toHaveTextContent(
      "0:30 / 1:30",
    );
    act(() => vi.advanceTimersByTime(15000));
    expect(screen.getByTestId("program-step-timer")).toHaveTextContent(
      "0:45 / 1:30",
    );
    expect(f.video).toHaveBeenLastCalledWith({
      data: {
        editionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        stepId: step.id,
        variationId: step.variations[0]!.id,
      },
    });
  });
  it("keeps pause/resume synchronized through a variation change and restores a checkpoint", async () => {
    render(
      <ProgramStepPlayer
        editionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        step={step}
        initialElapsed={20}
        onClose={() => {}}
      />,
    );
    await flush();
    act(() => vi.advanceTimersByTime(10000));
    fireEvent.click(screen.getByText("Media pause"));
    await flush();
    fireEvent.change(screen.getByLabelText("Exercise variation"), {
      target: { value: step.variations[0]!.id },
    });
    await flush();
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByTestId("program-step-timer")).toHaveTextContent(
      "0:30 / 1:30",
    );
    fireEvent.click(screen.getByText("Media play"));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByTestId("program-step-timer")).toHaveTextContent(
      "0:40 / 1:30",
    );
    fireEvent.click(screen.getByText("Media pause"));
    await flush();
    expect(f.checkpoint).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stepId: step.id,
        variationId: step.variations[0]!.id,
        elapsedSeconds: 40,
      }),
    });
  });
  it("stops at the target and does not invent a completed workout record", async () => {
    render(
      <ProgramStepPlayer
        editionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        step={step}
        onClose={() => {}}
      />,
    );
    await flush();
    act(() => vi.advanceTimersByTime(100000));
    await flush();
    expect(screen.getByTestId("program-step-timer")).toHaveTextContent(
      "1:30 / 1:30",
    );
    expect(screen.getByText(/Step timer complete/)).toBeInTheDocument();
    expect(
      f.checkpoint.mock.calls.every(([args]) => !("completed" in args.data)),
    ).toBe(true);
  });
});

it("changes nested demonstrations and work/rest phases without progress polling or resetting the timer", async () => {
  const exercise = crypto.randomUUID(),
    variation = crypto.randomUUID();
  const rich = {
    ...step,
    exercises: [
      {
        id: exercise,
        label: "Exercise one",
        instructions: "Slow movement",
        variations: [
          {
            id: variation,
            label: "Bodyweight alternative",
            instructions: "Trainer guidance",
            safety_notes: "Choose your individually appropriate version",
          },
        ],
      },
    ],
    intervals: [
      {
        id: crypto.randomUUID(),
        label: "Movement",
        kind: "work" as const,
        seconds: 30,
        exercise_id: exercise,
      },
      {
        id: crypto.randomUUID(),
        label: "Recovery",
        kind: "rest" as const,
        seconds: 15,
      },
    ],
  };
  render(
    <ProgramStepPlayer
      editionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      step={rich}
      onClose={() => {}}
    />,
  );
  await flush();
  act(() => vi.advanceTimersByTime(20000));
  expect(f.checkpoint).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Exercise step"), {
    target: { value: exercise },
  });
  await flush();
  fireEvent.change(screen.getByLabelText("Exercise variation"), {
    target: { value: variation },
  });
  await flush();
  expect(screen.getByText("Trainer guidance")).toBeInTheDocument();
  expect(screen.getByTestId("program-step-timer")).toHaveTextContent("0:20");
  act(() => vi.advanceTimersByTime(10000));
  await flush();
  expect(screen.getByText(/Rest \/ recovery · Recovery/)).toBeInTheDocument();
  expect(screen.getByTestId("program-step-timer")).toHaveTextContent("0:30");
});
