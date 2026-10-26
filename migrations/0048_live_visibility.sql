DROP POLICY IF EXISTS "anyone reads live sessions" ON live_sessions;
GRANT EXECUTE ON FUNCTION trainer_is_eligible(uuid,boolean) TO anon;
DROP POLICY IF EXISTS eligible_live_public ON live_sessions;
CREATE POLICY eligible_live_public ON live_sessions FOR SELECT TO anon,authenticated
 USING((status IN ('scheduled','live') AND trainer_is_eligible(trainer_id,true)) OR trainer_id=auth.uid() OR has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION trainer_attendance_count(p_trainer_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT count(*)::integer FROM live_room_access a JOIN live_sessions s ON s.id=a.session_id
 WHERE s.trainer_id=p_trainer_id AND a.first_joined_at>=now()-interval '30 days'
$$;
REVOKE ALL ON FUNCTION trainer_attendance_count(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION trainer_attendance_count(uuid) TO service_role;
