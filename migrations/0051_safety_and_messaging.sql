-- Additive launch backend. No hosted SQL is executed by this file's generation.
CREATE TABLE IF NOT EXISTS public.account_restrictions (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id), scope text NOT NULL CHECK(scope IN ('content','suspended')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000), admin_id uuid NOT NULL REFERENCES auth.users(id),
 active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.moderation_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL,target_type text NOT NULL,target_id text NOT NULL,
 action text NOT NULL,note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved')),created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION public.account_can_act(p_id uuid,p_content boolean DEFAULT true)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM account_restrictions WHERE user_id=p_id AND active AND (p_content OR scope='suspended'))
$$;
CREATE TABLE IF NOT EXISTS public.audience_announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 4000),
 audience text NOT NULL CHECK(audience IN ('trainers','members')),author_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS official boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.publish_targeted_announcement(p_body text,p_audience text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 INSERT INTO audience_announcements(body,audience,author_id) VALUES(trim(p_body),p_audience,auth.uid()) RETURNING id INTO result;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'announcement',result::text,'publish');
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.publish_official_announcement(p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 INSERT INTO posts(author_id,author_name,trybe,kind,text,visibility,official)
 VALUES(auth.uid(),'Tryumph Gym','official','Announcement',trim(p_body),'public',true) RETURNING id INTO result;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'post',result::text,'official_publish');
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.protect_official_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.official OR NEW.trybe='official' THEN
  IF current_setting('role',true)='authenticated' AND NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Official authorship is reserved'; END IF;
  IF NOT NEW.official OR NEW.trybe<>'official' THEN RAISE EXCEPTION 'Invalid official post'; END IF;
  NEW.author_name='Tryumph Gym';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_official_post ON posts;
