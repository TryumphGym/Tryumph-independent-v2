// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
import type { RoomServiceClient } from "livekit-server-sdk";
const f = vi.hoisted(() => ({
  rows: [] as unknown[],
  rpcs: [] as unknown[],
  calls: [] as string[],
  create: vi.fn(),
  retrieve: vi.fn(),
  enable: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: class {
    paymentIntents = { create: f.create, retrieve: f.retrieve };
  },
}));
vi.mock("./runtime-env.server", () => ({
  runtimeEnv: () => "test-only-not-a-real-key",
}));
vi.mock("./attendance.server", () => ({ enablePrivateParticipants: f.enable }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (name: string) => {
      f.calls.push(name);
      const result = { data: f.rows.shift(), error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        is: () => builder,
        update: () => builder,
        single: async () => result,
        maybeSingle: async () => result,
        then: (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb),
      };
      return builder;
    },
    rpc: async (name: string) => {
      f.calls.push(name);
      return { data: f.rpcs.shift(), error: null };
    },
  },
}));
import { advancePrivateAttendance } from "./private-payments.server";
const room = "oneonone-11111111-1111-4111-8111-111111111111-2026-10-27-09:00";
const trainer = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222";
const b = {
  checkout_id: "cs_deposit",
  trainer_id: trainer,
  member_id: member,
  status: "deposit_paid",
  balance_cents: 7500,
};
function service() {
  return {
    deleteRoom: vi.fn(),
    listParticipants: vi
      .fn()
      .mockResolvedValue([{ identity: trainer }, { identity: member }]),
  };
}
beforeEach(() => {
  f.rows = [];
  f.rpcs = [];
  f.calls = [];
  f.create.mockReset();
  f.retrieve.mockReset();
  f.enable.mockReset();
});
describe("private provider orchestration (mocked providers, real orchestration)", () => {
  it("does not create a charge for one-party attendance", async () => {
    f.rows = [b];
    const s = service();
    await advancePrivateAttendance(
      room,
      [member],
      s as unknown as RoomServiceClient,
    );
    expect(f.create).not.toHaveBeenCalled();
    expect(f.calls).not.toContain("record_private_both_present");
    expect(f.enable).not.toHaveBeenCalled();
  });
  it("blocks newly expired trainers before charging or enabling media", async () => {
    f.rows = [b];
    f.rpcs = [false];
    const s = service();
    await advancePrivateAttendance(
      room,
      [trainer, member],
      s as unknown as RoomServiceClient,
    );
    expect(s.deleteRoom).toHaveBeenCalledWith(room);
    expect(f.create).not.toHaveBeenCalled();
    expect(f.enable).not.toHaveBeenCalled();
  });
  it("never charges an existing fully paid legacy booking", async () => {
    f.rows = [{ ...b, status: "paid", payment_version: 1 }, null];
    f.rpcs = [true];
    const s = service();
    await advancePrivateAttendance(
      room,
      [trainer, member],
      s as unknown as RoomServiceClient,
    );
    expect(f.enable).toHaveBeenCalledOnce();
    expect(f.create).not.toHaveBeenCalled();
  });
  it("creates a stable balance intent after verified presence and keeps SCA locked", async () => {
    f.rows = [
      b,
      { customer_id: "cus_test", payment_method_id: "pm_test" },
      null,
    ];
    f.rpcs = [
      true,
      true,
      [
        {
          booking_id: b.checkout_id,
          operation_key: "balance:cs_deposit",
          intent_id: null,
          created_at: new Date().toISOString(),
        },
      ],
    ];
    f.create.mockResolvedValue({ id: "pi_balance", status: "requires_action" });
    const s = service();
    await advancePrivateAttendance(
      room,
      [trainer, member],
      s as unknown as RoomServiceClient,
    );
    expect(f.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 7500,
        confirm: true,
        off_session: true,
      }),
      { idempotencyKey: "balance:cs_deposit" },
    );
    expect(f.enable).not.toHaveBeenCalled();
    expect(f.calls).toContain("record_private_both_present");
  });
  it("retrieves the existing intent after a retry instead of creating another", async () => {
    f.rows = [
      b,
      { customer_id: "cus_test", payment_method_id: "pm_test" },
      null,
    ];
    f.rpcs = [
      true,
      true,
      [
        {
          booking_id: b.checkout_id,
          operation_key: "balance:cs_deposit",
          intent_id: "pi_balance",
        },
      ],
    ];
    f.retrieve.mockResolvedValue({
      id: "pi_balance",
      status: "requires_action",
    });
    const s = service();
    await advancePrivateAttendance(
      room,
      [trainer, member],
      s as unknown as RoomServiceClient,
    );
    expect(f.retrieve).toHaveBeenCalledWith("pi_balance");
    expect(f.create).not.toHaveBeenCalled();
    expect(f.enable).not.toHaveBeenCalled();
  });
  it("fails closed on an ambiguous creation beyond Stripe idempotency retention", async () => {
    f.rows = [b, { customer_id: "cus_test", payment_method_id: "pm_test" }];
    f.rpcs = [
      true,
      true,
      [
        {
          booking_id: b.checkout_id,
          operation_key: "balance:cs_deposit",
          intent_id: null,
          created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
        },
      ],
    ];
    await expect(
      advancePrivateAttendance(
        room,
        [trainer, member],
        service() as unknown as RoomServiceClient,
      ),
    ).rejects.toThrow("reconciliation");
    expect(f.create).not.toHaveBeenCalled();
  });
});
