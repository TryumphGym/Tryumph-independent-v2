import { beforeEach, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  table: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: f.getUser },
    from: (table: string) => {
      f.table(table);
      return {
        select: () => ({
          eq: (key: string, value: string) => {
            f.eq(key, value);
            return { single: f.single };
          },
        }),
      };
    },
  },
}));
import { authenticatedExperience } from "./experience";
beforeEach(() => {
  vi.clearAllMocks();
  f.getUser.mockResolvedValue({
    data: { user: { id: "actual-authenticated-user" } },
    error: null,
  });
});
it.each([
  ["trainer", "/studio"],
  ["member", "/"],
] as const)(
  "routes the persisted %s role to %s using the authenticated identity",
  async (role, landing) => {
    localStorage.setItem(
      "tryumph-state",
      JSON.stringify({ role: role === "trainer" ? "member" : "trainer" }),
    );
    f.single.mockResolvedValue({ data: { role }, error: null });
    expect(await authenticatedExperience()).toEqual({
      userId: "actual-authenticated-user",
      landing,
    });
    expect(f.eq).toHaveBeenCalledWith("id", "actual-authenticated-user");
    expect(f.table).toHaveBeenCalledWith("profiles");
  },
);
it("does not route into creator tools when role verification or authentication fails", async () => {
  f.single.mockResolvedValue({
    data: null,
    error: { message: "Database unavailable" },
  });
  await expect(authenticatedExperience()).rejects.toThrow(
    "verify your account role",
  );
  f.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(authenticatedExperience()).rejects.toThrow("Sign in");
});
