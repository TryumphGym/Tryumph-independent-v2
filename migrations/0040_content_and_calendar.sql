INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('videos','videos',false,3221225472,ARRAY['video/mp4','video/webm','video/quicktime']),
 ('avatars','avatars',true,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
UPDATE storage.buckets SET public=false WHERE id='videos';
DROP POLICY IF EXISTS class_host_registrations ON live_room_access;
CREATE POLICY class_host_registrations ON live_room_access FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM live_sessions WHERE id=session_id AND trainer_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.save_program_workouts(p_program_id uuid,p_video_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM trainer_programs WHERE id=p_program_id AND trainer_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only the program owner can edit its workouts'; END IF;
 IF cardinality(p_video_ids)>200 OR cardinality(p_video_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_video_ids) id)
 OR cardinality(p_video_ids)<>(SELECT count(*) FROM trainer_videos WHERE id=ANY(p_video_ids) AND user_id=auth.uid() AND review_status='approved')
 THEN RAISE EXCEPTION 'Choose distinct approved workouts owned by this trainer'; END IF;
 DELETE FROM trainer_program_workouts WHERE program_id=p_program_id;
 INSERT INTO trainer_program_workouts(program_id,video_id,position)
 SELECT p_program_id,id,ordinality-1 FROM unnest(p_video_ids) WITH ORDINALITY t(id,ordinality);
END $$;
REVOKE ALL ON FUNCTION save_program_workouts(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION save_program_workouts(uuid,uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.record_class_calendar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO trainer_busy(trainer_id,day,time,source) VALUES(NEW.trainer_id::text,
   (NEW.starts_at AT TIME ZONE 'America/Chicago')::date,to_char(NEW.starts_at AT TIME ZONE 'America/Chicago','HH24:MI'),'live');
 ELSE
  DELETE FROM trainer_busy WHERE trainer_id=OLD.trainer_id::text AND source='live'
   AND day=(OLD.starts_at AT TIME ZONE 'America/Chicago')::date
   AND time=to_char(OLD.starts_at AT TIME ZONE 'America/Chicago','HH24:MI');
  IF NEW.status IN ('scheduled','live') THEN
   INSERT INTO trainer_busy(trainer_id,day,time,source) VALUES(NEW.trainer_id::text,
    (NEW.starts_at AT TIME ZONE 'America/Chicago')::date,to_char(NEW.starts_at AT TIME ZONE 'America/Chicago','HH24:MI'),'live');
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS class_calendar ON live_sessions;
CREATE TRIGGER class_calendar AFTER INSERT OR UPDATE OF starts_at,status ON live_sessions FOR EACH ROW EXECUTE FUNCTION record_class_calendar();
CREATE OR REPLACE FUNCTION public.guard_class_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('cancelled','ended') AND NEW.status<>OLD.status THEN RAISE EXCEPTION 'Class is already closed'; END IF;
 IF NEW.status='ended' AND NEW.starts_at>now() THEN RAISE EXCEPTION 'Cancel a future class to refund its bookings'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS class_status ON live_sessions;
CREATE TRIGGER class_status BEFORE UPDATE ON live_sessions FOR EACH ROW EXECUTE FUNCTION guard_class_status();
CREATE OR REPLACE FUNCTION public.canonical_comment_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN SELECT name INTO NEW.author_name FROM profiles WHERE id=NEW.author_id;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS canonical_comment_author ON post_comments;
CREATE TRIGGER canonical_comment_author BEFORE INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION canonical_comment_author();
