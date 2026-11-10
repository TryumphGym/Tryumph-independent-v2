-- Restore authorized scheduled-public creator video visibility without exposing
-- premium video rows through public.trainer_videos RLS.
-- The invoker view calls this narrowly filtered, read-only internal function.
BEGIN;
SET LOCAL lock_timeout='5s';

CREATE FUNCTION tryumph_internal.public_workout_catalog_rows()
RETURNS SETOF public.public_workout_catalog
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $catalog$
 SELECT
  v.id,v.user_id,v.title,v.category,v.level,v.path,v.created_at,v.minutes,
  v.equipment,v.pregnancy_safe,v.playlist,v.breaks,v.break_seconds,
  v.required_equipment,v.optional_equipment,v.description,v.spotify_url,
  v.review_status,v.access_scope,v.discovery_tags,
  public.discovery_focus(
    v.discovery_tags,
    v.category||' '||v.level||' '||
      coalesce(split_part(v.equipment,'|',2),'')||' '||
      coalesce(split_part(v.equipment,'|',3),'')||
      CASE WHEN v.pregnancy_safe THEN ' prenatal' ELSE '' END
  ) AS discovery_focus_tags,
  v.intensity,v.modification_notes
 FROM public.trainer_videos v
 WHERE v.review_status='approved'
   AND (v.access_scope='public' OR public.creator_video_public(v.id))
   AND v.category !~* 'youth|homeschool|nutrition'
$catalog$;
REVOKE ALL ON FUNCTION tryumph_internal.public_workout_catalog_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tryumph_internal.public_workout_catalog_rows()
  TO anon,authenticated,service_role;

-- Preserve the original catalog's exact 23-column result contract and
-- security_invoker flag, while keeping all raw premium rows behind RLS.
CREATE OR REPLACE VIEW public.public_workout_catalog
 WITH (security_barrier=true,security_invoker=true) AS
 SELECT * FROM tryumph_internal.public_workout_catalog_rows();

DO $verify$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_class
  WHERE oid='public.public_workout_catalog'::regclass
    AND reloptions @> ARRAY['security_invoker=true']::text[]
 ) THEN RAISE EXCEPTION 'Workout catalog must use caller privileges'; END IF;
 IF EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public' AND tablename='trainer_videos'
  AND policyname='program_premium_read_guard'
  AND (permissive<>'RESTRICTIVE')
 ) THEN RAISE EXCEPTION 'Protected video RLS must remain restrictive'; END IF;
END $verify$;
COMMIT;
