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

export function usePosts(me: string | null) {
  const [posts, setPosts] = useState<CPost[]>([]);
  const load = useCallback(async () => {
    const [{ data: p }, { data: l }, { data: c }] = await Promise.all([
      supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("post_likes").select("post_id,user_id"),
      supabase
        .from("post_comments")
        .select("id,post_id,author_id,author_name,text")
        .order("created_at"),
    ]);
    setPosts(
      (p ?? []).map((x) => ({
        ...x,
        likes: (l ?? []).filter((y) => y.post_id === x.id).length,
        liked:
          !!me && (l ?? []).some((y) => y.post_id === x.id && y.user_id === me),
        comments: (c ?? []).filter((y) => y.post_id === x.id),
      })),
    );
  }, [me]);
  useEffect(() => {
    load();
  }, [load]);
  return { posts, reload: load };
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
