// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  result: {} as { data: unknown; error: unknown },
  filters: [] as unknown[],
  sign: vi.fn(),
  authorize: vi.fn(),
  protectedSign: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b = {
      inputValidator: () => b,
      middleware: () => b,
      handler: (handler: unknown) => handler,
    };
    return b;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: f.authorize,
    from: () => {
      const b = {
        select: () => b,
        eq: (...a: unknown[]) => {
          f.filters.push(a);
          return b;
        },
        maybeSingle: async () => f.result,
      };
      return b;
    },
  },
}));
vi.mock("./video-playback.server", () => ({ signVideoPath: f.sign }));
vi.mock("./program-media.server", () => ({ signProgramPath: f.protectedSign }));
import { getVideoUrl } from "./videos.functions";
beforeEach(() => {
  f.filters = [];
  f.authorize.mockReset().mockResolvedValue({ data: [], error: null });
  f.protectedSign.mockReset().mockResolvedValue("signed-release");
  f.sign.mockReset().mockResolvedValue("signed-public-url");
});
describe("legacy public playback cannot bypass premium program access", () => {
  it("refuses a protected row even if a privileged response ignores the query filter", async () => {
    f.result = {
      data: {
        path: "bunny:999:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        access_scope: "program",
      },
      error: null,
    };
    await expect(
      getVideoUrl({ data: { id: "11111111-1111-4111-8111-111111111111" } }),
    ).rejects.toThrow("not found");
    expect(f.sign).not.toHaveBeenCalled();
  });
  it("continues signing approved public workouts and requires approved status", async () => {
    f.result = {
      data: {
        path: "bunny:123:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        access_scope: "public",
      },
      error: null,
    };
    expect(
      await getVideoUrl({
        data: { id: "11111111-1111-4111-8111-111111111111" },
      }),
    ).toBe("signed-public-url");
    expect(f.authorize).not.toHaveBeenCalled();
    expect(f.filters).toContainEqual(["review_status", "approved"]);
  });
});
