CREATE TABLE IF NOT EXISTS notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),session_updates boolean NOT NULL DEFAULT true,
 credential_updates boolean NOT NULL DEFAULT true,friend_activity boolean NOT NULL DEFAULT false,share_live_activity boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS account_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),event_key text NOT NULL,
 category text NOT NULL CHECK(category IN ('session','credential','friend','milestone','moderation')),body text NOT NULL,
 href text NOT NULL DEFAULT '/account',read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,event_key));
CREATE TABLE IF NOT EXISTS account_activity_days (
 user_id uuid NOT NULL REFERENCES auth.users(id),day date NOT NULL,time_zone text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS trainer_credential_requirements (
 trainer_id uuid NOT NULL REFERENCES auth.users(id),credential_name text NOT NULL,created_by uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(trainer_id,credential_name));
CREATE OR REPLACE FUNCTION notify_account(p_user uuid,p_key text,p_category text,p_body text,p_href text DEFAULT '/account')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_category='session' AND EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=p_user AND NOT session_updates)
 OR p_category='credential' AND EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=p_user AND NOT credential_updates)
 OR p_category='friend' AND NOT EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=p_user AND friend_activity) THEN RETURN; END IF;
 INSERT INTO account_notifications(user_id,event_key,category,body,href) VALUES(p_user,p_key,p_category,p_body,p_href) ON CONFLICT DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION record_account_activity(p_time_zone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE local_day date; days jsonb; n integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_time_zone) THEN RAISE EXCEPTION 'Valid signed-in time zone required'; END IF;
 local_day=(now() AT TIME ZONE p_time_zone)::date;
 PERFORM 1 FROM profiles WHERE id=auth.uid() FOR UPDATE;
 INSERT INTO account_activity_days(user_id,day,time_zone) VALUES(auth.uid(),local_day,p_time_zone) ON CONFLICT DO NOTHING;
 SELECT coalesce(jsonb_agg(d ORDER BY d),'[]') INTO days FROM (
  SELECT value #>> '{}' AS d FROM profiles p CROSS JOIN LATERAL jsonb_array_elements(p.active_days) WHERE p.id=auth.uid() AND valid_iso_date(value #>> '{}') AND (value #>> '{}')<=local_day::text
  UNION SELECT day::text FROM account_activity_days WHERE user_id=auth.uid()) existing;
 UPDATE profiles SET active_days=days WHERE id=auth.uid();
 n=jsonb_array_length(days);
 IF n=ANY(ARRAY[1,7,30,100,365,500,1000,2000]) THEN
  PERFORM notify_account(auth.uid(),'activity:'||n,'milestone',n||' distinct signed-in active days. These are visits, not completed workouts.');
 END IF;
 RETURN days;
END $$;
CREATE OR REPLACE FUNCTION protect_activity_days()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF current_user IN ('anon','authenticated') AND NEW.active_days IS DISTINCT FROM OLD.active_days THEN NEW.active_days=OLD.active_days; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS activity_days_guard ON profiles;
CREATE TRIGGER activity_days_guard BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_activity_days();