CREATE TRIGGER zz_official_post BEFORE INSERT OR UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION protect_official_post();
-- Official publishing is an admin RPC; ordinary author rules still apply to all other posts.
DROP POLICY IF EXISTS official_post_insert ON posts;
CREATE POLICY official_post_insert ON posts FOR INSERT TO authenticated WITH CHECK(official AND trybe='official' AND has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.message_controls (
 user_id uuid NOT NULL REFERENCES auth.users(id),other_id uuid NOT NULL REFERENCES auth.users(id),blocked boolean NOT NULL DEFAULT false,
 muted boolean NOT NULL DEFAULT false,read_at timestamptz,PRIMARY KEY(user_id,other_id),CHECK(user_id<>other_id));
CREATE OR REPLACE FUNCTION public.can_send_message(p_sender uuid,p_recipient uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_sender=auth.uid() AND p_sender<>p_recipient AND account_can_act(p_sender)
 AND account_can_act(p_recipient,false) AND NOT EXISTS(SELECT 1 FROM message_controls WHERE blocked AND
  ((user_id=p_sender AND other_id=p_recipient) OR (user_id=p_recipient AND other_id=p_sender)))
 AND (EXISTS(SELECT 1 FROM friendships WHERE user_id=p_sender AND friend_id=p_recipient AND partner)
  OR trainer_is_eligible(p_recipient,false)
  OR (EXISTS(SELECT 1 FROM profiles WHERE id=p_sender AND role='trainer') AND
      EXISTS(SELECT 1 FROM messages WHERE sender_id=p_recipient AND recipient_id=p_sender)))
$$;
-- Keep existing friend policy and any reviewed inquiry policy. This restrictive guard also
-- constrains a manually installed permissive policy; its existence is shown in preflight.
DROP POLICY IF EXISTS launch_message_permission ON messages;
CREATE POLICY launch_message_permission ON messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(can_send_message(sender_id,recipient_id));
DROP POLICY IF EXISTS launch_trainer_inquiries ON messages;
CREATE POLICY launch_trainer_inquiries ON messages FOR INSERT TO authenticated WITH CHECK(can_send_message(sender_id,recipient_id));
CREATE OR REPLACE FUNCTION public.guard_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('message:'||NEW.sender_id::text));
 IF current_setting('role',true)='authenticated' THEN
  IF NOT can_send_message(NEW.sender_id,NEW.recipient_id) THEN RAISE EXCEPTION 'Messaging unavailable'; END IF;
  IF (SELECT count(*) FROM messages WHERE sender_id=NEW.sender_id AND created_at>now()-interval '1 minute')>=10
   OR (SELECT count(*) FROM messages WHERE sender_id=NEW.sender_id AND created_at>now()-interval '1 day')>=200
  THEN RAISE EXCEPTION 'Message limit reached. Please try later.'; END IF;
 END IF;
 SELECT name INTO NEW.sender_name FROM profiles WHERE id=NEW.sender_id;
 NEW.created_at=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS launch_guard_message ON messages;
CREATE TRIGGER launch_guard_message BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION guard_message();
CREATE INDEX IF NOT EXISTS messages_sender_time ON messages(sender_id,created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_time ON messages(recipient_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.message_contact_names()
RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,p.name FROM profiles p WHERE EXISTS(SELECT 1 FROM messages m WHERE
 (m.sender_id=auth.uid() AND m.recipient_id=p.id) OR (m.recipient_id=auth.uid() AND m.sender_id=p.id))
$$;

CREATE TABLE IF NOT EXISTS public.content_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id uuid NOT NULL REFERENCES auth.users(id),
 target_type text NOT NULL CHECK(target_type IN ('user','trainer','post','comment','message')),target_id uuid NOT NULL,
 reason text NOT NULL CHECK(reason IN ('inappropriate_content','harassment','unsafe_fitness_advice','misrepresentation','spam','other')),
 details text NOT NULL DEFAULT '' CHECK(length(details)<=2000),evidence text,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
 review_note text,reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION public.guard_content_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.reporter_id<>auth.uid() OR NEW.status<>'open' OR NEW.review_note IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.evidence IS NOT NULL THEN RAISE EXCEPTION 'Invalid report'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('report:'||auth.uid()::text));
 IF (SELECT count(*) FROM content_reports WHERE reporter_id=auth.uid() AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Report limit reached'; END IF;
 IF NEW.target_type IN ('user','trainer') THEN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=NEW.target_id AND (NEW.target_type='user' OR role='trainer')) THEN RAISE EXCEPTION 'Unknown account'; END IF;
 ELSIF NEW.target_type='post' THEN
  SELECT text INTO NEW.evidence FROM posts WHERE id=NEW.target_id AND NOT is_hidden AND (visibility='public' OR can_see_trybe(trybe) OR trybe='coach-'||auth.uid()::text);
 ELSIF NEW.target_type='comment' THEN
  SELECT c.text INTO NEW.evidence FROM post_comments c JOIN posts p ON p.id=c.post_id WHERE c.id=NEW.target_id AND can_see_trybe(p.trybe);
 ELSE
  SELECT text INTO NEW.evidence FROM messages WHERE id=NEW.target_id AND auth.uid() IN(sender_id,recipient_id);
 END IF;
 IF NEW.target_type IN ('post','comment','message') AND NEW.evidence IS NULL THEN RAISE EXCEPTION 'Cannot report inaccessible content'; END IF;
 NEW.created_at=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS launch_guard_report ON content_reports;
CREATE TRIGGER launch_guard_report BEFORE INSERT ON content_reports FOR EACH ROW EXECUTE FUNCTION guard_content_report();
CREATE OR REPLACE FUNCTION public.review_content_report(p_id uuid,p_status text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR p_status NOT IN ('reviewing','resolved','dismissed') OR length(p_note)>2000 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 UPDATE content_reports SET status=p_status,review_note=p_note,reviewed_at=now() WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown report'; END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'report',p_id::text,p_status,p_note);
END $$;
CREATE OR REPLACE FUNCTION public.restrict_account(p_id uuid,p_scope text,p_active boolean,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR p_id=auth.uid() OR has_role(p_id,'admin') OR length(trim(p_reason)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Independent admin action and reason required'; END IF;
 INSERT INTO account_restrictions(user_id,scope,reason,admin_id,active) VALUES(p_id,p_scope,trim(p_reason),auth.uid(),p_active)
 ON CONFLICT(user_id) DO UPDATE SET scope=excluded.scope,reason=excluded.reason,admin_id=auth.uid(),active=p_active,updated_at=now();
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'user',p_id::text,CASE WHEN p_active THEN p_scope ELSE 'restore' END,p_reason);
END $$;
CREATE OR REPLACE FUNCTION public.moderate_trybe_post(p_post_id uuid,p_action text,p_value boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE group_id text;
BEGIN
 SELECT trybe INTO group_id FROM posts WHERE id=p_post_id FOR UPDATE;
 IF group_id IS NULL OR NOT (group_id='coach-'||auth.uid()::text OR has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Only leader or admin'; END IF;
 IF p_action='pin' THEN UPDATE posts SET is_pinned=p_value WHERE id=p_post_id;
 ELSIF p_action='hide' THEN UPDATE posts SET is_hidden=p_value WHERE id=p_post_id;
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'post',p_post_id::text,p_action||':'||p_value::text);
END $$;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS comment_visibility_guard ON post_comments;
CREATE POLICY comment_visibility_guard ON post_comments AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT is_hidden OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS admin_comments_read ON post_comments;
CREATE POLICY admin_comments_read ON post_comments FOR SELECT TO authenticated USING(has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS admin_profiles_read ON profiles;
-- Profile moderation uses an allowlisted RPC below, not broad access to wellness/finance JSON.
CREATE OR REPLACE FUNCTION public.moderate_comment(p_id uuid,p_hidden boolean,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR length(trim(p_note)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Admin and reason required'; END IF;
 UPDATE post_comments SET is_hidden=p_hidden WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown comment'; END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'comment',p_id::text,'hide:'||p_hidden::text,p_note);
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['account_restrictions','moderation_actions','moderation_appeals','audience_announcements','message_controls','content_reports'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
GRANT SELECT ON account_restrictions,moderation_actions,moderation_appeals,audience_announcements,message_controls,content_reports TO authenticated;
GRANT INSERT ON moderation_appeals,content_reports,message_controls TO authenticated;
GRANT UPDATE(blocked,muted,read_at) ON message_controls TO authenticated;
DROP POLICY IF EXISTS restriction_read ON account_restrictions;
CREATE POLICY restriction_read ON account_restrictions FOR SELECT TO authenticated USING(user_id=auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS moderation_admin_read ON moderation_actions;
CREATE POLICY moderation_admin_read ON moderation_actions FOR SELECT TO authenticated USING(has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS appeal_read ON moderation_appeals;
CREATE POLICY appeal_read ON moderation_appeals FOR SELECT TO authenticated USING(user_id=auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS appeal_insert ON moderation_appeals;
CREATE POLICY appeal_insert ON moderation_appeals FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND status='open');
DROP POLICY IF EXISTS audience_read ON audience_announcements;
CREATE POLICY audience_read ON audience_announcements FOR SELECT TO authenticated USING(has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role=CASE WHEN audience='trainers' THEN 'trainer' ELSE 'member' END));
DROP POLICY IF EXISTS control_own ON message_controls;
CREATE POLICY control_own ON message_controls FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS report_read ON content_reports;
CREATE POLICY report_read ON content_reports FOR SELECT TO authenticated USING(has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS report_insert ON content_reports;
CREATE POLICY report_insert ON content_reports FOR INSERT TO authenticated WITH CHECK(reporter_id=auth.uid());
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['posts','post_comments','post_likes','trainer_videos','live_sessions'] LOOP
 EXECUTE format('DROP POLICY IF EXISTS launch_account_insert ON public.%I',t);
 EXECUTE format('CREATE POLICY launch_account_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.account_can_act(auth.uid()))',t);
 EXECUTE format('DROP POLICY IF EXISTS launch_account_update ON public.%I',t);
 EXECUTE format('CREATE POLICY launch_account_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.account_can_act(auth.uid())) WITH CHECK(public.account_can_act(auth.uid()))',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION account_can_act(uuid,boolean),can_send_message(uuid,uuid),message_contact_names(),publish_targeted_announcement(text,text),publish_official_announcement(text),review_content_report(uuid,text,text),restrict_account(uuid,text,boolean,text),moderate_comment(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION account_can_act(uuid,boolean) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION can_send_message(uuid,uuid),message_contact_names(),publish_targeted_announcement(text,text),publish_official_announcement(text),review_content_report(uuid,text,text),restrict_account(uuid,text,boolean,text),moderate_comment(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_trybe_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF current_setting('role',true)='authenticated' THEN
  IF NEW.visibility='public' AND (TG_OP='INSERT' OR NEW.visibility IS DISTINCT FROM OLD.visibility) AND NOT (NEW.official AND NEW.trybe='official' AND public.has_role(auth.uid(),'admin')) AND NOT (NEW.trybe='coach-'||auth.uid()::text AND
    EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer')) THEN RAISE EXCEPTION 'Only leaders publish public posts'; END IF;
  IF TG_OP='INSERT' AND (NEW.is_hidden OR NEW.is_pinned) THEN RAISE EXCEPTION 'Moderation flags are server managed'; END IF;
  IF TG_OP='UPDATE' AND (NEW.trybe,NEW.author_id) IS DISTINCT FROM (OLD.trybe,OLD.author_id) THEN RAISE EXCEPTION 'Cannot reassign a post'; END IF;
  SELECT name INTO NEW.author_name FROM profiles WHERE id=NEW.author_id;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION review_moderation_appeal(p_id uuid,p_status text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR p_status NOT IN ('reviewing','resolved') OR length(trim(p_note)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Admin review and reason required'; END IF;
 UPDATE moderation_appeals SET status=p_status WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown appeal'; END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'appeal',p_id::text,p_status,p_note);
END $$;
REVOKE ALL ON FUNCTION review_moderation_appeal(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION review_moderation_appeal(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_profile_directory()
RETURNS TABLE(id uuid,name text,role text,created_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 RETURN QUERY SELECT p.id,p.name,p.role,p.created_at FROM profiles p ORDER BY p.created_at DESC LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION admin_profile_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION admin_profile_directory() TO authenticated;
CREATE OR REPLACE FUNCTION guard_moderation_appeal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('appeal:'||auth.uid()::text));
 IF NEW.user_id<>auth.uid() OR NEW.status<>'open' OR (SELECT count(*) FROM moderation_appeals WHERE user_id=auth.uid() AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'Appeal unavailable or daily limit reached'; END IF;
 NEW.created_at=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS moderation_appeal_guard ON moderation_appeals;
CREATE TRIGGER moderation_appeal_guard BEFORE INSERT ON moderation_appeals FOR EACH ROW EXECUTE FUNCTION guard_moderation_appeal();
-- Privacy holds even if an older manual permissive SELECT policy remains.
DROP POLICY IF EXISTS message_participant_read_guard ON messages;
CREATE POLICY message_participant_read_guard ON messages AS RESTRICTIVE FOR SELECT TO authenticated
 USING(auth.uid() IN(sender_id,recipient_id));
DROP POLICY IF EXISTS report_admin_read_guard ON content_reports;
CREATE POLICY report_admin_read_guard ON content_reports AS RESTRICTIVE FOR SELECT TO authenticated
 USING(has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS announcement_audience_guard ON audience_announcements;
CREATE POLICY announcement_audience_guard ON audience_announcements AS RESTRICTIVE FOR SELECT TO authenticated
 USING(has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role=CASE WHEN audience='trainers' THEN 'trainer' ELSE 'member' END));
