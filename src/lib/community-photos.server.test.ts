// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  env: {} as Record<string, string>,
  rpc: vi.fn(),
  upload: vi.fn(),
  encode: vi.fn(),
  binding: undefined as unknown,
  bytes: new Uint8Array(),
}));
vi.mock("./runtime-env.server", () => ({
  runtimeEnv: (key: string) => f.env[key],
  runtimeBinding: () => f.binding,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: f.rpc,
    from: (table: string) => {
      const b = {
        select: () => b,
        eq: () => b,
        single: async () => ({
          error: null,
          data:
            table === "posts"
              ? { text: "Seated fitness modification", media_revision: 1 }
              : { max_bytes: 8388608 },
        }),
      };
      return b;
    },
    storage: {
      from: () => ({
        download: async () => ({
          error: null,
          data: new Blob([f.bytes as BlobPart]),
        }),
        upload: f.upload,
      }),
    },
  },
}));
import { processCommunityPhoto } from "./community-photos.server";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  user = "11111111-1111-4111-8111-111111111111";
function processed() {
  const b = new Uint8Array(30);
  b.set(new TextEncoder().encode("RIFF"));
  new DataView(b.buffer).setUint32(4, 22, true);
  b.set(new TextEncoder().encode("WEBPVP8X"), 8);
  new DataView(b.buffer).setUint32(16, 10, true);
  b[24] = 1;
  b[27] = 1;
  return b;
}
beforeEach(() => {
  f.env = {
    COMMUNITY_PHOTOS_VERIFIED: "true",
    COMMUNITY_MODERATION_URL: "https://approved-provider.invalid/review",
    COMMUNITY_MODERATION_KEY: "test-secret",
  };
  f.bytes = processed();
  f.rpc.mockReset().mockImplementation(async (name: string) => ({
    data:
      name === "claim_post_photo_processing"
        ? [
            {
              id,
              user_id: user,
              post_id: id,
              original_path: `${user}/original.webp`,
            },
          ]
        : null,
    error: null,
  }));
  f.upload.mockReset().mockResolvedValue({ data: null, error: null });
  f.encode
    .mockReset()
    .mockResolvedValue({ response: () => new Response(processed()) });
  f.binding = { input: () => ({ transform: () => ({ output: f.encode }) }) };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ decision: "approved", specialistCleared: true }),
      ),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("fail-closed community processing contract (mocked providers)", () => {
  it("does not process or publish until all required capabilities are configured", async () => {
    f.env = {};
    await expect(processCommunityPhoto(user, id)).rejects.toThrow(
      "not been verified",
    );
    expect(f.rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps uploads unpublished on moderation outages or missing specialist assessment", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 503 }));
    await expect(processCommunityPhoto(user, id)).rejects.toThrow(
      "remains unpublished",
    );
    expect(
      f.rpc.mock.calls.some(([name]) => name === "review_post_photo"),
    ).toBe(false);
    vi.mocked(fetch).mockResolvedValue(Response.json({ decision: "approved" }));
    await expect(processCommunityPhoto(user, id)).rejects.toThrow("Specialist");
    expect(f.upload).not.toHaveBeenCalled();
  });
  it("publishes only re-encoded private derivatives after clearance and checks the exact post revision", async () => {
    expect(await processCommunityPhoto(user, id)).toEqual({
      status: "approved",
    });
    expect(f.encode).toHaveBeenCalledTimes(2);
    expect(f.upload).toHaveBeenCalledTimes(2);
    expect(f.rpc).toHaveBeenCalledWith(
      "review_post_photo",
      expect.objectContaining({
        p_photo: id,
        p_revision: 1,
        p_status: "approved",
        p_specialist: true,
      }),
    );
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
      redirect: "error",
    });
  });
  it("never creates ordinary preview derivatives for specialist holds or clearly prohibited material", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ decision: "specialist", specialistCleared: false }),
    );
    expect(await processCommunityPhoto(user, id)).toEqual({
      status: "specialist",
    });
    expect(f.upload).not.toHaveBeenCalled();
    expect(f.rpc).toHaveBeenCalledWith(
      "review_post_photo",
      expect.objectContaining({
        p_status: "specialist",
        p_display: "",
        p_thumb: "",
        p_specialist: false,
      }),
    );
  });
  it("leaves uncertain, specialist-cleared images in a private independent review queue", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ decision: "review", specialistCleared: true }),
    );
    expect(await processCommunityPhoto(user, id)).toEqual({ status: "review" });
    expect(f.rpc).toHaveBeenCalledWith(
      "review_post_photo",
      expect.objectContaining({ p_status: "review" }),
    );
  });
  it("blocks processing retries while a lease or prior review is active", async () => {
    f.rpc.mockResolvedValue({ data: [], error: null });
    await expect(processCommunityPhoto(user, id)).rejects.toThrow("processing");
    expect(f.encode).not.toHaveBeenCalled();
  });
});
