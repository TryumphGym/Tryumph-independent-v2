-- Targeted compatibility for the inspected mixed hosted schema (978 rows, 2026-10-27).
-- No table drops, account/media/message/financial-row changes, or paid-state backfills.
-- Existing stricter column grants, manual FK cascades, membership checks and extra
-- comments/trybes tables remain in place. Apply ONLY through the reviewed staging path.

-- PUBLIC role checks in approved-video/posts RLS must be executable by readers.
-- Preserve the hosted has_role implementation, empty search_path and ownership.
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO anon,authenticated,service_role;

-- RLS never protects TRUNCATE. Remove inherited client maintenance capabilities,
-- including on dormant tables. Keep ordinary DML and column ACLs unchanged.
DO $acl$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
  EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM PUBLIC,anon,authenticated',r.relname);
  IF current_setting('server_version_num')::integer>=170000 THEN
   EXECUTE format('REVOKE MAINTAIN ON public.%I FROM PUBLIC,anon,authenticated',r.relname);
  END IF;
 END LOOP;
END $acl$;
-- Confirmed unsafe defaults for postgres-owned public tables. Leave Supabase
-- role/schema ownership and service_role defaults intact.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 REVOKE TRUNCATE,REFERENCES,TRIGGER ON TABLES FROM anon,authenticated;
DO $defaults$ BEGIN
 IF current_setting('server_version_num')::integer>=170000 THEN
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN ON TABLES FROM anon,authenticated;
 END IF;
END $defaults$;

-- Restore missing launch read/notification contracts without reopening paused features.
GRANT SELECT ON public.trainer_accounts,public.trainer_earnings,public.waitlist_entries TO authenticated;
GRANT SELECT ON public.reviews TO anon,authenticated;
GRANT INSERT ON public.reviews TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.push_reminders TO authenticated;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.push_reminders'::regclass AND polname='own reminders') THEN
  CREATE POLICY "own reminders" ON public.push_reminders AS PERMISSIVE FOR ALL TO "authenticated" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.push_subscriptions'::regclass AND polname='own subs') THEN
  CREATE POLICY "own subs" ON public.push_subscriptions AS PERMISSIVE FOR ALL TO "authenticated" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.reviews'::regclass AND polname='reviews_insert') THEN
  CREATE POLICY reviews_insert ON public.reviews AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((author_id = auth.uid()));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.reviews'::regclass AND polname='reviews_read') THEN
  CREATE POLICY reviews_read ON public.reviews AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.trainer_accounts'::regclass AND polname='own or admin read') THEN
  CREATE POLICY "own or admin read" ON public.trainer_accounts AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.trainer_earnings'::regclass AND polname='own or admin read') THEN
  CREATE POLICY "own or admin read" ON public.trainer_earnings AS PERMISSIVE FOR SELECT TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM trainer_accounts a
  WHERE ((a.user_id = auth.uid()) AND ((a.slug = trainer_earnings.trainer_slug) OR ((a.user_id)::text = trainer_earnings.trainer_slug)))))));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.waitlist_entries'::regclass AND polname='admin read') THEN
  CREATE POLICY "admin read" ON public.waitlist_entries AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='avatars owner delete') THEN
  CREATE POLICY "avatars owner delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='avatars owner insert') THEN
  CREATE POLICY "avatars owner insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='avatars owner update') THEN
  CREATE POLICY "avatars owner update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='avatars public read') THEN
  CREATE POLICY "avatars public read" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'avatars'::text));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='videos own delete') THEN
  CREATE POLICY "videos own delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'videos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='videos own read') THEN
  CREATE POLICY "videos own read" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'videos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='videos own upload') THEN
  CREATE POLICY "videos own upload" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'videos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

-- The manual inquiry policy has an incorrectly correlated subquery and depends on
-- a profile SELECT that RLS denies for another account. Reuse its existing name;
-- the definer helper checks auth identity, mutual friendship/eligible inquiry,
-- blocks and account restrictions. Retain the separate RESTRICTIVE insert guard.
DO $inquiry$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.messages'::regclass
 AND polname='Trainer inquiries may be sent without friendship') THEN
  ALTER POLICY "Trainer inquiries may be sent without friendship" ON public.messages
   WITH CHECK(public.can_send_message(sender_id,recipient_id));
  -- 0051's additional permissive policy is redundant when the manual policy exists.
  DROP POLICY IF EXISTS launch_trainer_inquiries ON public.messages;
 END IF;
END $inquiry$;

-- Permissive policies combine with OR. Preserve the hosted rule that an already
-- accepted friendship cannot be bypassed to create a redundant request.
DROP POLICY IF EXISTS friend_request_insert_guard ON public.friend_requests;
CREATE POLICY friend_request_insert_guard ON public.friend_requests AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(requester_id=auth.uid() AND recipient_id<>auth.uid()
 AND NOT EXISTS(SELECT 1 FROM public.friendships f WHERE f.user_id=auth.uid() AND f.friend_id=friend_requests.recipient_id));

-- Retain the hosted announcement RPC's input validation and empty search_path,
-- while writing the launch official channel/flag and moderation audit together.
CREATE OR REPLACE FUNCTION public.publish_official_announcement(p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $publish$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 IF length(trim(coalesce(p_body,''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Invalid announcement length'; END IF;
 INSERT INTO public.posts(author_id,author_name,trybe,kind,text,visibility,official)
 VALUES(auth.uid(),'Tryumph Gym','official','Announcement',trim(p_body),'public',true) RETURNING id INTO result;
 INSERT INTO public.moderation_actions(actor_id,target_type,target_id,action)
 VALUES(auth.uid(),'post',result::text,'official_publish');
 RETURN result;
END $publish$;

-- Accommodate both historical announcements and the launch official flag/channel.
-- Preserve the old trigger binding and its function identity for existing clients.
CREATE OR REPLACE FUNCTION public.guard_official_posts()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $official$
BEGIN
 IF NEW.official OR NEW.trybe IN ('official','announcements') OR NEW.author_name='Tryumph Gym' OR NEW.kind='Announcement' THEN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Official announcements require admin access'; END IF;
  NEW.author_id=auth.uid(); NEW.author_name='Tryumph Gym'; NEW.kind='Announcement'; NEW.visibility='public';
  IF NEW.official THEN NEW.trybe='official'; ELSE NEW.trybe='announcements'; END IF;
 END IF;
 RETURN NEW;
END $official$;
CREATE OR REPLACE FUNCTION public.protect_official_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $official$
BEGIN
 IF NEW.official OR NEW.trybe='official' THEN
  IF current_setting('role',true)='authenticated' AND NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Official authorship is reserved'; END IF;
  IF NOT NEW.official OR NEW.trybe<>'official' THEN RAISE EXCEPTION 'Invalid official post'; END IF;
  NEW.author_name='Tryumph Gym';
 ELSIF NEW.trybe='announcements' THEN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Official announcements require admin access'; END IF;
  NEW.author_name='Tryumph Gym';
 END IF;
 RETURN NEW;
END $official$;

-- Add the missing reviewer FK without scanning/deleting historical videos.
-- Separate read-only orphan check and VALIDATE are required in staging.
DO $fk$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.trainer_videos'::regclass AND conname='trainer_videos_reviewed_by_fkey') THEN
  ALTER TABLE public.trainer_videos ADD CONSTRAINT trainer_videos_reviewed_by_fkey FOREIGN KEY(reviewed_by) REFERENCES auth.users(id) NOT VALID;
 END IF;
END $fk$;
INSERT INTO public.launch_schema_versions(version) VALUES('0057_hosted_compatibility') ON CONFLICT DO NOTHING;
