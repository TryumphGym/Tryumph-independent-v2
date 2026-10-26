CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid,
  author_name text NOT NULL,
  trybe text NOT NULL,
  kind text NOT NULL DEFAULT 'Goal',
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_read ON public.posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY posts_insert ON public.posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY posts_delete ON public.posts FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE TABLE public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY likes_read ON public.post_likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY likes_insert ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY likes_delete ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_read ON public.post_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY comments_insert ON public.post_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY comments_delete ON public.post_comments FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE TABLE public.friendships (
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  friend_name text NOT NULL,
  partner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY friends_own ON public.friendships FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  sender_name text NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_read ON public.messages FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, recipient_id));
CREATE POLICY messages_send ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.friendships f WHERE f.user_id = auth.uid() AND f.friend_id = recipient_id AND f.partner
  )
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id text NOT NULL,
  author_id uuid,
  author_name text NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  stars int NOT NULL DEFAULT 5 CHECK (stars BETWEEN 1 AND 5),
  reply text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_read ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY reviews_insert ON public.reviews FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- Mutual accountability partners can see each other's live reservations.
CREATE OR REPLACE FUNCTION public.partner_reservations()
RETURNS TABLE (friend_id uuid, friend_name text, reservations jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.friend_id, f.friend_name, p.reservations
  FROM public.friendships f
  JOIN public.friendships back ON back.user_id = f.friend_id AND back.friend_id = f.user_id AND back.partner
  JOIN public.profiles p ON p.id = f.friend_id
  WHERE f.user_id = auth.uid() AND f.partner;
$$;
REVOKE ALL ON FUNCTION public.partner_reservations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.partner_reservations() TO authenticated;

-- Historical fictional post/review seeds removed. Launch content must come from real users or clearly attributed Tryumph Gym posts.
