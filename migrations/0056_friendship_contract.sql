-- Preserve current friend-request/unfriend UI and any already-applied manual data.
CREATE TABLE IF NOT EXISTS friend_requests (
 requester_id uuid NOT NULL REFERENCES auth.users(id),recipient_id uuid NOT NULL REFERENCES auth.users(id),
 requester_name text NOT NULL,recipient_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(requester_id,recipient_id),CHECK(requester_id<>recipient_id));
CREATE TABLE IF NOT EXISTS legacy_friendship_grants (
 user_id uuid NOT NULL,friend_id uuid NOT NULL,PRIMARY KEY(user_id,friend_id));
-- Grandfather existing partner messaging, without allowing new unilateral friend inserts.
INSERT INTO legacy_friendship_grants SELECT user_id,friend_id FROM friendships WHERE partner ON CONFLICT DO NOTHING;
ALTER TABLE legacy_friendship_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_friendship_grants FROM PUBLIC,anon,authenticated;
GRANT ALL ON legacy_friendship_grants TO service_role;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON friend_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON friend_requests TO authenticated;
GRANT ALL ON friend_requests TO service_role;
DROP POLICY IF EXISTS friend_request_read ON friend_requests;
CREATE POLICY friend_request_read ON friend_requests FOR SELECT TO authenticated USING(auth.uid() IN(requester_id,recipient_id));
DROP POLICY IF EXISTS friend_request_read_guard ON friend_requests;
CREATE POLICY friend_request_read_guard ON friend_requests AS RESTRICTIVE FOR SELECT TO authenticated USING(auth.uid() IN(requester_id,recipient_id));
DROP POLICY IF EXISTS friend_request_insert ON friend_requests;
CREATE POLICY friend_request_insert ON friend_requests FOR INSERT TO authenticated WITH CHECK(requester_id=auth.uid() AND recipient_id<>auth.uid());
DROP POLICY IF EXISTS friend_request_delete ON friend_requests;
CREATE POLICY friend_request_delete ON friend_requests FOR DELETE TO authenticated USING(auth.uid() IN(requester_id,recipient_id));
CREATE OR REPLACE FUNCTION guard_friend_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.requester_id<>auth.uid() OR NEW.recipient_id=auth.uid() OR NOT account_can_act(auth.uid(),false)
 OR EXISTS(SELECT 1 FROM message_controls WHERE blocked AND ((user_id=NEW.requester_id AND other_id=NEW.recipient_id) OR (user_id=NEW.recipient_id AND other_id=NEW.requester_id))) THEN RAISE EXCEPTION 'Friend request unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('friend-request:'||auth.uid()::text));
 IF (SELECT count(*) FROM friend_requests WHERE requester_id=auth.uid() AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Friend request limit reached'; END IF;
 SELECT name INTO NEW.requester_name FROM profiles WHERE id=NEW.requester_id;
 SELECT name INTO NEW.recipient_name FROM profiles WHERE id=NEW.recipient_id;
 IF NEW.requester_name IS NULL OR NEW.recipient_name IS NULL THEN RAISE EXCEPTION 'Unknown account'; END IF;
 NEW.created_at=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_friend_request ON friend_requests;
CREATE TRIGGER guard_friend_request BEFORE INSERT ON friend_requests FOR EACH ROW EXECUTE FUNCTION guard_friend_request();
DROP POLICY IF EXISTS no_unilateral_friendships ON friendships;
CREATE POLICY no_unilateral_friendships ON friendships AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
CREATE OR REPLACE FUNCTION guard_friendship_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF current_setting('role',true)='authenticated' AND (NEW.user_id,NEW.friend_id,NEW.friend_name) IS DISTINCT FROM (OLD.user_id,OLD.friend_id,OLD.friend_name) THEN RAISE EXCEPTION 'Friend identities are immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_friendship_identity ON friendships;
CREATE TRIGGER guard_friendship_identity BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION guard_friendship_identity();
CREATE OR REPLACE FUNCTION accept_friend_request(p_requester_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r friend_requests%ROWTYPE; me uuid := auth.uid();
BEGIN
 IF me IS NULL OR p_requester_id=me OR NOT account_can_act(me,false) THEN RAISE EXCEPTION 'Invalid account'; END IF;
 SELECT * INTO r FROM friend_requests WHERE requester_id=p_requester_id AND recipient_id=me FOR UPDATE;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM friendships WHERE user_id=me AND friend_id=p_requester_id) AND EXISTS(SELECT 1 FROM friendships WHERE user_id=p_requester_id AND friend_id=me) THEN RETURN; END IF;
  RAISE EXCEPTION 'No incoming request';
 END IF;
 IF EXISTS(SELECT 1 FROM message_controls WHERE blocked AND ((user_id=me AND other_id=p_requester_id) OR (user_id=p_requester_id AND other_id=me))) THEN RAISE EXCEPTION 'Account is blocked'; END IF;
 INSERT INTO friendships(user_id,friend_id,friend_name) VALUES(me,p_requester_id,r.requester_name),(p_requester_id,me,r.recipient_name) ON CONFLICT DO NOTHING;
 DELETE FROM friend_requests WHERE (requester_id=p_requester_id AND recipient_id=me) OR (requester_id=me AND recipient_id=p_requester_id);
END $$;
CREATE OR REPLACE FUNCTION unfriend_user(p_friend_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR auth.uid()=p_friend_id THEN RAISE EXCEPTION 'Invalid friend'; END IF;
 DELETE FROM friendships WHERE (user_id=auth.uid() AND friend_id=p_friend_id) OR (user_id=p_friend_id AND friend_id=auth.uid());
 DELETE FROM legacy_friendship_grants WHERE (user_id=auth.uid() AND friend_id=p_friend_id) OR (user_id=p_friend_id AND friend_id=auth.uid());
 DELETE FROM friend_requests WHERE (requester_id=auth.uid() AND recipient_id=p_friend_id) OR (requester_id=p_friend_id AND recipient_id=auth.uid());
 -- Conversation history is preserved for its participants and safety reports.
END $$;
CREATE OR REPLACE FUNCTION remove_reverse_friendship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF pg_trigger_depth()=1 THEN
  DELETE FROM friendships WHERE user_id=OLD.friend_id AND friend_id=OLD.user_id;
  DELETE FROM legacy_friendship_grants WHERE (user_id=OLD.user_id AND friend_id=OLD.friend_id) OR (user_id=OLD.friend_id AND friend_id=OLD.user_id);
 END IF; RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS remove_reverse_friendship ON friendships;
CREATE TRIGGER remove_reverse_friendship AFTER DELETE ON friendships FOR EACH ROW EXECUTE FUNCTION remove_reverse_friendship();
CREATE OR REPLACE FUNCTION public.can_send_message(p_sender uuid,p_recipient uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_sender=auth.uid() AND p_sender<>p_recipient AND account_can_act(p_sender)
 AND account_can_act(p_recipient,false) AND NOT EXISTS(SELECT 1 FROM message_controls WHERE blocked AND
 ((user_id=p_sender AND other_id=p_recipient) OR (user_id=p_recipient AND other_id=p_sender)))
 AND (EXISTS(SELECT 1 FROM friendships f WHERE f.user_id=p_sender AND f.friend_id=p_recipient
  AND (EXISTS(SELECT 1 FROM friendships back WHERE back.user_id=p_recipient AND back.friend_id=p_sender)
   OR (f.partner AND EXISTS(SELECT 1 FROM legacy_friendship_grants g WHERE g.user_id=p_sender AND g.friend_id=p_recipient))))
 OR trainer_is_eligible(p_recipient,false)
 OR (EXISTS(SELECT 1 FROM profiles WHERE id=p_sender AND role='trainer') AND EXISTS(SELECT 1 FROM messages WHERE sender_id=p_recipient AND recipient_id=p_sender)))
$$;
REVOKE ALL ON FUNCTION accept_friend_request(uuid),unfriend_user(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION accept_friend_request(uuid),unfriend_user(uuid) TO authenticated;
INSERT INTO launch_schema_versions(version) VALUES('0056_friendship_contract') ON CONFLICT DO NOTHING;
-- A coach owns their Trybe without having to join it as a member.
CREATE OR REPLACE FUNCTION can_see_trybe(_trybe text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND (
  EXISTS(SELECT 1 FROM trybe_memberships WHERE user_id=auth.uid() AND trybe_id=_trybe)
  OR (_trybe='coach-'||auth.uid()::text AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer')))
$$;
DROP POLICY IF EXISTS friend_request_delete_guard ON friend_requests;
CREATE POLICY friend_request_delete_guard ON friend_requests AS RESTRICTIVE FOR DELETE TO authenticated USING(auth.uid() IN(requester_id,recipient_id));
DROP POLICY IF EXISTS friendship_update_guard ON friendships;
CREATE POLICY friendship_update_guard ON friendships AS RESTRICTIVE FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS friendship_delete_guard ON friendships;
CREATE POLICY friendship_delete_guard ON friendships AS RESTRICTIVE FOR DELETE TO authenticated USING(user_id=auth.uid());
