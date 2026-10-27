// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
const state = vi.hoisted(() => ({ rows: [] as unknown[], eligible: true }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const row = state.rows.shift();
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        gt: () => builder,
        limit: async () => ({ data: row, error: null }),
        single: async () => ({ data: row, error: null }),
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return builder;
    },
    rpc: async (name: string) => ({
      data: name === "account_can_act" ? true : state.eligible,
      error: null,
    }),
  },
}));
vi.mock("./runtime-env.server", () => ({
  runtimeEnv: (name: string) =>
    ({
      LIVEKIT_API_KEY: "test-api-key",
      LIVEKIT_API_SECRET: "test-only-signing-secret-at-least-32-characters",
      LIVEKIT_URL: "wss://test.invalid",
    })[name as "LIVEKIT_URL"],
}));
import { issueLiveRoomToken } from "./live-token.server";
const id = "11111111-1111-4111-8111-111111111111";
const session = () => ({
  id,
  trainer_id: "trainer",
  starts_at: new Date().toISOString(),
  status: "scheduled",
  minutes: 45,
});
beforeEach(() => {
  state.rows = [];
  state.eligible = true;
});
async function verify(token: string) {
  return new TokenVerifier(
    "test-api-key",
    "test-only-signing-secret-at-least-32-characters",
  ).verify(token);
}
describe("LiveKit authorization and actual signed token permissions", () => {
  it("grants a paid attendee subscription without broadcast/admin powers", async () => {
    state.rows = [session(), { id: "booking" }];
    const result = await issueLiveRoomToken("member", `live-${id}`, "Member");
    const token = await verify(result.token);
    expect(token.sub).toBe("member");
    expect(token.video).toMatchObject({
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
      roomAdmin: false,
      roomRecord: false,
    });
  });
  it("locks pending community and deposit waiting-room media until verified settlement", async () => {
    state.rows = [
      session(),
      { id: "reservation", status: "pending" },
      [{ remaining: 1 }],
    ];
    const pending = await verify(
      (await issueLiveRoomToken("member", `live-${id}`, "M")).token,
    );
    expect(pending.video).toMatchObject({
      canSubscribe: false,
      canPublish: false,
      roomAdmin: false,
    });
    state.rows = [
      {
        trainer_id: id,
        member_id: "member",
        starts_at: new Date().toISOString(),
        status: "deposit_paid",
        payment_version: 2,
      },
    ];
    const privateToken = await verify(
      (await issueLiveRoomToken(id, `oneonone-${id}-2026-10-27-09:00`, "T"))
        .token,
    );
    expect(privateToken.video).toMatchObject({
      canSubscribe: false,
      canPublish: false,
      roomAdmin: false,
      roomRecord: false,
    });
  });
  it("grants publishing only to the authenticated class owner", async () => {
    state.rows = [session()];
    const token = await verify(
      (await issueLiveRoomToken("trainer", `live-${id}`, "Trainer")).token,
    );
    expect(token.video).toMatchObject({
      canPublish: true,
      roomAdmin: true,
      room: `live-${id}`,
    });
  });
  it("rejects an unpaid member and an arbitrary or private room", async () => {
    state.rows = [session(), null];
    await expect(
      issueLiveRoomToken("member", `live-${id}`, "M"),
    ).rejects.toThrow("paid booking");
    await expect(issueLiveRoomToken("member", "anything", "M")).rejects.toThrow(
      "Invalid room",
    );
    state.rows = [null];
    await expect(
      issueLiveRoomToken("member", `oneonone-${id}-2026-10-26-09:00`, "M"),
    ).rejects.toThrow("paid private booking");
  });
  it("rejects cancelled, out-of-window, and newly ineligible sessions", async () => {
    state.rows = [{ ...session(), status: "cancelled" }];
    await expect(
      issueLiveRoomToken("trainer", `live-${id}`, "T"),
    ).rejects.toThrow("not found");
    state.rows = [
      { ...session(), starts_at: new Date(Date.now() + 3600000).toISOString() },
    ];
    await expect(
      issueLiveRoomToken("trainer", `live-${id}`, "T"),
    ).rejects.toThrow("window");
    state.rows = [session()];
    state.eligible = false;
    await expect(
      issueLiveRoomToken("trainer", `live-${id}`, "T"),
    ).rejects.toThrow("no longer eligible");
  });
  it("restricts a paid private participant to camera and microphone", async () => {
    state.rows = [
      {
        trainer_id: id,
        member_id: "member",
        starts_at: new Date().toISOString(),
        status: "paid",
      },
    ];
    const token = await verify(
      (
        await issueLiveRoomToken(
          "member",
          `oneonone-${id}-2026-10-26-09:00`,
          "M",
        )
      ).token,
    );
    expect(token.video).toMatchObject({
      roomAdmin: false,
      canPublishSources: ["camera", "microphone"],
    });
  });
});
