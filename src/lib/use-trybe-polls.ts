import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "./community";
import type { TrybePoll } from "./polls";
export function useTrybePolls(ids: string[]) {
  const me = useUserId(),
    key = JSON.stringify([...new Set(ids)]),
    viewer = useRef(me);
  viewer.current = me;
  const [snapshot, setSnapshot] = useState<{
      viewer: string | null;
      key: string;
      polls: Record<string, TrybePoll>;
    }>({ viewer: me, key: "", polls: {} }),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    const requested = JSON.parse(key) as string[];
    if (!requested.length) {
      setSnapshot({ viewer: me, key, polls: {} });
      return;
    }
    void (async () => {
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < requested.length; i += 30)
          chunks.push(requested.slice(i, i + 30));
        const results = await Promise.all(
          chunks.map((p_ids) => supabase.rpc("read_trybe_polls", { p_ids })),
        );
        if (!active) return;
        if (results.some((r) => r.error))
          throw new Error("Polls could not load. Refresh to try again.");
        const polls = Object.fromEntries(
          results.flatMap((r) =>
            (r.data as unknown as TrybePoll[]).map((p) => [p.id, p]),
          ),
        );
        setSnapshot({ viewer: me, key, polls });
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Polls unavailable");
      }
    })();
    return () => {
      active = false;
    };
  }, [key, me, version]);
  return {
    polls: snapshot.viewer === me && snapshot.key === key ? snapshot.polls : {},
    error,
    refresh: () => setVersion((n) => n + 1),
    update: (p: TrybePoll) => {
      if (viewer.current === me)
        setSnapshot((old) =>
          old.viewer === me
            ? { ...old, polls: { ...old.polls, [p.id]: p } }
            : old,
        );
    },
  };
}
