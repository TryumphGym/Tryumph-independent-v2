import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  requests: [] as {
    table: string;
    range: [number, number] | null;
    ids: string[] | null;
  }[],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const request = {
        table,
        range: null as [number, number] | null,
        ids: null as string[] | null,
      };
      f.requests.push(request);
      const b = {
        select: () => b,
        order: () => b,
        in: (_key: string, ids: string[]) => {
          request.ids = ids;
          return b;
        },
        eq: () => b,
        range: (a: number, z: number) => {
          request.range = [a, z];
          return b;
        },
        then: (resolve: (r: unknown) => unknown) => {
          const all = Array.from({ length: 45 }, (_, i) => ({
            id: `post-${i}`,
            author_id: "trainer",
            author_name: "Trainer",
            trybe: "coach-trainer",
            kind: i === 0 ? "Poll" : "Win",
            text: `Post ${i}`,
            created_at: "2026-10-31T00:00:00Z",
            visibility: "private",
          }));
          return Promise.resolve({
            data:
              table === "posts"
                ? all.slice(
                    request.range?.[0] ?? 0,
                    (request.range?.[1] ?? 44) + 1,
                  )
                : [],
            error: null,
          }).then(resolve);
        },
      };
      return b;
    },
  },
}));
import { usePosts } from "./community";
beforeEach(() => {
  f.requests = [];
});
afterEach(cleanup);
it("paginates posts and scopes comments and likes to the returned page", async () => {
  const { result } = renderHook(() =>
    usePosts("member", "coach-trainer", ["coach-trainer"]),
  );
  await waitFor(() => expect(result.current.posts).toHaveLength(20));
  expect(result.current.hasMore).toBe(true);
  expect(f.requests.find((r) => r.table === "posts")?.range).toEqual([0, 20]);
  expect(f.requests.find((r) => r.table === "post_comments")?.ids).toHaveLength(
    20,
  );
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.posts).toHaveLength(40));
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.posts).toHaveLength(45));
  expect(result.current.hasMore).toBe(false);
  expect(new Set(result.current.posts.map((p) => p.id)).size).toBe(45);
});
it("restarts pagination after refresh rather than losing earlier-page ordinary posts", async () => {
  const { result } = renderHook(() =>
    usePosts("member", "coach-trainer", ["coach-trainer"]),
  );
  await waitFor(() => expect(result.current.posts).toHaveLength(20));
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.posts).toHaveLength(40));
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.posts).toHaveLength(20));
  expect(result.current.posts[0]?.kind).toBe("Poll");
  expect(result.current.posts[1]?.kind).toBe("Win");
});
