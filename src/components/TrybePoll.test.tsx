import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { TrybePoll } from "@/lib/polls";
const f = vi.hoisted(() => ({ save: vi.fn(), vote: vi.fn(), close: vi.fn() }));
vi.mock("@/lib/polls.functions", () => ({
  saveTrybePoll: f.save,
  voteTrybePoll: f.vote,
  closeTrybePoll: f.close,
}));
vi.mock("./Avatar", () => ({ Avatar: () => <span>Creator photo</span> }));
import { PollEditor, TrybePollCard } from "./TrybePoll";
const poll: TrybePoll = {
  id: "11111111-1111-4111-8111-111111111111",
  trybe: "coach-22222222-2222-4222-8222-222222222222",
  question: "What time works?",
  description: "Feedback only",
  maxSelections: 1,
  revision: 1,
  expiresAt: null,
  closed: false,
  createdAt: "2026-10-31T00:00:00Z",
  creatorName: "Trainer",
  creatorAvatar: null,
  voters: 0,
  resultsVisible: false,
  mine: [],
  mayVote: true,
  mayEdit: false,
  mayClose: false,
  options: [
    { id: "33333333-3333-4333-8333-333333333333", label: "6 AM", votes: null },
    { id: "44444444-4444-4444-8444-444444444444", label: "Noon", votes: null },
    { id: "55555555-5555-4555-8555-555555555555", label: "7 PM", votes: null },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  f.save.mockResolvedValue(poll.id);
  f.vote.mockResolvedValue({
    ...poll,
    mine: [poll.options[0]!.id],
    voters: 1,
    resultsVisible: true,
  });
  f.close.mockResolvedValue({ ...poll, closed: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("submits a real single-choice action with the frozen revision and selected option", async () => {
  const update = vi.fn();
  render(<TrybePollCard poll={poll} onUpdate={update} onRefresh={() => {}} />);
  fireEvent.click(screen.getByRole("radio", { name: "6 AM" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit vote" }));
  await waitFor(() =>
    expect(f.vote).toHaveBeenCalledWith({
      data: { id: poll.id, options: [poll.options[0]!.id], revision: 1 },
    }),
  );
  expect(update).toHaveBeenCalled();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
it("uses accessible checkboxes and prevents submitting more than the configured maximum", () => {
  render(
    <TrybePollCard
      poll={{ ...poll, maxSelections: 2 }}
      onUpdate={() => {}}
      onRefresh={() => {}}
    />,
  );
  for (const c of screen.getAllByRole("checkbox")) fireEvent.click(c);
  expect(screen.getByRole("button", { name: "Submit vote" })).toBeDisabled();
  expect(screen.getByText(/may total more than 100%/)).toBeInTheDocument();
});
it("shows final zero-vote results with finite progress and no voting action", () => {
  render(
    <TrybePollCard
      poll={{
        ...poll,
        closed: true,
        mayVote: false,
        resultsVisible: true,
        options: poll.options.map((o) => ({ ...o, votes: 0 })),
      }}
      onUpdate={() => {}}
      onRefresh={() => {}}
    />,
  );
  expect(screen.getByText("No votes yet.")).toBeInTheDocument();
  expect(
    screen
      .getAllByRole("progressbar")
      .every((p) => p.getAttribute("value") === "0"),
  ).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Submit vote" }),
  ).not.toBeInTheDocument();
});
it("creates a multi-choice poll with context, notification choice and viewer-local expiry", async () => {
  const saved = vi.fn();
  render(<PollEditor trybe={poll.trybe} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText("Poll question"), {
    target: { value: "Which equipment?" },
  });
  fireEvent.change(screen.getByLabelText("Context (optional)"), {
    target: { value: "Planning a program" },
  });
  fireEvent.change(screen.getByLabelText("Answer 1"), {
    target: { value: "Dumbbells" },
  });
  fireEvent.change(screen.getByLabelText("Answer 2"), {
    target: { value: "Bodyweight" },
  });
  fireEvent.click(screen.getByLabelText("Allow multiple choices"));
  fireEvent.click(screen.getByLabelText(/Notify eligible members/));
  fireEvent.change(screen.getByLabelText(/Close voting at/), {
    target: { value: "2027-01-01T09:00" },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Create a Trybe poll" }));
  await waitFor(() => expect(f.save).toHaveBeenCalled());
  expect(f.save.mock.calls[0]![0].data).toMatchObject({
    options: ["Dumbbells", "Bodyweight"],
    maxSelections: 2,
    notify: true,
    expiresAt: new Date("2027-01-01T09:00").toISOString(),
  });
  expect(saved).toHaveBeenCalledWith(poll.id);
});
it("does not send duplicate options to the server", async () => {
  render(<PollEditor trybe={poll.trybe} onSaved={() => {}} />);
  fireEvent.change(screen.getByLabelText("Poll question"), {
    target: { value: "Which time?" },
  });
  for (const label of ["Answer 1", "Answer 2"])
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: "Same" },
    });
  fireEvent.submit(screen.getByRole("form", { name: "Create a Trybe poll" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("different");
  expect(f.save).not.toHaveBeenCalled();
});
it("requires an admin reason when closing through the ordinary Trybe feed", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(
    <TrybePollCard
      poll={{ ...poll, mayClose: true, requiresCloseReason: true }}
      onUpdate={() => {}}
      onRefresh={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "Close poll" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Moderation reason"), {
    target: { value: "Safety review" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Close poll" }));
  await waitFor(() =>
    expect(f.close).toHaveBeenCalledWith({
      data: { id: poll.id, reason: "Safety review" },
    }),
  );
});
it("refreshes once at expiration without repeatedly polling for results", async () => {
  vi.useFakeTimers();
  const refresh = vi.fn();
  render(
    <TrybePollCard
      poll={{ ...poll, expiresAt: new Date(Date.now() + 30000).toISOString() }}
      onUpdate={() => {}}
      onRefresh={refresh}
    />,
  );
  vi.advanceTimersByTime(20000);
  expect(refresh).not.toHaveBeenCalled();
  vi.advanceTimersByTime(10100);
  expect(refresh).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(60000);
  expect(refresh).toHaveBeenCalledOnce();
});
