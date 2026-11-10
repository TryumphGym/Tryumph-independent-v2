import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, sess) =>
      setId(sess?.user.id ?? null),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return id;
}

export type CPost = {
  id: string;
  visibility: string;
  audience?: string;
  official?: boolean;
  is_hidden?: boolean;
  is_pinned?: boolean;
  author_id: string | null;
  author_name: string;
  trybe: string;
  kind: string;
  text: string;
  created_at: string;
  likes: number;
  liked: boolean;
  comments: {
    id: string;
    author_id: string;
    author_name: string;
    text: string;
  }[];
};
export type Friend = {
  friend_id: string;
  friend_name: string;
  partner: boolean;
};
export type FriendRequest = {
  requester_id: string;
  recipient_id: string;
  requester_name: string;
  recipient_name: string;
};
export function useFriendRequests(me: string | null) {
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const reload = useCallback(async () => {
    if (!me) {
      setIncoming([]);
      setOutgoing([]);
      return;
    }
    const { data, error } = await supabase
      .from("friend_requests")
      .select("requester_id,recipient_id,requester_name,recipient_name")
      .or(`requester_id.eq.${me},recipient_id.eq.${me}`);
    if (error) {
      console.error("Friend requests unavailable", error);
      return;
    }
    setIncoming((data ?? []).filter((item) => item.recipient_id === me));
    setOutgoing((data ?? []).filter((item) => item.requester_id === me));
  }, [me]);
  useEffect(() => {
    void reload();
    const poll = window.setInterval(() => {
      void reload();
    }, 5000);
    return () => window.clearInterval(poll);
  }, [reload]);
  return { incoming, outgoing, reload };
}

export type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_name: string;
  text: string;
  created_at: string;
};

export function usePosts(
  me: string | null,
  selected = "all",
  joined: readonly string[] = [],
  focusId?: string,
  audience?: "community" | "public" | "subscribers",
) {
  const [posts, setPosts] = useState<CPost[]>([]),
    [page, setPage] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const joinedKey = JSON.stringify(joined),
    contextKey = JSON.stringify([
      me,
      selected,
      joined,
      focusId,
      version,
      audience,
    ]);
  const [snapshotKey, setSnapshotKey] = useState("");
  useEffect(() => {
    setPosts([]);
    setPage(0);
  }, [me, selected, joinedKey, version, focusId, audience]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        let query = supabase
          .from("posts")
          .select("*")
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(page * 20, page * 20 + 20);
        if (selected === "discover") query = query.eq("visibility", "public");
        else if (selected === "all")
          query = query.in("trybe", [...JSON.parse(joinedKey), "official"]);
        else query = query.eq("trybe", selected);
        if (audience === "public") query = query.eq("visibility", "public");
        else if (audience === "subscribers")
          query = query.in("audience", ["subscribers", "both"]);
        else if (audience === "community")
          query = query.neq("audience", "subscribers");
        const r = await query;
        if (r.error) throw r.error;
        let rows = r.data.slice(0, 20);
        if (focusId && page === 0 && !rows.some((p) => p.id === focusId)) {
          const focus = await supabase
            .from("posts")
            .select("*")
            .eq("id", focusId)
            .maybeSingle();
          if (focus.error) throw focus.error;
          if (
            focus.data &&
            (selected === "all" || selected === "discover"
              ? selected !== "discover" || focus.data.visibility === "public"
              : focus.data.trybe === selected)
          )
            rows = [focus.data, ...rows];
        }
        const ids = rows.map((p) => p.id);
        const [l, c] = ids.length
          ? await Promise.all([
              supabase
                .from("post_likes")
                .select("post_id,user_id")
                .in("post_id", ids),
              supabase
                .from("post_comments")
                .select("id,post_id,author_id,author_name,text")
                .in("post_id", ids)
                .order("created_at"),
            ])
          : [
              { data: [], error: null },
              { data: [], error: null },
            ];
        if (l.error || c.error) throw l.error ?? c.error;
        if (!active) return;
        const mapped = rows.map((x) => ({
          ...x,
          likes: (l.data ?? []).filter((y) => y.post_id === x.id).length,
          liked:
            !!me &&
            (l.data ?? []).some((y) => y.post_id === x.id && y.user_id === me),
          comments: (c.data ?? []).filter((y) => y.post_id === x.id),
        }));
        setSnapshotKey(contextKey);
        setPosts((old) =>
          page === 0
            ? mapped
            : [
                ...old.filter((p) => !mapped.some((n) => n.id === p.id)),
                ...mapped,
              ],
        );
        setHasMore(r.data.length > 20);
      } catch (e) {
        if (active) setError("Community posts could not load. Please retry.");
        console.error("Trybe feed unavailable", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [me, selected, joinedKey, page, version, focusId, contextKey, audience]);
  return {
    posts: snapshotKey === contextKey ? posts : [],
    reload: () => {
      setPage(0);
      setVersion((n) => n + 1);
    },
    hasMore,
    loading,
    error,
    loadMore: () => setPage((n) => n + 1),
  };
}

export function useFriends(me: string | null) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const load = useCallback(async () => {
    if (!me) {
      setFriends([]);
      return;
    }
    const { data } = await supabase
      .from("friendships")
      .select("friend_id,friend_name,partner")
      .eq("user_id", me);
    setFriends(data ?? []);
  }, [me]);
  useEffect(() => {
    void load();
    const poll = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(poll);
  }, [load]);
  return { friends, reload: load };
}

export function useChat(me: string | null, other: string | null) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [version, refresh] = useState(0);
  useEffect(() => {
    if (!me || !other) {
      setMsgs([]);
      return;
    }
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`,
        )
        .order("created_at");
      if (alive) setMsgs(data ?? []);
    };
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 4000);
    const ch = supabase
      .channel(`chat-${me}-${other}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        load,
      )
      .subscribe();
    return () => {
      alive = false;
      window.clearInterval(interval);
      void supabase.removeChannel(ch);
    };
  }, [me, other, version]);
  return { msgs, refresh: () => refresh((x) => x + 1) };
}
