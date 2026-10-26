-- Step 2 only: authoritative coach Trybes, member access, and persistent coach moderation.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
-- Members may join free coach Trybes for REAL trainer accounts and four named goal Trybes.
DROP POLICY IF EXISTS trybe_memberships_own_insert ON public.trybe_memberships;
DROP POLICY IF EXISTS trybe_memberships_own_insert ON public.trybe_memberships;
CREATE POLICY trybe_memberships_own_insert ON public.trybe_memberships
  FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND (
    trybe_id IN ('g-postpartum','g-lowimpact','g-beginner','g-parents')
    OR (trybe_id ~ '^coach-[0-9a-f-]{36}$' AND EXISTS(
       SELECT 1 FROM public.profiles p
       WHERE p.id=substring(trybe_id FROM 7)::uuid AND p.role='trainer'))
  ));
DROP POLICY IF EXISTS posts_member_read ON public.posts;
DROP POLICY IF EXISTS posts_member_read ON public.posts;
CREATE POLICY posts_member_read ON public.posts FOR SELECT TO authenticated
 USING(public.can_see_trybe(trybe) AND (
    NOT is_hidden OR author_id=auth.uid() OR
    trybe='coach-'||auth.uid()::text OR public.has_role(auth.uid(),'admin')
  ));
CREATE OR REPLACE FUNCTION public.moderate_trybe_post(p_post_id uuid,p_action text,p_value boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_trybe text;
BEGIN
 SELECT trybe INTO v_trybe FROM public.posts WHERE id=p_post_id FOR UPDATE;
 IF v_trybe IS NULL OR NOT (v_trybe='coach-'||auth.uid()::text OR public.has_role(auth.uid(),'admin')) THEN
   RAISE EXCEPTION 'Only this Trybe coach or an admin can moderate posts';
 END IF;
 IF p_action='pin' THEN
   UPDATE public.posts SET is_pinned=p_value WHERE id=p_post_id;
 ELSIF p_action='hide' THEN
   UPDATE public.posts SET is_hidden=p_value WHERE id=p_post_id;
 ELSE RAISE EXCEPTION 'Unknown moderation action'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.moderate_trybe_post(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.moderate_trybe_post(uuid,text,boolean) TO authenticated;
