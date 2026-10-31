// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  env: {} as Record<string, string>,
  rpc: vi.fn(),
  single: vi.fn(),
}));
vi.mock("./runtime-env.server", () => ({
  runtimeEnv: (name: string) => f.env[name],
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: f.rpc,
    from: () => {
      const b = { select: () => b, eq: () => b, single: f.single };
      return b;
    },
  },
}));
import {
  assertProgramMediaReady,
  programPlayback,
  signProgramPath,
} from "./program-media.server";
import { signVideoPath } from "./video-playback.server";
const guid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  f.env = {
    BUNNY_STREAM_LIBRARY_ID: "123",
    BUNNY_STREAM_TOKEN_KEY: "public-fixture-key",
    BUNNY_PROGRAM_LIBRARY_ID: "999",
    BUNNY_PROGRAM_TOKEN_KEY: "protected-fixture-key",
  };
  f.rpc.mockReset();
  f.single.mockReset();
});
describe("program media access fails closed (signing is real; provider delivery unverified)", () => {
  it("does not issue protected links before independent provider security verification", async () => {
    expect(() => assertProgramMediaReady()).toThrow("independently verified");
    await expect(
      signProgramPath(`bunny:999:${guid}`, "program"),
    ).rejects.toThrow("not configured");
  });
  it("requires separate libraries and signs only the configured protected library", async () => {
    f.env["BUNNY_PROGRAM_MEDIA_VERIFIED"] = "true";
    f.env["BUNNY_PROGRAM_LIBRARY_ID"] = "123";
    expect(() => assertProgramMediaReady()).toThrow();
    f.env["BUNNY_PROGRAM_LIBRARY_ID"] = "999";
    await expect(
      signProgramPath(`bunny:123:${guid}`, "program"),
    ).rejects.toThrow("mismatch");
    await expect(signVideoPath(`bunny:999:${guid}`)).rejects.toThrow(
      "not configured",
    );
  });
  it("signs a bounded protected embed with its separate server key and never returns that key", async () => {
    f.env["BUNNY_PROGRAM_MEDIA_VERIFIED"] = "true";
    const url = new URL(await signProgramPath(`bunny:999:${guid}`, "program"));
    const expires = Number(url.searchParams.get("expires"));
    expect(expires - Math.floor(Date.now() / 1000)).toBeGreaterThan(895);
    expect(expires - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(900);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`protected-fixture-key${guid}${expires}`),
    );
    expect(url.searchParams.get("token")).toBe(
      [...new Uint8Array(digest)]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join(""),
    );
    expect(url.toString()).not.toContain("protected-fixture-key");
  });
  it("checks entitlement before loading metadata or signing, including selected variations", async () => {
    f.env["BUNNY_PROGRAM_MEDIA_VERIFIED"] = "true";
    f.rpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(
      programPlayback("member", "edition", "step", "variation"),
    ).rejects.toThrow("denied");
    expect(f.single).not.toHaveBeenCalled();
    f.rpc.mockResolvedValueOnce({
      data: [{ id: guid, path: `bunny:999:${guid}`, access_scope: "program" }],
      error: null,
    });
    f.single.mockResolvedValueOnce({
      data: {
        id: guid,
        title: "Approved",
        minutes: 20,
        breaks: [180],
        break_seconds: 15,
      },
      error: null,
    });
    f.rpc.mockResolvedValueOnce({ data: "usage-id", error: null });
    const r = await programPlayback("member", "edition", "step", "variation");
    expect(f.rpc).toHaveBeenCalledWith("program_media_access", {
      p_user: "member",
      p_edition: "edition",
      p_step: "step",
      p_variation: "variation",
    });
    expect(r.video.breaks).toEqual([]);
    expect(r.url).toContain("loop=true");
    expect(JSON.stringify(r)).not.toContain("bunny:");
    expect(JSON.stringify(r)).not.toContain("access_scope");
  });
});

it("bounds private credentials by entitlement expiry and refuses expired access before signing or usage recording", async () => {
  f.env["BUNNY_PROGRAM_MEDIA_VERIFIED"] = "true";
  const deadline = new Date(Date.now() + 45000).toISOString();
  f.rpc
    .mockResolvedValueOnce({
      data: [
        {
          id: guid,
          path: `bunny:999:${guid}`,
          access_scope: "program",
          ads_allowed: false,
          access_expires_at: deadline,
        },
      ],
      error: null,
    })
    .mockResolvedValueOnce({ data: "usage", error: null });
  f.single.mockResolvedValueOnce({
    data: {
      id: guid,
      title: "Approved",
      minutes: 20,
      breaks: [180],
      break_seconds: 15,
    },
    error: null,
  });
  const r = await programPlayback("member", "edition", "step");
  expect(
    Number(new URL(r.url).searchParams.get("expires")),
  ).toBeLessThanOrEqual(Math.floor(new Date(deadline).getTime() / 1000));
  expect(r.video.breaks).toEqual([]);
  f.rpc.mockResolvedValueOnce({
    data: [
      {
        id: guid,
        path: `bunny:999:${guid}`,
        access_scope: "program",
        access_expires_at: new Date(Date.now() - 1000).toISOString(),
      },
    ],
    error: null,
  });
  await expect(programPlayback("member", "edition", "step")).rejects.toThrow(
    "expired",
  );
  expect(f.single).toHaveBeenCalledTimes(1);
});
it("suppresses public water-break ads when the entitlement is a purchased program", async () => {
  f.rpc
    .mockResolvedValueOnce({
      data: [
        {
          id: guid,
          path: `bunny:123:${guid}`,
          access_scope: "public",
          ads_allowed: false,
        },
      ],
      error: null,
    })
    .mockResolvedValueOnce({ data: "usage", error: null });
  f.single.mockResolvedValueOnce({
    data: {
      id: guid,
      title: "Reusable public workout",
      minutes: 20,
      breaks: [180, 360],
      break_seconds: 15,
    },
    error: null,
  });
  expect(
    (await programPlayback("member", "edition", "step")).video.breaks,
  ).toEqual([]);
});
