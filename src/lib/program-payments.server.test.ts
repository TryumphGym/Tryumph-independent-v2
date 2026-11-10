// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
const f = vi.hoisted(() => ({
  env: {} as Record<string, string>,
  rows: [] as unknown[],
  rpc: vi.fn(),
  tables: [] as string[],
  media: vi.fn(),
}));
vi.mock("./runtime-env.server", () => ({
  runtimeEnv: (name: string) => f.env[name],
}));
vi.mock("./app-origin.server", () => ({
  appOrigin: () => "https://staging.tryumph.invalid",
}));
vi.mock("./program-media.server", () => ({ assertProgramMediaReady: f.media }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: f.rpc,
    from: (name: string) => {
      f.tables.push(name);
      const response = f.rows.shift();
      const b = {
        select: () => b,
        eq: () => b,
        in: () => b,
        is: () => b,
        not: () => b,
        limit: () => b,
        order: () => b,
        update: () => b,
        single: async () => response,
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve(response).then(resolve),
      };
      return b;
    },
  },
}));
import {
  createProgramCheckout,
  settleProgramCheckout,
  adjustProgramCharge,
  reconcileProgramTransfers,
  processProgramRefunds,
} from "./program-payments.server";
const user = "11111111-1111-4111-8111-111111111111",
  orderId = "22222222-2222-4222-8222-222222222222",
  edition = "33333333-3333-4333-8333-333333333333";
