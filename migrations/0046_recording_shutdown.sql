GRANT SELECT ON live_recordings TO authenticated;
DROP POLICY IF EXISTS recording_admin_read ON live_recordings;
CREATE POLICY recording_admin_read ON live_recordings FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS recording_enabled boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.room_shutdown_jobs(session_id uuid PRIMARY KEY REFERENCES live_sessions(id),completed_at timestamptz);
ALTER TABLE room_shutdown_jobs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON room_shutdown_jobs TO service_role;
CREATE OR REPLACE FUNCTION public.queue_room_shutdown()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IN ('ended','cancelled') THEN INSERT INTO room_shutdown_jobs(session_id) VALUES(NEW.id) ON CONFLICT DO NOTHING; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS room_shutdown ON live_sessions;
CREATE TRIGGER room_shutdown AFTER UPDATE OF status ON live_sessions FOR EACH ROW EXECUTE FUNCTION queue_room_shutdown();
