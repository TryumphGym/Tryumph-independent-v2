-- Review and run in Supabase later; replaces the legacy profile JSON membership trust model.
CREATE TABLE IF NOT EXISTS public.trybe_memberships (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trybe_id text NOT NULL CHECK (length(trybe_id) BETWEEN 2 AND 120),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trybe_id)
);
ALTER TABLE public.trybe_memberships ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.trybe_memberships TO authenticated;
DROP POLICY IF EXISTS trybe_memberships_own_select ON public.trybe_memberships;
DROP POLICY IF EXISTS trybe_memberships_own_select ON public.trybe_memberships;
CREATE POLICY trybe_memberships_own_select ON public.trybe_memberships FOR SELECT TO authenticated USING (user_id=auth.uid());
DROP POLICY IF EXISTS trybe_memberships_own_insert ON public.trybe_memberships;
DROP POLICY IF EXISTS trybe_memberships_own_insert ON public.trybe_memberships;
CREATE POLICY trybe_memberships_own_insert ON public.trybe_memberships FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS trybe_memberships_own_delete ON public.trybe_memberships;
DROP POLICY IF EXISTS trybe_memberships_own_delete ON public.trybe_memberships;
CREATE POLICY trybe_memberships_own_delete ON public.trybe_memberships FOR DELETE TO authenticated USING (user_id=auth.uid());
-- Backfill existing memberships before switching RLS.
INSERT INTO public.trybe_memberships(user_id,trybe_id)
SELECT p.id, v.value FROM public.profiles p
CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(p.extra->'joinedTrybes')='array' THEN p.extra->'joinedTrybes' ELSE '[]'::jsonb END) v(value)
WHERE length(v.value) BETWEEN 2 AND 120
ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.can_see_trybe(_trybe text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trybe_memberships m
    WHERE m.user_id=auth.uid() AND m.trybe_id=_trybe
  );
$$;
REVOKE ALL ON FUNCTION public.can_see_trybe(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_trybe(text) TO authenticated;
-- Remove all permissive policies, not just the last named policy: Postgres ORs permissive policies.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='posts' LOOP
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.posts',r.policyname);
 END LOOP;
 FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='post_comments' LOOP
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_comments',r.policyname);
 END LOOP;
 FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='post_likes' LOOP
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_likes',r.policyname);
 END LOOP;
END $$;
DROP POLICY IF EXISTS posts_member_read ON public.posts;
CREATE POLICY posts_member_read ON public.posts FOR SELECT TO authenticated USING (public.can_see_trybe(trybe));
DROP POLICY IF EXISTS posts_member_insert ON public.posts;
CREATE POLICY posts_member_insert ON public.posts FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid() AND public.can_see_trybe(trybe));
DROP POLICY IF EXISTS posts_owner_delete ON public.posts;
CREATE POLICY posts_owner_delete ON public.posts FOR DELETE TO authenticated USING (author_id=auth.uid());
DROP POLICY IF EXISTS comments_member_read ON public.post_comments;
CREATE POLICY comments_member_read ON public.post_comments FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id));
DROP POLICY IF EXISTS comments_member_insert ON public.post_comments;
CREATE POLICY comments_member_insert ON public.post_comments FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid() AND EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id));
DROP POLICY IF EXISTS comments_owner_delete ON public.post_comments;
CREATE POLICY comments_owner_delete ON public.post_comments FOR DELETE TO authenticated USING (author_id=auth.uid());
DROP POLICY IF EXISTS likes_member_read ON public.post_likes;
CREATE POLICY likes_member_read ON public.post_likes FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id));
DROP POLICY IF EXISTS likes_member_insert ON public.post_likes;
CREATE POLICY likes_member_insert ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id));
DROP POLICY IF EXISTS likes_owner_delete ON public.post_likes;
CREATE POLICY likes_owner_delete ON public.post_likes FOR DELETE TO authenticated USING (user_id=auth.uid());
REVOKE SELECT ON public.posts, public.post_comments, public.post_likes FROM anon;