const order = {
  id: orderId,
  user_id: user,
  edition_id: edition,
  trainer_id: "trainer",
  program_id: "program",
  price_cents: 10000,
  commission_bps: 1000,
  terms_version: "fixture-approved",
  destination: "acct_fixture",
  checkout_id: null,
  intent_id: null,
  status: "pending",
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 45 * 60000).toISOString(),
};
const session = {
  id: "cs_fixture",
  metadata: { type: "program", orderId, userId: user, editionId: edition },
  client_reference_id: orderId,
  mode: "payment",
  payment_status: "paid",
  status: "complete",
  currency: "usd",
  amount_total: 10000,
  payment_intent: "pi_fixture",
  url: "https://checkout.stripe.com/test",
};
const intent = {
  id: "pi_fixture",
  status: "succeeded",
  currency: "usd",
  amount_received: 10000,
  metadata: session.metadata,
  latest_charge: {
    id: "ch_fixture",
    payment_intent: "pi_fixture",
    currency: "usd",
    amount: 10000,
    amount_refunded: 0,
    balance_transaction: { fee: 300 },
  },
};
function stripe() {
  return {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue(session),
        retrieve: vi.fn().mockResolvedValue(session),
        list: vi.fn().mockResolvedValue({ data: [session] }),
      },
    },
    accounts: {
      retrieve: vi.fn().mockResolvedValue({
        payouts_enabled: true,
        capabilities: { transfers: "active" },
      }),
    },
    paymentIntents: {
      retrieve: vi.fn().mockResolvedValue(intent),
      cancel: vi.fn().mockResolvedValue({ status: "canceled" }),
    },
    disputes: {
      retrieve: vi.fn().mockResolvedValue({ id: "dp_fixture", status: "won" }),
    },
    transfers: {
      create: vi.fn().mockResolvedValue({ id: "tr_fixture", amount: 8730 }),
      createReversal: vi
        .fn()
        .mockResolvedValue({ id: "trr_fixture", amount: 8730 }),
    },
    refunds: {
      create: vi
        .fn()
        .mockResolvedValue({ id: "re_fixture", status: "succeeded" }),
      retrieve: vi
        .fn()
        .mockResolvedValue({ id: "re_fixture", status: "succeeded" }),
    },
    charges: {
      retrieve: vi
        .fn()
        .mockResolvedValue({ ...intent.latest_charge, amount_refunded: 10000 }),
    },
  };
}
const asStripe = (s: ReturnType<typeof stripe>) => s as unknown as Stripe;
beforeEach(() => {
  f.env = { PROGRAM_NATIVE_CHECKOUT_ENABLED: "true" };
  f.rows = [];
  f.tables = [];
  f.rpc.mockReset().mockResolvedValue({ data: [], error: null });
  f.media.mockReset();
});
describe("program Stripe orchestration with mocked provider calls", () => {
  it("does nothing before the independent runtime commercial gate is enabled", async () => {
    f.env["PROGRAM_NATIVE_CHECKOUT_ENABLED"] = "false";
    const s = stripe();
    await expect(
      createProgramCheckout(user, "program", asStripe(s)),
    ).rejects.toThrow("owner-approved");
    expect(f.rpc).not.toHaveBeenCalled();
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("uses the frozen order amount and stable provider key; protected delivery is checked before charging", async () => {
    const s = stripe();
    f.rpc.mockResolvedValueOnce({ data: [order], error: null });
    f.rows = [
      { data: { document: { title: "Published edition" } }, error: null },
      { data: [{ video_id: "video" }], error: null },
      { data: [{ id: "video" }], error: null },
    ];
    await createProgramCheckout(user, "program", asStripe(s));
    expect(f.media).toHaveBeenCalledOnce();
    expect(s.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expires_at: Math.floor(new Date(order.expires_at).getTime() / 1000),
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 10000,
              currency: "usd",
            }),
          }),
        ],
        metadata: session.metadata,
      }),
      { idempotencyKey: `program-checkout:${orderId}` },
    );
    expect(f.rpc).toHaveBeenCalledWith(
      "attach_program_checkout",
      expect.objectContaining({ p_order: orderId, p_checkout: "cs_fixture" }),
    );
  });
  it("never creates a second session when an existing checkout is open", async () => {
    const s = stripe();
    f.rpc.mockResolvedValueOnce({
      data: [{ ...order, checkout_id: "cs_fixture" }],
      error: null,
    });
    s.checkout.sessions.retrieve.mockResolvedValueOnce({
      ...session,
      status: "open",
      payment_status: "unpaid",
    });
    expect(await createProgramCheckout(user, "program", asStripe(s))).toEqual({
      url: session.url,
    });
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("requires cancellation of an expired old intent before allowing another checkout", async () => {
    const s = stripe();
    f.rpc.mockResolvedValueOnce({
      data: [{ ...order, checkout_id: "cs_fixture" }],
      error: null,
    });
    s.checkout.sessions.retrieve.mockResolvedValueOnce({
      ...session,
      status: "expired",
      payment_status: "unpaid",
    });
    s.paymentIntents.cancel.mockRejectedValueOnce(
      new Error("Payment already processing"),
    );
    await expect(
      createProgramCheckout(user, "program", asStripe(s)),
    ).rejects.toThrow("processing");
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalledWith(
      "cancel_program_order",
      expect.anything(),
    );
  });
  it("settles only a freshly retrieved paid session with matching customer, edition, amount and actual fee", async () => {
    const s = stripe();
    f.rows = [{ data: order, error: null }];
    await settleProgramCheckout(
      asStripe(s),
      session as unknown as Stripe.Checkout.Session,
    );
    expect(f.rpc).toHaveBeenCalledWith("confirm_program_order", {
      p_order: orderId,
      p_checkout: "cs_fixture",
      p_intent: "pi_fixture",
      p_gross: 10000,
      p_fee: 300,
      p_refunded: 0,
    });
    expect(s.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_fixture");
  });
  it("rejects forged identity and missing settled fees without granting access", async () => {
    const s = stripe();
    f.rows = [{ data: order, error: null }];
    s.checkout.sessions.retrieve.mockResolvedValueOnce({
      ...session,
      metadata: { ...session.metadata, userId: "wrong" },
    });
    await expect(
      settleProgramCheckout(
        asStripe(s),
        session as unknown as Stripe.Checkout.Session,
      ),
    ).rejects.toThrow("identity");
    expect(f.rpc).not.toHaveBeenCalled();
    f.rows = [{ data: order, error: null }];
    s.paymentIntents.retrieve.mockResolvedValueOnce({
      ...intent,
      latest_charge: { ...intent.latest_charge, balance_transaction: null },
    } as unknown as typeof intent);
    await expect(
      settleProgramCheckout(
        asStripe(s),
        session as unknown as Stripe.Checkout.Session,
      ),
    ).rejects.toThrow("fee");
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("uses fresh provider dispute status instead of replayed event status", async () => {
    const s = stripe();
    f.rows = [{ data: order, error: null }];
    await adjustProgramCharge(
      asStripe(s),
      intent.latest_charge as unknown as Stripe.Charge,
      { id: "dp_fixture", status: "needs_response" } as Stripe.Dispute,
    );
    expect(f.rpc).toHaveBeenCalledWith(
      "adjust_program_payment",
      expect.objectContaining({
        p_dispute: "dp_fixture",
        p_status: "won",
        p_refunded: 0,
      }),
    );
  });
  it("uses immutable operation ids for transfers and persists confirmation before claiming again", async () => {
    const s = stripe();
    f.rows = [
      { data: [{ id: orderId, destination: "acct_fixture" }], error: null },
    ];
    f.rpc
      .mockResolvedValueOnce({
        data: [{ id: "operation-id", kind: "transfer", amount: 8730 }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    expect(await reconcileProgramTransfers(asStripe(s))).toMatchObject({
      paid: 1,
      reversed: 0,
    });
    expect(s.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 8730, destination: "acct_fixture" }),
      { idempotencyKey: "program-payout:operation-id" },
    );
    expect(f.rpc).toHaveBeenCalledWith("finish_program_payout", {
      p_operation: "operation-id",
      p_provider: "tr_fixture",
    });
  });
  it("confirms refunds with the provider and leaves a pending refund queued", async () => {
    const s = stripe();
    f.rows = [
      {
        data: [
          {
            order_id: orderId,
            provider_id: null,
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      },
      {
        data: { ...order, intent_id: "pi_fixture", checkout_id: "cs_fixture" },
        error: null,
      },
      { data: null, error: null },
    ];
    s.refunds.create.mockResolvedValueOnce({
      id: "re_fixture",
      status: "pending",
    });
    expect(await processProgramRefunds(asStripe(s))).toEqual({
      completed: 0,
      failed: 0,
    });
    expect(s.refunds.create).toHaveBeenCalledWith(
      { payment_intent: "pi_fixture" },
      { idempotencyKey: `program-refund:${orderId}` },
    );
    expect(f.rpc).not.toHaveBeenCalledWith(
      "adjust_program_payment",
      expect.anything(),
    );
  });
});
