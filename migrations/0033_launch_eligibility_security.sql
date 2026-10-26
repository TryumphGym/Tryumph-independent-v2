-- Step 2 (Supabase) only. Apply after 0019-0032, review against current production policies.
-- Trainer eligibility cannot be bypassed by direct API inserts or modified browser JavaScript.
CREATE OR REPLACE FUNCTION public.check_trainer_live_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_has_cpr boolean; v_has_aed boolean; v_approved integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.trainer_id IS DISTINCT FROM OLD.trainer_id THEN
    RAISE EXCEPTION 'Live classes cannot be reassigned to a different trainer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.trainer_id AND role='trainer') THEN
    RAISE EXCEPTION 'A verified trainer account is required';
  END IF;
  SELECT
    coalesce(bool_or(name ~* '(CPR|cardiopulmonary resuscitation)'),false),
    coalesce(bool_or(name ~* '(AED|automated external defibrillator)'),false)
  INTO v_has_cpr,v_has_aed FROM public.certifications
  WHERE user_id=NEW.trainer_id AND status='verified'
    AND verified_at IS NOT NULL AND verified_by IS NOT NULL
    AND CASE WHEN expires ~ '^\d{4}-\d{2}-\d{2}$'
      THEN expires::date >= current_date ELSE false END;
  IF NOT (v_has_cpr AND v_has_aed) THEN
    RAISE EXCEPTION 'Current, admin-verified CPR and AED certificates are required';
  END IF;
  SELECT count(*) INTO v_approved FROM public.trainer_videos
  WHERE user_id=NEW.trainer_id AND review_status='approved';
  IF v_approved < 5 THEN
    RAISE EXCEPTION 'Five approved on-demand workouts are required before hosting live classes';
  END IF;
  IF NEW.starts_at <= now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Cannot schedule classes in the past';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS live_trainer_eligibility ON public.live_sessions;
DROP TRIGGER IF EXISTS live_trainer_eligibility ON public.live_sessions;
CREATE TRIGGER live_trainer_eligibility BEFORE INSERT OR UPDATE OF trainer_id,starts_at ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.check_trainer_live_eligibility();

-- Approved public videos only, while trainers and admins can review their own/all pending records.
DROP POLICY IF EXISTS "public read" ON public.trainer_videos;
DROP POLICY IF EXISTS "public read approved videos" ON public.trainer_videos;
DROP POLICY IF EXISTS "trainers read own videos" ON public.trainer_videos;
DROP POLICY IF EXISTS "admins read all videos" ON public.trainer_videos;
DROP POLICY IF EXISTS "public read approved videos" ON public.trainer_videos;
CREATE POLICY "public read approved videos" ON public.trainer_videos
 FOR SELECT TO anon,authenticated USING(review_status='approved');
DROP POLICY IF EXISTS "trainers read own videos" ON public.trainer_videos;
CREATE POLICY "trainers read own videos" ON public.trainer_videos
 FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS "admins read all videos" ON public.trainer_videos;
CREATE POLICY "admins read all videos" ON public.trainer_videos
 FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own insert" ON public.trainer_videos;
DROP POLICY IF EXISTS "own insert" ON public.trainer_videos;
CREATE POLICY "own insert" ON public.trainer_videos FOR INSERT TO authenticated
 WITH CHECK(user_id=auth.uid() AND review_status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);
-- Owners should not be able to erase the historical record of a credential once verified.
DROP POLICY IF EXISTS "own delete" ON public.certifications;
DROP POLICY IF EXISTS "own delete unverified" ON public.certifications;
CREATE POLICY "own delete unverified" ON public.certifications
 FOR DELETE TO authenticated USING(user_id=auth.uid() AND status<>'verified');

-- Even a published program must never expose metadata about an unapproved or another trainer's video.
DROP POLICY IF EXISTS "program workouts read" ON public.trainer_program_workouts;
DROP POLICY IF EXISTS "program workouts read" ON public.trainer_program_workouts;
CREATE POLICY "program workouts read" ON public.trainer_program_workouts
 FOR SELECT TO anon,authenticated USING(EXISTS(
   SELECT 1 FROM public.trainer_programs p JOIN public.trainer_videos v ON v.id=video_id
   WHERE p.id=program_id AND p.trainer_id=v.user_id
     AND ((p.published AND v.review_status='approved') OR p.trainer_id=auth.uid())
 ));

-- Release old 8-parameter payment booking endpoint; all new Stripe bookings must consume a valid hold.
REVOKE ALL ON FUNCTION public.apply_paid_private_booking(text,uuid,text,text,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
DROP FUNCTION IF EXISTS public.apply_paid_private_booking(text,uuid,text,text,text,integer,integer,integer);

-- Limit ownership of public storefronts/programs to actual trainer profiles.
DROP POLICY IF EXISTS "store owner insert" ON public.trainer_store_items;
DROP POLICY IF EXISTS "store owner insert" ON public.trainer_store_items;
CREATE POLICY "store owner insert" ON public.trainer_store_items FOR INSERT TO authenticated
 WITH CHECK(trainer_id=auth.uid() AND EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='trainer'));
DROP POLICY IF EXISTS "programs owner insert" ON public.trainer_programs;
DROP POLICY IF EXISTS "programs owner insert" ON public.trainer_programs;
CREATE POLICY "programs owner insert" ON public.trainer_programs FOR INSERT TO authenticated
 WITH CHECK(trainer_id=auth.uid() AND EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='trainer'));
