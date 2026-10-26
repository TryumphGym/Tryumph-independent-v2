// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  recording: {
    egress_id: "EG_test",
    session_id: "session",
    trainer_id: "trainer",
    status: "completed",
    object_key: "live-recordings/session/video.mp4",
    bunny_guid: "bunny-guid",
    import_status: "pending",
    trainer_video_id: null as string | null,
  },
  claimed: true,
  inserted: null as null | Record<string, unknown>,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async () => ({
      data: state.claimed ? [state.recording] : [],
      error: null,
    }),
    from: (table: string) => {
      const b = {
        select: () => b,
        eq: () => b,
        maybeSingle: async () => ({ data: state.recording, error: null }),
        single: async () => ({
          data:
            table === "live_sessions"
              ? {
                  title: "Class",
                  category: "Strength",
                  level: "Beginner",
                  minutes: 45,
                }
              : { id: "stable-id" },
          error: null,
        }),
        upsert: async (value: Record<string, unknown>) => {
          state.inserted = value;
          return { error: null };
        },
        update: () => b,
        then: (resolve: (result: unknown) => void) => resolve({ error: null }),
      };
      return b;
    },
  },
}));
vi.mock("./runtime-env.server", () => ({
  runtimeEnv: (name: string) =>
    name === "BUNNY_STREAM_LIBRARY_ID" ? "123" : "test-only-api-key",
}));
vi.mock("cloudflare:workers", () => ({
  env: { R2_RECORDINGS: { get: async () => ({ body: new ReadableStream() }) } },
}));
import { finishRecordedClass } from "./recordings.server";
beforeEach(() => {
  state.recording.import_status = "pending";
  state.recording.trainer_video_id = null;
  state.claimed = true;
  state.inserted = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 200 })),
  );
});
describe("recording pipeline", () => {
  it("imports completed media into pending review, with zero automatic ads", async () => {
    await finishRecordedClass("EG_test");
    expect(fetch).toHaveBeenCalledOnce();
    expect(state.inserted).toMatchObject({
      review_status: "pending",
      breaks: [],
      break_seconds: 0,
      user_id: "trainer",
    });
  });
  it("does not reset an already imported and reviewed video on webhook retries", async () => {
    state.recording.import_status = "ready";
    state.recording.trainer_video_id = "existing-video";
    expect(await finishRecordedClass("EG_test")).toEqual({
      videoId: "existing-video",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(state.inserted).toBeNull();
  });
  it("rejects concurrent imports before contacting Bunny", async () => {
    state.claimed = false;
    await expect(finishRecordedClass("EG_test")).rejects.toThrow(
      "already running",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
