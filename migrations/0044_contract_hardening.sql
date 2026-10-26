CREATE OR REPLACE FUNCTION public.valid_iso_date(p_value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN p_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND (p_value::date)::text=p_value;
EXCEPTION WHEN OTHERS THEN RETURN false; END $$;
-- Program mutations must never associate someone else's video, even using direct REST writes.
DROP POLICY IF EXISTS "program workouts insert" ON trainer_program_workouts;
DROP POLICY IF EXISTS "program workouts update" ON trainer_program_workouts;
DROP POLICY IF EXISTS program_workouts_owner_insert ON trainer_program_workouts;
CREATE POLICY program_workouts_owner_insert ON trainer_program_workouts FOR INSERT TO authenticated WITH CHECK(
 EXISTS(SELECT 1 FROM trainer_programs p JOIN trainer_videos v ON v.id=video_id
  WHERE p.id=program_id AND p.trainer_id=auth.uid() AND v.user_id=auth.uid() AND v.review_status='approved'));
DROP POLICY IF EXISTS program_workouts_owner_update ON trainer_program_workouts;
CREATE POLICY program_workouts_owner_update ON trainer_program_workouts FOR UPDATE TO authenticated USING(
 EXISTS(SELECT 1 FROM trainer_programs WHERE id=program_id AND trainer_id=auth.uid())) WITH CHECK(
 EXISTS(SELECT 1 FROM trainer_programs p JOIN trainer_videos v ON v.id=video_id
  WHERE p.id=program_id AND p.trainer_id=auth.uid() AND v.user_id=auth.uid() AND v.review_status='approved'));

CREATE OR REPLACE FUNCTION public.trainer_is_eligible(p_user_id uuid,p_live boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM profiles WHERE id=p_user_id AND role='trainer')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified'
  AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id
  AND public.valid_iso_date(expires) AND expires>=to_char(current_date,'YYYY-MM-DD')
  AND name ~* '\m(CPR|cardiopulmonary resuscitation)\M')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified'
  AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id
  AND public.valid_iso_date(expires) AND expires>=to_char(current_date,'YYYY-MM-DD')
  AND name ~* '\m(AED|automated external defibrillator)\M')
 AND (NOT p_live OR (SELECT count(*) FROM trainer_videos WHERE user_id=p_user_id AND review_status='approved')>=5)
$$;
