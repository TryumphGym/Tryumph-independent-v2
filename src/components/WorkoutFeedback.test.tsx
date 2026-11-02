import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  rpc: vi.fn(),
  own: null as null | { tags: string[] },
}));
vi.mock("@/lib/community", () => ({ useUserId: () => "member" }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: f.rpc,
    from: () => {
      const b = {
        select: () => b,
        eq: () => b,
        maybeSingle: async () => ({ data: f.own, error: null }),
      };
      return b;
    },
  },
}));
import { WorkoutFeedback, CommunityTagBadges } from "./WorkoutFeedback";
beforeEach(() => {
  f.own = null;
  f.rpc.mockReset().mockImplementation(async (name) => ({
    data: name === "workout_community_tags" ? {} : null,
    error: null,
  }));
});
afterEach(cleanup);
it("does not interrupt playback with a prompt before substantial watching", () => {
  render(<WorkoutFeedback videoId="workout" eligible={false} />);
  expect(screen.queryByText("How was that workout?")).not.toBeInTheDocument();
});
it("allows optional multi-select feedback, updates and removal through authenticated RPCs", async () => {
  render(<WorkoutFeedback videoId="workout" eligible />);
  fireEvent.click(screen.getByLabelText("Fun"));
  fireEvent.click(screen.getByLabelText("Great instructions"));
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByRole("button", { name: "Update feedback" });
  expect(f.rpc).toHaveBeenCalledWith("save_workout_feedback", {
    p_video: "workout",
    p_tags: ["fun", "great_instructions"],
  });
  fireEvent.click(screen.getByRole("button", { name: "Remove my feedback" }));
  await waitFor(() =>
    expect(f.rpc).toHaveBeenCalledWith("remove_workout_feedback", {
      p_video: "workout",
    }),
  );
});
it("lets members skip without submitting and distinguishes subjective community impressions from trainer classifications", () => {
  render(<WorkoutFeedback videoId="workout" eligible />);
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(
    screen.queryByRole("button", { name: "Save feedback" }),
  ).not.toBeInTheDocument();
  expect(
    f.rpc.mock.calls.some(([name]) => name === "save_workout_feedback"),
  ).toBe(false);
  cleanup();
  render(
    <CommunityTagBadges
      value={{ tags: ["fun", "low_impact_feeling"], respondents: 12 }}
    />,
  );
  expect(screen.getByLabelText("Community Tags")).toHaveTextContent(
    "Low-impact feeling",
  );
  expect(screen.getByText(/not a representative survey/)).toBeInTheDocument();
});
