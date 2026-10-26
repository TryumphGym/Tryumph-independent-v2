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
    load();
  }, [load]);
  return { friends, reload: load };
}

export function useChat(me: string | null, other: string | null) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
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
    load();
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
      supabase.removeChannel(ch);
    };
  }, [me, other]);
  return msgs;
}
