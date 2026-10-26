-- Review/apply in the SQL phase only. All changes are validated in isolated PostgreSQL.
-- Replace the competing historical live trigger with one authoritative implementation.
DROP TRIGGER IF EXISTS live_trainer_eligibility_guard ON public.live_sessions;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled'
 CHECK(status IN ('scheduled','live','ended','cancelled'));
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 500 CHECK(price_cents=500);

CREATE OR REPLACE FUNCTION public.trainer_is_eligible(p_user_id uuid,p_live boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM profiles WHERE id=p_user_id AND role='trainer')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified'
  AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id
  AND expires ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND expires>=to_char(current_date,'YYYY-MM-DD')
  AND name ~* '\m(CPR|cardiopulmonary resuscitation)\M')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified'
  AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id
  AND expires ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND expires>=to_char(current_date,'YYYY-MM-DD')
  AND name ~* '\m(AED|automated external defibrillator)\M')
 AND (NOT p_live OR (SELECT count(*) FROM trainer_videos WHERE user_id=p_user_id AND review_status='approved')>=5)
$$;
REVOKE ALL ON FUNCTION public.trainer_is_eligible(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_is_eligible(uuid,boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.check_trainer_live_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.trainer_id<>OLD.trainer_id THEN RAISE EXCEPTION 'Cannot reassign a class'; END IF;
 IF NOT public.trainer_is_eligible(NEW.trainer_id,true) THEN RAISE EXCEPTION 'Current verified CPR/AED and five approved videos required'; END IF;
 IF NEW.starts_at<now() AND (TG_OP='INSERT' OR NEW.starts_at IS DISTINCT FROM OLD.starts_at)
 THEN RAISE EXCEPTION 'Cannot schedule in the past'; END IF;
 RETURN NEW;
END $$;

-- Financial data cannot be edited via mutable browser profile snapshots.
CREATE OR REPLACE FUNCTION public.protect_profile_finances()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') THEN
  IF TG_OP='INSERT' AND (NEW.tokens<>0 OR NEW.ledger<>'[]'::jsonb OR NEW.bookings<>'[]'::jsonb OR NEW.joined<>'[]'::jsonb)
  THEN RAISE EXCEPTION 'Financial state is server managed'; END IF;
  IF TG_OP='UPDATE' AND (NEW.tokens IS DISTINCT FROM OLD.tokens OR NEW.ledger IS DISTINCT FROM OLD.ledger
   OR NEW.bookings IS DISTINCT FROM OLD.bookings OR NEW.joined IS DISTINCT FROM OLD.joined)
  THEN RAISE EXCEPTION 'Financial state is server managed'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_financial_guard ON public.profiles;
CREATE TRIGGER profile_financial_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_finances();
-- No account becomes an admin on the basis of an unverified email address.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.profiles(id,name,role) VALUES(NEW.id,
 coalesce(NEW.raw_user_meta_data->>'name',split_part(NEW.email,'@',1)),
 CASE WHEN NEW.raw_user_meta_data->>'requested_role'='trainer' THEN 'trainer' ELSE 'member' END)
 ON CONFLICT(id) DO NOTHING;
 RETURN NEW;
END $$;

-- Immutable evidence and append-only review history. Renewals always create new rows.
CREATE TABLE IF NOT EXISTS public.credential_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 credential_id uuid NOT NULL REFERENCES public.certifications(id),reviewer_id uuid NOT NULL,
 status text NOT NULL,note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.credential_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.credential_reviews TO authenticated;
DROP POLICY IF EXISTS credential_review_read ON public.credential_reviews;
CREATE POLICY credential_review_read ON public.credential_reviews FOR SELECT TO authenticated USING(
 public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM certifications c WHERE c.id=credential_reviews.credential_id AND c.user_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.guard_credential()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF current_setting('role',true)='authenticated' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.status<>'pending' OR NEW.verified_at IS NOT NULL OR NEW.verified_by IS NOT NULL OR NEW.note<>''
    OR NEW.user_id<>auth.uid() OR NEW.document_path IS NULL OR split_part(NEW.document_path,'/',1)<>auth.uid()::text
    THEN RAISE EXCEPTION 'Invalid credential submission'; END IF;
  ELSE
   IF NOT public.has_role(auth.uid(),'admin') OR auth.uid()=OLD.user_id THEN RAISE EXCEPTION 'Independent admin review required'; END IF;
   IF (NEW.user_id,NEW.name,NEW.expires,NEW.document_path,NEW.credential_id,NEW.issuing_organization)
     IS DISTINCT FROM (OLD.user_id,OLD.name,OLD.expires,OLD.document_path,OLD.credential_id,OLD.issuing_organization)
     THEN RAISE EXCEPTION 'Evidence is immutable; submit a renewal'; END IF;
   NEW.verified_by=auth.uid(); NEW.verified_at=now();
   INSERT INTO credential_reviews(credential_id,reviewer_id,status,note) VALUES(OLD.id,auth.uid(),NEW.status,NEW.note);
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS credential_guard ON certifications;
CREATE TRIGGER credential_guard BEFORE INSERT OR UPDATE ON certifications FOR EACH ROW EXECUTE FUNCTION guard_credential();
DROP POLICY IF EXISTS "own delete unverified" ON certifications;
-- All submitted records, including rejections, remain auditable.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('trainer-certificates','trainer-certificates',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=least(coalesce(storage.buckets.file_size_limit,10485760),10485760),
 allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp'];
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
 AND (coalesce(qual,'')||coalesce(with_check,'')) LIKE '%trainer-certificates%' LOOP
 EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname); END LOOP;
END $$;
DROP POLICY IF EXISTS certificate_private_read ON storage.objects;
CREATE POLICY certificate_private_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='trainer-certificates'
 AND ((storage.foldername(name))[1]=auth.uid()::text OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS certificate_own_insert ON storage.objects;
CREATE POLICY certificate_own_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='trainer-certificates'
 AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS certificate_orphan_delete ON storage.objects;
CREATE POLICY certificate_orphan_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='trainer-certificates'
 AND (storage.foldername(name))[1]=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM certifications WHERE document_path=storage.objects.name));

CREATE TABLE IF NOT EXISTS public.video_uploads(guid uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),library_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.video_uploads ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.guard_workout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b integer; previous integer := -300;
BEGIN
 IF NEW.minutes<1 OR NEW.minutes>300 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 FOR b IN SELECT unnest(NEW.breaks) ORDER BY 1 LOOP
  IF b<180 OR b>NEW.minutes*60-120 OR b-previous<300 THEN RAISE EXCEPTION 'Invalid water break'; END IF;
  previous=b;
 END LOOP;
 IF current_setting('role',true)='authenticated' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.review_status<>'pending' OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL
    OR NEW.review_note<>'' OR NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Videos require review'; END IF;
   IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer') THEN RAISE EXCEPTION 'Trainer account required'; END IF;
   IF NEW.path LIKE 'bunny:%' THEN
    IF NOT EXISTS(SELECT 1 FROM video_uploads WHERE guid::text=split_part(NEW.path,':',3)
      AND library_id=split_part(NEW.path,':',2) AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Unknown upload ownership'; END IF;
   ELSIF split_part(NEW.path,'/',1)<>auth.uid()::text THEN RAISE EXCEPTION 'Invalid video owner'; END IF;
  ELSE
   IF NEW.user_id<>OLD.user_id OR NEW.path<>OLD.path THEN RAISE EXCEPTION 'Cannot reassign media'; END IF;
   IF NOT public.has_role(auth.uid(),'admin') THEN
    IF (NEW.review_status,NEW.reviewed_at,NEW.reviewed_by,NEW.review_note) IS DISTINCT FROM
      (OLD.review_status,OLD.reviewed_at,OLD.reviewed_by,OLD.review_note) THEN RAISE EXCEPTION 'Admins review videos'; END IF;
    NEW.review_status='pending'; NEW.reviewed_at=NULL; NEW.reviewed_by=NULL; NEW.review_note='';
   ELSIF OLD.user_id=auth.uid() THEN RAISE EXCEPTION 'Cannot review own video'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS workout_guard ON trainer_videos;
CREATE TRIGGER workout_guard BEFORE INSERT OR UPDATE ON trainer_videos FOR EACH ROW EXECUTE FUNCTION guard_workout();
DROP POLICY IF EXISTS videos_owner_update ON trainer_videos;
CREATE POLICY videos_owner_update ON trainer_videos FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

-- Public posts belong to real Trybe leaders. Member posts/interactions stay within membership.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','private'));
GRANT SELECT ON posts TO anon;
GRANT UPDATE(visibility) ON posts TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_trybe_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF current_setting('role',true)='authenticated' THEN
  IF NEW.visibility='public' AND NOT (NEW.trybe='coach-'||auth.uid()::text AND
    EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer')) THEN RAISE EXCEPTION 'Only leaders publish public posts'; END IF;
  IF TG_OP='INSERT' AND (NEW.is_hidden OR NEW.is_pinned) THEN RAISE EXCEPTION 'Moderation flags are server managed'; END IF;
  IF TG_OP='UPDATE' AND (NEW.trybe,NEW.author_id) IS DISTINCT FROM (OLD.trybe,OLD.author_id) THEN RAISE EXCEPTION 'Cannot reassign a post'; END IF;
  SELECT name INTO NEW.author_name FROM profiles WHERE id=NEW.author_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trybe_post_guard ON posts;
CREATE TRIGGER trybe_post_guard BEFORE INSERT OR UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION guard_trybe_post();
DROP POLICY IF EXISTS posts_member_read ON posts;
DROP POLICY IF EXISTS posts_member_insert ON posts;
DROP POLICY IF EXISTS posts_visible ON posts;
CREATE POLICY posts_visible ON posts FOR SELECT TO anon,authenticated USING(
 NOT is_hidden AND (visibility='public' OR public.can_see_trybe(trybe) OR trybe='coach-'||auth.uid()::text)
 OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS posts_author_insert ON posts;
CREATE POLICY posts_author_insert ON posts FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid()
 AND (public.can_see_trybe(trybe) OR trybe='coach-'||auth.uid()::text));
DROP POLICY IF EXISTS posts_leader_visibility ON posts;
CREATE POLICY posts_leader_visibility ON posts FOR UPDATE TO authenticated USING(author_id=auth.uid() AND trybe='coach-'||auth.uid()::text)
 WITH CHECK(author_id=auth.uid() AND trybe='coach-'||auth.uid()::text);
GRANT EXECUTE ON FUNCTION public.can_see_trybe(text) TO anon;
DROP POLICY IF EXISTS comments_member_read ON post_comments;
DROP POLICY IF EXISTS comments_member_insert ON post_comments;
DROP POLICY IF EXISTS likes_member_read ON post_likes;
DROP POLICY IF EXISTS likes_member_insert ON post_likes;
DROP POLICY IF EXISTS comments_member_read ON post_comments;
CREATE POLICY comments_member_read ON post_comments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM posts p WHERE p.id=post_id AND public.can_see_trybe(p.trybe)));
DROP POLICY IF EXISTS comments_member_insert ON post_comments;
CREATE POLICY comments_member_insert ON post_comments FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND EXISTS(SELECT 1 FROM posts p WHERE p.id=post_id AND public.can_see_trybe(p.trybe)));
DROP POLICY IF EXISTS likes_member_read ON post_likes;
CREATE POLICY likes_member_read ON post_likes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM posts p WHERE p.id=post_id AND public.can_see_trybe(p.trybe)));
DROP POLICY IF EXISTS likes_member_insert ON post_likes;
CREATE POLICY likes_member_insert ON post_likes FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM posts p WHERE p.id=post_id AND public.can_see_trybe(p.trybe)));
-- Remove only the exact fictional fixtures introduced by 0002; retain real users and official posts.
DELETE FROM posts WHERE author_id IS NULL AND author_name IN ('Jess R.','Leo M.','Priya K.','Ana T.');
DELETE FROM reviews WHERE author_id IS NULL AND trainer_id IN ('maya','dre') AND author_name IN ('Jess R.','Leo M.');
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON trainer_store_items,trainer_programs,trainer_program_workouts TO authenticated;
GRANT SELECT ON trainer_store_items,trainer_programs,trainer_program_workouts TO anon;
-- Membership validation must not depend on the caller's private profiles SELECT policy.
CREATE OR REPLACE FUNCTION public.joinable_trybe(p_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_id IN ('g-postpartum','g-lowimpact','g-beginner','g-parents') OR EXISTS(
  SELECT 1 FROM profiles WHERE 'coach-'||id::text=p_id AND role='trainer')
$$;
REVOKE ALL ON FUNCTION public.joinable_trybe(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.joinable_trybe(text) TO authenticated;
DROP POLICY IF EXISTS trybe_memberships_own_insert ON trybe_memberships;
DROP POLICY IF EXISTS trybe_memberships_own_insert ON trybe_memberships;
CREATE POLICY trybe_memberships_own_insert ON trybe_memberships FOR INSERT TO authenticated
 WITH CHECK(user_id=auth.uid() AND public.joinable_trybe(trybe_id));
