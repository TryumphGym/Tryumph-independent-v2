import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/videos.functions", () => ({
  getVideoUrl: vi
    .fn()
    .mockResolvedValue(
      "https://iframe.mediadelivery.net/embed/123/video?token=public",
    ),
}));
vi.mock("./WaterBreakSponsor", () => ({ WaterBreakSponsor: () => null }));
// These tests exercise the Bunny iframe protocol, not Supabase or the
// comments/feedback APIs. Never use hosted credentials for unit tests.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));
vi.mock("./WorkoutFeedback", () => ({ WorkoutFeedback: () => null }));
vi.mock("./WorkoutComments", () => ({ WorkoutComments: () => null }));
import { OnDemandPlayer } from "./OnDemandPlayer";
afterEach(cleanup);
describe("Bunny player synchronization without changing marked-water-break rules", () => {
  it("seeks a newly selected demonstration to the existing step time and accepts events only from its own frame", async () => {
    const play = vi.fn(),
      pause = vi.fn();
    const url =
      "https://iframe.mediadelivery.net/embed/999/video?token=fixture";
    render(
      <OnDemandPlayer
        video={{
          id: "protected",
          title: "Approved demo",
          minutes: 20,
          breaks: [],
          break_seconds: 0,
        }}
        initialUrl={url}
        synchronization={{
          elapsed: 45,
          paused: true,
          onPlay: play,
          onPause: pause,
        }}
        onClose={() => {}}
      />,
    );
    const frame = await screen.findByTitle<HTMLIFrameElement>("Approved demo");
    const post = vi.spyOn(frame.contentWindow!, "postMessage");
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://iframe.mediadelivery.net",
          source: frame.contentWindow,
          data: { context: "player.js", event: "ready" },
        }),
      );
    });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ method: "setCurrentTime", value: 45 }),
      "https://iframe.mediadelivery.net",
    );
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ method: "pause" }),
      "https://iframe.mediadelivery.net",
    );
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://untrusted.invalid",
          source: frame.contentWindow,
          data: { context: "player.js", event: "play" },
        }),
      ),
    );
    expect(play).not.toHaveBeenCalled();
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://iframe.mediadelivery.net",
          source: frame.contentWindow,
          data: { context: "player.js", event: "play" },
        }),
      ),
    );
    expect(play).toHaveBeenCalledOnce();
  });
  it("does not insert advertising when no water breaks are marked", async () => {
    render(
      <OnDemandPlayer
        video={{
          id: "free-no-break",
          title: "No break workout",
          minutes: 20,
          breaks: [],
          break_seconds: 0,
        }}
        onClose={() => {}}
      />,
    );
    const frame =
      await screen.findByTitle<HTMLIFrameElement>("No break workout");
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://iframe.mediadelivery.net",
          source: frame.contentWindow,
          data: {
            context: "player.js",
            event: "timeupdate",
            value: { seconds: 180 },
          },
        }),
      ),
    );
    expect(screen.queryByText("Water break 💧")).not.toBeInTheDocument();
  });
});
