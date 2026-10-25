CREATE OR REPLACE FUNCTION public.can_see_trybe(_trybe text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _trybe NOT IN ('g-postpartum')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND COALESCE(p.extra->'joinedTrybes','[]'::jsonb) ? _trybe)
$$;
GRANT EXECUTE ON FUNCTION public.can_see_trybe(text) TO authenticated;

DROP POLICY IF EXISTS posts_read ON public.posts;
CREATE POLICY posts_read ON public.posts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND public.can_see_trybe(trybe));
DROP POLICY IF EXISTS posts_insert ON public.posts;
CREATE POLICY posts_insert ON public.posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND public.can_see_trybe(trybe));

DROP POLICY IF EXISTS comments_read ON public.post_comments;
CREATE POLICY comments_read ON public.post_comments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.posts x WHERE x.id = post_id AND public.can_see_trybe(x.trybe)));
DROP POLICY IF EXISTS comments_insert ON public.post_comments;
CREATE POLICY comments_insert ON public.post_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.posts x WHERE x.id = post_id AND public.can_see_trybe(x.trybe)));

DROP POLICY IF EXISTS likes_read ON public.post_likes;
CREATE POLICY likes_read ON public.post_likes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.posts x WHERE x.id = post_id AND public.can_see_trybe(x.trybe)));
DROP POLICY IF EXISTS likes_insert ON public.post_likes;
CREATE POLICY likes_insert ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.posts x WHERE x.id = post_id AND public.can_see_trybe(x.trybe)));