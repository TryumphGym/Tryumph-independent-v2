// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  key: "test-only-resend-key",
  sender: "",
  claim: "claimed",
  saveError: false,
  auth: vi.fn(),
  rpc: vi.fn(),
  updates: [] as unknown[],
}));
vi.mock("./runtime-env.server", () => ({
  runtimeEnv: (name: string) =>
    name === "RESEND_API_KEY"
      ? f.key
      : name === "CONTACT_FROM_EMAIL"
        ? f.sender
        : undefined,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser: f.auth },
    rpc: f.rpc,
    from: () => ({
      update: (value: unknown) => {
        f.updates.push(value);
        return {
          eq: async () => ({
            error: f.saveError ? { message: "simulated write failure" } : null,
          }),
        };
      },
    }),
  },
}));
import { deliverContactMessage } from "./contact.server";
import { CONTACT_EMAIL, type ContactMessage } from "./contact-schema";
const data = (): ContactMessage => ({
  requestId: "11111111-1111-4111-8111-111111111111",
  email: "member@example.invalid",
  topic: "Support request",
  message: "Please help with my account.",
  website: "",
});
let send: ReturnType<typeof vi.fn>;
beforeEach(() => {
  f.key = "test-only-resend-key";
  f.sender = "";
  f.claim = "claimed";
  f.saveError = false;
  f.updates = [];
  f.auth.mockReset();
  f.rpc.mockReset();
  f.rpc.mockImplementation(async () => ({ data: f.claim, error: null }));
  send = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(JSON.stringify({ id: "provider-message-id" }), {
          status: 200,
        }),
    );
  vi.stubGlobal("fetch", send);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("Resend contact delivery with mocked provider", () => {
  it("uses the requested founder sender and inbox, and leaves reply-to with the visitor", async () => {
    expect(await deliverContactMessage(data(), "192.0.2.1")).toEqual({
      ok: true,
    });
    const [url, init] = send.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(init.body)).toMatchObject({
      from: `Tryumph Gym Support <${CONTACT_EMAIL}>`,
      to: [CONTACT_EMAIL],
      reply_to: "member@example.invalid",
    });
    expect(init.headers["Idempotency-Key"]).toBe(`contact:${data().requestId}`);
    const claim = f.rpc.mock.calls[0]![1];
    expect(claim.p_requester_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(claim.p_requester_hash).not.toContain("192.0.2.1");
  });
  it("does not send or claim quota for honeypot submissions", async () => {
    expect(
      await deliverContactMessage(
        { ...data(), website: "spam.invalid" },
        "192.0.2.1",
      ),
    ).toEqual({ ok: true });
    expect(send).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("requires real server-verified identity for refund requests", async () => {
    await expect(
      deliverContactMessage(
        { ...data(), topic: "Refund request" },
        "192.0.2.1",
      ),
    ).rejects.toThrow("sign in");
    f.auth.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid" },
    });
    await expect(
      deliverContactMessage(
        { ...data(), topic: "Refund request", accessToken: "invalid" },
        "192.0.2.1",
      ),
    ).rejects.toThrow("expired");
    expect(send).not.toHaveBeenCalled();
  });
  it("attaches verified account identity but never includes its session token", async () => {
    f.auth.mockResolvedValue({
      data: { user: { id: "verified-member-id" } },
      error: null,
    });
    await deliverContactMessage(
      {
        ...data(),
        topic: "Refund request",
        accessToken: "private-session-token",
        bookingReference: "user-reference",
      },
      "192.0.2.1",
    );
    const body = send.mock.calls[0]![1].body as string;
    expect(body).toContain("verified-member-id");
    expect(body).toContain("user supplied");
    expect(body).not.toContain("private-session-token");
  });
  it("fails visibly without credentials and never treats configuration as sent mail", async () => {
    f.key = "";
    await expect(deliverContactMessage(data(), "192.0.2.1")).rejects.toThrow(
      "not yet configured",
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("returns a prior successful receipt without sending again", async () => {
    f.claim = "sent";
    expect(await deliverContactMessage(data(), "192.0.2.1")).toEqual({
      ok: true,
    });
    expect(send).not.toHaveBeenCalled();
  });
  it("keeps a concurrent request pending without a second send", async () => {
    f.claim = "processing";
    await expect(deliverContactMessage(data(), "192.0.2.1")).rejects.toThrow(
      "already processing",
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("does not claim success for provider rejection or a response lacking a receipt", async () => {
    send.mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    await expect(deliverContactMessage(data(), "192.0.2.1")).rejects.toThrow(
      "could not confirm",
    );
    expect(f.updates.at(-1)).toMatchObject({ status: "failed" });
    send.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(deliverContactMessage(data(), "192.0.2.1")).rejects.toThrow(
      "could not confirm",
    );
  });
  it("retains the same provider idempotency key after acknowledgement storage fails", async () => {
    f.saveError = true;
    await expect(deliverContactMessage(data(), "192.0.2.1")).rejects.toThrow(
      "could not confirm",
    );
    f.saveError = false;
    await deliverContactMessage(data(), "192.0.2.1");
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]![1].headers["Idempotency-Key"]).toBe(
      send.mock.calls[1]![1].headers["Idempotency-Key"],
    );
    expect(send.mock.calls[0]![1].body).toBe(send.mock.calls[1]![1].body);
  });
});