CREATE OR REPLACE FUNCTION trainer_is_eligible(p_user_id uuid,p_live boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT account_can_act(p_user_id) AND EXISTS(SELECT 1 FROM profiles WHERE id=p_user_id AND role='trainer')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified'
  AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id
  AND valid_iso_date(expires) AND expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AND name ~* '\m(CPR|cardiopulmonary resuscitation)\M')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified'
  AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id
  AND valid_iso_date(expires) AND expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AND name ~* '\m(AED|automated external defibrillator)\M')
 AND NOT EXISTS(SELECT 1 FROM trainer_credential_requirements r WHERE r.trainer_id=p_user_id AND NOT EXISTS(
  SELECT 1 FROM certifications c WHERE c.user_id=p_user_id AND lower(c.name)=lower(r.credential_name) AND c.status='verified'
   AND c.verified_at IS NOT NULL AND c.verified_by IS NOT NULL AND c.verified_by<>c.user_id
   AND valid_iso_date(c.expires) AND c.expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')))
 AND (NOT p_live OR (SELECT count(*) FROM trainer_videos WHERE user_id=p_user_id AND review_status='approved')>=5)
$$;
DROP POLICY IF EXISTS trainer_new_content_eligibility ON trainer_videos;
CREATE POLICY trainer_new_content_eligibility ON trainer_videos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(trainer_is_eligible(auth.uid(),false));
DROP POLICY IF EXISTS trainer_content_edit_eligibility ON trainer_videos;
CREATE POLICY trainer_content_edit_eligibility ON trainer_videos AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(has_role(auth.uid(),'admin') OR trainer_is_eligible(auth.uid(),false)) WITH CHECK(has_role(auth.uid(),'admin') OR trainer_is_eligible(auth.uid(),false));
DROP POLICY IF EXISTS trainer_post_eligibility ON posts;
CREATE POLICY trainer_post_eligibility ON posts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 has_role(auth.uid(),'admin') OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer') OR trainer_is_eligible(auth.uid(),false));
CREATE OR REPLACE FUNCTION generate_credential_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; stage integer; days_left integer;
BEGIN
 FOR c IN SELECT * FROM certifications WHERE status='verified' AND verified_at IS NOT NULL AND verified_by<>user_id AND valid_iso_date(expires)
 AND NOT EXISTS(SELECT 1 FROM certifications newer WHERE newer.user_id=certifications.user_id AND lower(newer.name)=lower(certifications.name)
  AND newer.status='verified' AND newer.verified_at IS NOT NULL AND newer.verified_by<>newer.user_id AND valid_iso_date(newer.expires) AND newer.expires>certifications.expires) LOOP
  days_left=c.expires::date-(now() AT TIME ZONE 'America/Chicago')::date;
  stage=CASE WHEN days_left<0 THEN 0 WHEN days_left<=7 THEN 7 WHEN days_left<=14 THEN 14 WHEN days_left<=30 THEN 30 WHEN days_left<=60 THEN 60 ELSE NULL END;
  IF stage IS NOT NULL THEN
   PERFORM notify_account(c.user_id,'credential:'||c.id||':'||stage,'credential',c.name||CASE WHEN stage=0 THEN ' has expired. Renew with verified evidence before new training activity.' ELSE ' expires on '||c.expires||'. Please renew before expiry.' END,'/studio');
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION notify_class_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid; event_id uuid := gen_random_uuid();
BEGIN
 IF (NEW.status,NEW.title,NEW.starts_at) IS DISTINCT FROM (OLD.status,OLD.title,OLD.starts_at) THEN
  FOR u IN SELECT user_id FROM live_room_access WHERE session_id=NEW.id AND status IN ('paid','pending','cancelled') LOOP
   PERFORM notify_account(u,'class:'||NEW.id||':'||event_id,'session',NEW.title||' · '||NEW.status||' · '||NEW.starts_at,'/live');
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_class_change ON live_sessions;
CREATE TRIGGER notify_class_change AFTER UPDATE ON live_sessions FOR EACH ROW EXECUTE FUNCTION notify_class_change();
CREATE OR REPLACE FUNCTION notify_friend_attendance(p_user uuid,p_session uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=p_user AND share_live_activity) THEN RETURN; END IF;
 FOR f IN SELECT back.user_id FROM friendships back JOIN friendships mutual ON mutual.user_id=p_user AND mutual.friend_id=back.user_id AND mutual.partner
 WHERE back.friend_id=p_user AND back.partner AND NOT EXISTS(SELECT 1 FROM message_controls WHERE blocked AND ((user_id=p_user AND other_id=back.user_id) OR (user_id=back.user_id AND other_id=p_user))) LOOP
  PERFORM notify_account(f.user_id,'friend:'||p_user||':'||p_session,'friend','An accountability partner joined a community live class.','/live');
 END LOOP;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['notification_preferences','account_notifications','account_activity_days','trainer_credential_requirements'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON %I TO service_role',t); END LOOP;
END $$;
GRANT SELECT ON notification_preferences,account_notifications,account_activity_days,trainer_credential_requirements TO authenticated;
GRANT INSERT,UPDATE ON notification_preferences TO authenticated;
GRANT UPDATE(read_at) ON account_notifications TO authenticated;
GRANT INSERT,DELETE ON trainer_credential_requirements TO authenticated;
DROP POLICY IF EXISTS preferences_own ON notification_preferences;
CREATE POLICY preferences_own ON notification_preferences FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS notifications_own ON account_notifications;
CREATE POLICY notifications_own ON account_notifications FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS activity_own ON account_activity_days;
CREATE POLICY activity_own ON account_activity_days FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS requirements_read ON trainer_credential_requirements;
CREATE POLICY requirements_read ON trainer_credential_requirements FOR SELECT TO authenticated USING(trainer_id=auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS requirements_admin ON trainer_credential_requirements;
CREATE POLICY requirements_admin ON trainer_credential_requirements FOR ALL TO authenticated USING(has_role(auth.uid(),'admin')) WITH CHECK(has_role(auth.uid(),'admin') AND created_by=auth.uid());
REVOKE ALL ON FUNCTION notify_account(uuid,text,text,text,text),generate_credential_alerts(),notify_friend_attendance(uuid,uuid),record_account_activity(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION notify_account(uuid,text,text,text,text),generate_credential_alerts(),notify_friend_attendance(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION record_account_activity(text) TO authenticated;
-- Audience classification is protected after signup; role changes require trusted admin review.
CREATE OR REPLACE FUNCTION guard_profile_role()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF current_user IN ('anon','authenticated') AND NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION 'Account role changes require support'; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_role_guard ON profiles;
CREATE TRIGGER profile_role_guard BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_role();
-- Old partner-reservation RPC must honor explicit sharing and receiving consent too.
CREATE OR REPLACE FUNCTION public.partner_reservations()
RETURNS TABLE(friend_id uuid,friend_name text,reservations jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT f.friend_id,f.friend_name,p.reservations FROM friendships f
 JOIN friendships back ON back.user_id=f.friend_id AND back.friend_id=f.user_id AND back.partner
 JOIN profiles p ON p.id=f.friend_id
 JOIN notification_preferences sharing ON sharing.user_id=f.friend_id AND sharing.share_live_activity
 JOIN notification_preferences receiving ON receiving.user_id=auth.uid() AND receiving.friend_activity
 WHERE f.user_id=auth.uid() AND f.partner AND NOT EXISTS(SELECT 1 FROM message_controls WHERE blocked AND
 ((user_id=f.friend_id AND other_id=auth.uid()) OR (user_id=auth.uid() AND other_id=f.friend_id)))
$$;
CREATE OR REPLACE FUNCTION notify_restriction_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM notify_account(NEW.user_id,'restriction:'||NEW.updated_at,'moderation',CASE WHEN NEW.active THEN 'Account restriction: '||NEW.reason||'. You can submit an appeal from your notification center.' ELSE 'Your account restriction has been lifted.' END);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_restriction_change ON account_restrictions;
CREATE TRIGGER notify_restriction_change AFTER INSERT OR UPDATE ON account_restrictions FOR EACH ROW EXECUTE FUNCTION notify_restriction_change();
-- Raw fallback storage upload must enforce the same eligibility as Bunny tickets.
DROP POLICY IF EXISTS workout_storage_upload_guard ON storage.objects;
CREATE POLICY workout_storage_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'videos' OR ((storage.foldername(name))[1]=auth.uid()::text AND trainer_is_eligible(auth.uid(),false)));
DROP POLICY IF EXISTS workout_storage_replace_guard ON storage.objects;
CREATE POLICY workout_storage_replace_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'videos') WITH CHECK(bucket_id<>'videos');
