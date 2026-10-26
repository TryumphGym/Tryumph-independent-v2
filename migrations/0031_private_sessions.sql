-- Apply after 0023 + 0027. Confirm timezone and trainer_busy compatibility before production.
CREATE TABLE IF NOT EXISTS public.private_session_access (
 checkout_id text PRIMARY KEY,
 trainer_id uuid NOT NULL REFERENCES auth.users(id),
 member_id uuid NOT NULL REFERENCES auth.users(id),
 day date NOT NULL, time text NOT NULL,
 starts_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('paid','refunded','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(trainer_id,day,time)
);
ALTER TABLE public.private_session_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_session_access FROM anon,authenticated;
DROP POLICY IF EXISTS private_session_participant_read ON public.private_session_access;
CREATE POLICY private_session_participant_read ON public.private_session_access FOR SELECT TO authenticated
 USING(trainer_id=auth.uid() OR member_id=auth.uid());
GRANT SELECT ON public.private_session_access TO authenticated;
CREATE TABLE IF NOT EXISTS public.private_booking_holds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trainer_id uuid NOT NULL REFERENCES auth.users(id),
 member_id uuid NOT NULL REFERENCES auth.users(id),
 day date NOT NULL, time text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '40 minutes',
 CHECK(time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE UNIQUE INDEX IF NOT EXISTS private_booking_hold_slot ON public.private_booking_holds(trainer_id,day,time);
ALTER TABLE public.private_booking_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_booking_holds FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.hold_private_booking(p_trainer_id uuid,p_member_id uuid,p_day date,p_time text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE out_id uuid;
BEGIN
 IF p_member_id=p_trainer_id OR p_day<current_date THEN RAISE EXCEPTION 'Invalid booking'; END IF;
 DELETE FROM public.private_booking_holds WHERE expires_at<now();
 IF EXISTS(SELECT 1 FROM public.trainer_busy WHERE trainer_id=p_trainer_id::text AND day=p_day
   AND (time=p_time OR time='ALL')) THEN RAISE EXCEPTION 'Trainer unavailable'; END IF;
 INSERT INTO public.private_booking_holds(trainer_id,member_id,day,time)
 VALUES(p_trainer_id,p_member_id,p_day,p_time) RETURNING id INTO out_id;
 RETURN out_id;
END $$;
CREATE OR REPLACE FUNCTION public.release_private_hold(p_id uuid,p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 DELETE FROM public.private_booking_holds WHERE id=p_id AND member_id=p_member_id;
END $$;
-- Paid checkout consumes its own valid reservation and grants only the two participants room access.
CREATE OR REPLACE FUNCTION public.apply_paid_private_booking(
 p_checkout_id text,p_user_id uuid,p_trainer_id text,p_day text,p_time text,
 p_gross_cents integer,p_fee_cents integer,p_trainer_cents integer,p_hold_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h public.private_booking_holds%ROWTYPE;
BEGIN
 IF p_trainer_id !~ '^[0-9a-f-]{36}$' OR p_day !~ '^\d{4}-\d{2}-\d{2}$' OR p_time !~ '^\d{2}:\d{2}$'
 OR p_gross_cents<p_fee_cents OR p_fee_cents<0 OR p_trainer_cents<0 THEN RAISE EXCEPTION 'Invalid booking'; END IF;
 SELECT * INTO h FROM public.private_booking_holds WHERE id=p_hold_id FOR UPDATE;
 IF NOT FOUND OR h.member_id<>p_user_id OR h.trainer_id<>p_trainer_id::uuid
 OR h.day<>p_day::date OR h.time<>p_time THEN RAISE EXCEPTION 'Booking reservation not found'; END IF;
 INSERT INTO public.checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents)
 VALUES(p_checkout_id,'booking',p_user_id,p_gross_cents,p_fee_cents) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO public.trainer_busy(trainer_id,day,time,source)
 VALUES(p_trainer_id,p_day::date,p_time,'booked');
 INSERT INTO public.private_session_access(checkout_id,trainer_id,member_id,day,time,starts_at,status)
 VALUES(p_checkout_id,p_trainer_id::uuid,p_user_id,p_day::date,p_time,
   (p_day||' '||p_time)::timestamp AT TIME ZONE 'America/Chicago','paid');
 UPDATE public.profiles SET bookings=jsonb_build_array(jsonb_build_object('id',p_checkout_id,
 'trainerId',p_trainer_id,'date',p_day,'time',p_time,'price',p_gross_cents/100.0,'paid',true))
 ||coalesce(bookings,'[]'::jsonb) WHERE id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing customer profile'; END IF;
 INSERT INTO public.trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
 VALUES(p_trainer_id,'oneonone',p_checkout_id,p_gross_cents,p_fee_cents,p_gross_cents-p_fee_cents,90,p_trainer_cents)
 ON CONFLICT(ref) DO NOTHING;
 DELETE FROM public.private_booking_holds WHERE id=p_hold_id;
END $$;
REVOKE ALL ON FUNCTION public.hold_private_booking(uuid,uuid,date,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_private_hold(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_paid_private_booking(text,uuid,text,text,text,integer,integer,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hold_private_booking(uuid,uuid,date,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_private_hold(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_paid_private_booking(text,uuid,text,text,text,integer,integer,integer,uuid) TO service_role;
