CREATE OR REPLACE FUNCTION public.hold_private_booking(p_trainer_id uuid,p_member_id uuid,p_day date,p_time text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE out_id uuid; start_time timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_trainer_id::text||p_day::text));
 start_time=(p_day::text||' '||p_time)::timestamp AT TIME ZONE 'America/Chicago';
 IF p_member_id=p_trainer_id OR start_time<=now() OR p_day>current_date+365
 OR p_time NOT IN ('07:00','09:00','12:00','15:00','19:00') OR NOT trainer_is_eligible(p_trainer_id,false)
 THEN RAISE EXCEPTION 'Invalid private booking'; END IF;
 DELETE FROM private_booking_holds WHERE expires_at<now();
 SELECT id INTO out_id FROM private_booking_holds WHERE trainer_id=p_trainer_id AND member_id=p_member_id AND day=p_day AND time=p_time;
 IF FOUND THEN RETURN out_id; END IF;
 IF EXISTS(SELECT 1 FROM trainer_busy WHERE trainer_id=p_trainer_id::text AND day=p_day AND (time=p_time OR time='ALL'))
 OR EXISTS(SELECT 1 FROM live_sessions WHERE trainer_id=p_trainer_id AND status IN ('scheduled','live')
  AND starts_at<start_time+interval '1 hour' AND starts_at+minutes*interval '1 minute'>start_time)
 OR EXISTS(SELECT 1 FROM private_session_access WHERE trainer_id=p_trainer_id AND status='paid'
  AND starts_at<start_time+interval '1 hour' AND starts_at+interval '1 hour'>start_time)
 THEN RAISE EXCEPTION 'Trainer unavailable'; END IF;
 INSERT INTO private_booking_holds(trainer_id,member_id,day,time) VALUES(p_trainer_id,p_member_id,p_day,p_time) RETURNING id INTO out_id;
 RETURN out_id;
END $$;
-- A new live class cannot take a time already reserved in a private checkout or paid booking.
CREATE OR REPLACE FUNCTION public.protect_class_calendar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.starts_at=OLD.starts_at THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(NEW.trainer_id::text||(NEW.starts_at AT TIME ZONE 'America/Chicago')::date::text));
 IF EXISTS(SELECT 1 FROM private_booking_holds WHERE trainer_id=NEW.trainer_id AND expires_at>now()
  AND (day::text||' '||time)::timestamp AT TIME ZONE 'America/Chicago'<NEW.starts_at+NEW.minutes*interval '1 minute'
  AND ((day::text||' '||time)::timestamp AT TIME ZONE 'America/Chicago')+interval '1 hour'>NEW.starts_at)
 OR EXISTS(SELECT 1 FROM private_session_access WHERE trainer_id=NEW.trainer_id AND status='paid'
  AND starts_at<NEW.starts_at+NEW.minutes*interval '1 minute' AND starts_at+interval '1 hour'>NEW.starts_at)
 THEN RAISE EXCEPTION 'Time conflicts with a private reservation'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_class_calendar ON live_sessions;
CREATE TRIGGER protect_class_calendar BEFORE INSERT OR UPDATE OF starts_at ON live_sessions FOR EACH ROW EXECUTE FUNCTION protect_class_calendar();
