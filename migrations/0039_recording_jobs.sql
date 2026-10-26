CREATE TABLE IF NOT EXISTS public.recording_start_locks(session_id uuid PRIMARY KEY REFERENCES live_sessions(id),reserved_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE recording_start_locks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON recording_start_locks TO service_role;
CREATE OR REPLACE FUNCTION public.reserve_class_recording(p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO recording_start_locks(session_id) VALUES(p_session_id) ON CONFLICT(session_id)
 DO UPDATE SET reserved_at=now() WHERE recording_start_locks.reserved_at<now()-interval '10 minutes';
 RETURN FOUND;
END $$;
ALTER TABLE live_recordings ADD COLUMN IF NOT EXISTS import_lease_until timestamptz;
CREATE OR REPLACE FUNCTION public.claim_recording_import(p_egress_id text)
RETURNS SETOF live_recordings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY UPDATE live_recordings SET import_lease_until=now()+interval '15 minutes'
 WHERE egress_id=p_egress_id AND status='completed' AND import_status<>'ready'
 AND (import_lease_until IS NULL OR import_lease_until<now()) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION reserve_class_recording(uuid),claim_recording_import(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION reserve_class_recording(uuid),claim_recording_import(text) TO service_role;
