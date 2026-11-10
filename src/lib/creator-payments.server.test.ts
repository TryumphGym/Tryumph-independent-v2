// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
const f = vi.hoisted(() => ({
  env: {} as Record<string, string>,
  rpc: vi.fn(),
  tables: [] as string[],
  rows: {} as Record<string, unknown>,
  mutations: [] as { table: string; value: unknown }[],
}));
vi.mock("./runtime-env.server", () => ({
  runtimeEnv: (key: string) => f.env[key],
}));
vi.mock("./app-origin.server", () => ({
  appOrigin: () => "https://staging.tryumph.invalid",
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: f.rpc,
    from: (table: string) => {
      f.tables.push(table);
      let mutation = false;
      const b = {
        select: () => b,
        eq: () => b,
        in: () => b,
        is: () => b,
        order: () => b,
        limit: () => b,
        update: (value: unknown) => {
          mutation = true;
          f.mutations.push({ table, value });
          return b;
        },
        upsert: (value: unknown) => {
          mutation = true;
          f.mutations.push({ table, value });
          return b;
        },
        single: async () => ({ data: f.rows[table], error: null }),
        maybeSingle: async () => ({ data: f.rows[table] ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({
            data: mutation ? null : f.rows[table],
            error: null,
          }).then(resolve),
      };
      return b;
    },
  },
}));
import {
  createCreatorCheckout,
  settleCreatorInvoice,
  handleCreatorBillingEvent,
  cancelCreatorMembership,
  adjustCreatorCharge,
} from "./creator-payments.server";
const user = "11111111-1111-4111-8111-111111111111",
  trainer = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333";
const order = {
  id,
  user_id: user,
  trainer_id: trainer,
  revision: 1,
  price_cents: 2000,
  commission_bps: 1000,
  terms_version: "membership-v1",
  destination: "acct_verified",
  checkout_id: "cs_member",
  subscription_id: "sub_member",
  customer_id: "cus_member",
  state: "confirmed",
  billing_status: "active",
  cancel_at_period_end: false,
  renewal_stop_requested: false,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 45 * 60000).toISOString(),
};
const price = {
  id: "price_month",
  unit_amount: 2000,
  currency: "usd",
  recurring: { interval: "month", interval_count: 1 },
};
const sub = {
  id: "sub_member",
  metadata: {
    type: "trybe_membership",
    orderId: id,
    userId: user,
    trainerId: trainer,
  },
  customer: "cus_member",
  status: "active",
  cancel_at_period_end: false,
  items: { has_more: false, data: [{ price, quantity: 1 }] },
};
const invoice = {
  id: "in_member",
  parent: { subscription_details: { subscription: "sub_member" } },
  status: "paid",
  currency: "usd",
  amount_paid: 2000,
  customer: "cus_member",
  status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
};
const charge = {
  id: "ch_member",
  payment_intent: "pi_member",
  currency: "usd",
  amount: 2000,
  amount_refunded: 0,
  balance_transaction: { fee: 88 },
};
function stripe() {
  return {
    accounts: {
      retrieve: vi.fn().mockResolvedValue({
        id: "acct_verified",
        payouts_enabled: true,
        capabilities: { transfers: "active" },
      }),
    },
    customers: { create: vi.fn().mockResolvedValue({ id: "cus_member" }) },
    prices: { create: vi.fn().mockResolvedValue({ id: "price_month" }) },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_member",
          url: "https://checkout.stripe.com/test",
        }),
        retrieve: vi.fn().mockResolvedValue({
          status: "open",
          url: "https://checkout.stripe.com/test",
        }),
        list: vi.fn(),
      },
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue(sub),
      update: vi.fn().mockResolvedValue({ ...sub, cancel_at_period_end: true }),
      cancel: vi.fn().mockResolvedValue({ ...sub, status: "canceled" }),
    },
    invoices: {
      retrieve: vi.fn().mockResolvedValue(invoice),
      listLineItems: vi.fn().mockResolvedValue({
        has_more: false,
        data: [
          {
            quantity: 1,
            amount: 2000,
            pricing: { price_details: { price: "price_month" } },
            period: {
              start: Math.floor(Date.now() / 1000) - 60,
              end: Math.floor(Date.now() / 1000) + 2592000,
            },
          },
        ],
      }),
      del: vi.fn(),
      voidInvoice: vi.fn(),
    },
    invoicePayments: {
      list: vi.fn().mockResolvedValue({
        has_more: false,
        data: [
          {
            invoice: "in_member",
            payment: { type: "payment_intent", payment_intent: "pi_member" },
          },
        ],
      }),
    },
    paymentIntents: {
      retrieve: vi.fn().mockResolvedValue({
        id: "pi_member",
        status: "succeeded",
        customer: "cus_member",
        currency: "usd",
        amount_received: 2000,
        latest_charge: charge,
      }),
    },
    charges: { retrieve: vi.fn().mockResolvedValue(charge) },
    disputes: { retrieve: vi.fn() },
  };
}
const provider = (s: ReturnType<typeof stripe>) => s as unknown as Stripe;
beforeEach(() => {
  f.env = { CREATOR_MEMBERSHIPS_ENABLED: "true" };
  f.tables = [];
  f.mutations = [];
  f.rows = {
    creator_orders: { ...order },
    creator_prices: { stripe_price_id: "price_month" },
    trainer_accounts: {
      stripe_account_id: "acct_verified",
      payouts_enabled: true,
    },
    creator_customers: { customer_id: "cus_member" },
    creator_offers: { enabled: true, blocked: false },
  };
  f.rpc.mockReset().mockImplementation(async (name: string) => ({
    data:
      name === "creator_can_sell"
        ? true
        : name === "begin_creator_order"
          ? [f.rows["creator_orders"]]
          : name === "record_creator_invoice"
            ? "receipt-id"
            : null,
    error: null,
  }));
});
describe("server-authoritative recurring membership provider orchestration", () => {
  it("keeps native memberships off without explicit runtime activation", async () => {
    f.env = {};
    const s = stripe();
    await expect(
      createCreatorCheckout(user, trainer, provider(s)),
    ).rejects.toThrow("configuration");
    expect(s.accounts.retrieve).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("creates monthly checkout from frozen server terms and tolerates real null-data Supabase mutations", async () => {
    f.rows["creator_orders"] = {
      ...order,
      state: "pending",
      checkout_id: null,
      subscription_id: null,
    };
    const s = stripe();
    expect(await createCreatorCheckout(user, trainer, provider(s))).toEqual({
      url: "https://checkout.stripe.com/test",
    });
    expect(s.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_member",
        line_items: [{ price: "price_month", quantity: 1 }],
        subscription_data: {
          metadata: {
            type: "trybe_membership",
            orderId: id,
            userId: user,
            trainerId: trainer,
          },
        },
      }),
      { idempotencyKey: `creator-checkout:${id}` },
    );
    expect(f.rpc).toHaveBeenCalledWith(
      "attach_creator_subscription",
      expect.objectContaining({ p_order: id, p_checkout: "cs_member" }),
    );
  });
  it("fails closed when fresh Connect transfer capability or payouts are unavailable", async () => {
    const s = stripe();
    s.accounts.retrieve.mockResolvedValue({
      ...(await s.accounts.retrieve()),
      payouts_enabled: false,
    });
    await expect(
      createCreatorCheckout(user, trainer, provider(s)),
    ).rejects.toThrow("not eligible");
    expect(f.mutations).toContainEqual({
      table: "trainer_accounts",
      value: { payouts_enabled: false },
    });
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("never grants entitlement for an unpaid invoice or subscription status alone", async () => {
    const s = stripe();
    s.invoices.retrieve.mockResolvedValue({ ...invoice, status: "open" });
    expect(await settleCreatorInvoice(provider(s), "in_member")).toBe(true);
    expect(
      f.rpc.mock.calls.some(([name]) => name === "record_creator_invoice"),
    ).toBe(false);
  });
  it("uses fresh invoice identity and actual settled processing fees, and retries without guessing fees", async () => {
    const s = stripe();
    expect(await settleCreatorInvoice(provider(s), "in_member")).toBe(true);
    expect(f.rpc).toHaveBeenCalledWith(
      "record_creator_invoice",
      expect.objectContaining({
        p_order: id,
        p_invoice: "in_member",
        p_intent: "pi_member",
        p_gross: 2000,
        p_fee: 88,
        p_refunded: 0,
      }),
    );
    s.paymentIntents.retrieve.mockResolvedValue({
      ...(await s.paymentIntents.retrieve()),
      latest_charge: {
        ...charge,
        balance_transaction: null,
      } as unknown as typeof charge,
    });
    await expect(
      settleCreatorInvoice(provider(s), "in_member"),
    ).rejects.toThrow("processing fee");
    expect(
      f.rpc.mock.calls.filter(([name]) => name === "record_creator_invoice"),
    ).toHaveLength(1);
  });
  it("rejects wrong customers, altered subscription prices and mismatched invoice amounts", async () => {
    const s = stripe();
    s.invoices.retrieve.mockResolvedValue({
      ...invoice,
      customer: "cus_stranger",
    });
    await expect(
      settleCreatorInvoice(provider(s), "in_member"),
    ).rejects.toThrow("mismatch");
    s.invoices.retrieve.mockResolvedValue(invoice);
    s.subscriptions.retrieve.mockResolvedValue({
      ...sub,
      items: {
        has_more: false,
        data: [{ price: { ...price, unit_amount: 3000 }, quantity: 1 }],
      },
    });
    await expect(
      settleCreatorInvoice(provider(s), "in_member"),
    ).rejects.toThrow("altered");
  });
  it("cancels future renewal without deleting a paid receipt or program purchase", async () => {
    const s = stripe();
    await cancelCreatorMembership(user, id, provider(s));
    expect(s.subscriptions.update).toHaveBeenCalledWith("sub_member", {
      cancel_at_period_end: true,
    });
    expect(f.tables).not.toContain("program_enrollments");
    expect(f.tables).not.toContain("creator_receipts");
  });
  it("stops ineligible renewal and voids open collection even when a previously eligible cached account becomes disabled", async () => {
    const s = stripe();
    s.invoices.retrieve.mockResolvedValue({ ...invoice, status: "open" });
    s.accounts.retrieve.mockResolvedValue({
      ...(await s.accounts.retrieve()),
      payouts_enabled: false,
    });
    await handleCreatorBillingEvent(provider(s), {
      type: "invoice.created",
      data: { object: { id: "in_member" } },
    } as unknown as Stripe.Event);
    expect(s.subscriptions.cancel).toHaveBeenCalledWith("sub_member", {
      invoice_now: false,
      prorate: false,
    });
    expect(s.invoices.voidInvoice).toHaveBeenCalledWith("in_member");
    expect(f.mutations).toContainEqual({
      table: "creator_orders",
      value: { renewal_stop_requested: true },
    });
  });
  it("rechecks refund charge identity before applying monotonic SQL adjustments", async () => {
    f.rows["creator_receipts"] = {
      id: "receipt-id",
      intent_id: "pi_member",
      price_cents: 2000,
    };
    const s = stripe();
    s.charges.retrieve.mockResolvedValue({ ...charge, amount_refunded: 2000 });
    expect(
      await adjustCreatorCharge(
        provider(s),
        charge as unknown as Stripe.Charge,
      ),
    ).toBe(true);
    expect(f.rpc).toHaveBeenCalledWith(
      "adjust_creator_receipt",
      expect.objectContaining({ p_receipt: "receipt-id", p_refunded: 2000 }),
    );
    s.charges.retrieve.mockResolvedValue({
      ...charge,
      payment_intent: "pi_other",
    });
    await expect(
      adjustCreatorCharge(provider(s), charge as unknown as Stripe.Charge),
    ).rejects.toThrow("mismatch");
  });
});
