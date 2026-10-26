-- Serialize settlements, preserve partial refund accounting, and make provider retries harmless.
ALTER TABLE public.live_room_access ADD COLUMN IF NOT EXISTS wallet_lot_id text REFERENCES public.wallet_token_lots(id);
ALTER TABLE public.wallet_token_lots ADD COLUMN IF NOT EXISTS revoked integer NOT NULL DEFAULT 0;
-- Preserve only one active booking for a slot; cancelled/refunded history remains auditable.
ALTER TABLE private_session_access DROP CONSTRAINT IF EXISTS private_session_access_trainer_id_day_time_key;
CREATE UNIQUE INDEX IF NOT EXISTS private_active_slot ON private_session_access(trainer_id,day,time) WHERE status='paid';
CREATE OR REPLACE FUNCTION public.apply_paid_private_booking(
 p_checkout_id text,p_user_id uuid,p_trainer_id text,p_day text,p_time text,
 p_gross_cents integer,p_fee_cents integer,p_trainer_cents integer,p_hold_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h public.private_booking_holds%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_checkout_id));
 IF EXISTS(SELECT 1 FROM checkout_payment_state WHERE checkout_id=p_checkout_id) THEN RETURN; END IF;
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
CREATE OR REPLACE FUNCTION public.apply_checkout_refund(p_checkout_id text,p_refund_cents integer,p_fully_refunded boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.checkout_payment_state%ROWTYPE; e public.trainer_earnings%ROWTYPE; target integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_checkout_id));
 SELECT * INTO v FROM public.checkout_payment_state WHERE checkout_id=p_checkout_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF p_refund_cents < 0 OR p_refund_cents > v.gross_cents THEN RAISE EXCEPTION 'Bad refund amount'; END IF;
 IF p_refund_cents <= v.refunded_cents THEN RETURN; END IF;
 UPDATE public.checkout_payment_state SET refunded_cents=p_refund_cents WHERE checkout_id=p_checkout_id;
 IF v.kind='tokens' THEN
   UPDATE wallet_token_lots SET remaining=greatest(0,remaining-
     (ceil(purchased::numeric*p_refund_cents/v.gross_cents)::integer-revoked)),
     revoked=ceil(purchased::numeric*p_refund_cents/v.gross_cents)::integer WHERE id=p_checkout_id;
   UPDATE profiles SET tokens=(SELECT coalesce(sum(remaining),0) FROM wallet_token_lots WHERE user_id=v.user_id) WHERE id=v.user_id;
   -- Any refund against a spent lot suspends its paid entitlements pending reconciliation.
   UPDATE live_room_access SET status='refunded' WHERE wallet_lot_id=p_checkout_id;
   UPDATE trainer_earnings SET reversal_target_cents=payout_cents,
    status=CASE WHEN transfer_id IS NULL THEN 'refunded' ELSE 'reversal_due' END
    WHERE ref IN(SELECT 'wallet:'||session_id::text||':'||user_id::text FROM live_room_access WHERE wallet_lot_id=p_checkout_id);
 END IF;
 IF p_fully_refunded THEN
   IF v.kind='booking' THEN
     DELETE FROM public.trainer_busy WHERE source='booked' AND (trainer_id,day,time) IN (
       SELECT b->>'trainerId',(b->>'date')::date,b->>'time' FROM public.profiles p,
       LATERAL jsonb_array_elements(coalesce(p.bookings,'[]'::jsonb)) b
       WHERE p.id=v.user_id AND b->>'id'=p_checkout_id
     );
     UPDATE public.profiles SET bookings=(SELECT coalesce(jsonb_agg(b),'[]'::jsonb)
       FROM jsonb_array_elements(coalesce(bookings,'[]'::jsonb)) b WHERE b->>'id'<>p_checkout_id)
       WHERE id=v.user_id;
     UPDATE public.private_session_access SET status='refunded' WHERE checkout_id=p_checkout_id;
   ELSIF v.kind='live' THEN
     UPDATE public.live_room_access SET status='refunded' WHERE stripe_checkout_session_id=p_checkout_id;
   END IF;
 END IF;
 SELECT * INTO e FROM public.trainer_earnings WHERE ref=p_checkout_id FOR UPDATE;
 IF FOUND THEN
   target := CASE WHEN v.gross_cents>0 THEN
     floor(e.payout_cents::numeric * p_refund_cents / v.gross_cents)::integer ELSE e.payout_cents END;
   IF e.transfer_id IS NOT NULL THEN
     UPDATE public.trainer_earnings SET reversal_target_cents=target,
       status=CASE WHEN target>transfer_reversed_cents THEN 'reversal_due' ELSE 'paid' END
       WHERE id=e.id;
   ELSE
     -- No transfer exists. Keep original payout for historical reconciliation, exclude fully refunded work.
     UPDATE public.trainer_earnings SET status=CASE WHEN operation_key IS NOT NULL THEN 'transferring' WHEN p_fully_refunded THEN 'refunded' ELSE 'pending' END,
       reversal_target_cents=target WHERE id=e.id;
   END IF;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.redeem_paid_live_token(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_trainer uuid; v_balance integer; v_lot public.wallet_token_lots%ROWTYPE; v_net integer;
BEGIN
 SELECT trainer_id INTO v_trainer FROM public.live_sessions WHERE id=p_session_id AND starts_at>now()-interval '4 hours'
   AND starts_at<now()+interval '1 day' AND status IN ('scheduled','live');
 IF v_trainer IS NULL THEN RAISE EXCEPTION 'Class unavailable'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.live_room_access WHERE user_id=p_user_id AND session_id=p_session_id AND status='paid') THEN RETURN; END IF;
 SELECT coalesce(tokens,0) INTO v_balance FROM public.profiles WHERE id=p_user_id;
 IF v_balance<1 THEN RAISE EXCEPTION 'No available tokens'; END IF;
 SELECT * INTO v_lot FROM public.wallet_token_lots WHERE user_id=p_user_id AND remaining>0
 ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No verified purchased tokens available'; END IF;
 v_net := floor((v_lot.gross_cents-v_lot.fee_cents)::numeric/v_lot.purchased)::integer;
 UPDATE public.wallet_token_lots SET remaining=remaining-1 WHERE id=v_lot.id;
 UPDATE public.profiles SET tokens=tokens-1 WHERE id=p_user_id;
 INSERT INTO public.live_room_access(session_id,user_id,status,wallet_lot_id) VALUES(p_session_id,p_user_id,'paid',v_lot.id)
 ON CONFLICT(session_id,user_id) DO UPDATE SET status='paid',wallet_lot_id=excluded.wallet_lot_id;
 INSERT INTO public.trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
 VALUES(v_trainer::text,'live','wallet:'||p_session_id::text||':'||p_user_id::text,
   floor(v_lot.gross_cents::numeric/v_lot.purchased)::integer,
   floor(v_lot.fee_cents::numeric/v_lot.purchased)::integer,v_net,50,floor(v_net*0.5)::integer)
 ON CONFLICT(ref) DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION public.reorder_program_workouts(p_program_id uuid,p_video_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; i integer; offset_position integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.trainer_programs
    WHERE id=p_program_id AND trainer_id=auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 PERFORM 1 FROM public.trainer_programs WHERE id=p_program_id FOR UPDATE;
 SELECT count(*) INTO n FROM public.trainer_program_workouts WHERE program_id=p_program_id;
 IF n<>coalesce(array_length(p_video_ids,1),0) OR
    (SELECT count(DISTINCT x) FROM unnest(p_video_ids)x)<>n OR
    (SELECT count(*) FROM public.trainer_program_workouts WHERE program_id=p_program_id
      AND video_id=ANY(p_video_ids))<>n THEN RAISE EXCEPTION 'Invalid workout order'; END IF;
 -- Unique constraint allows two-phase shuffle using unused positions.
 SELECT coalesce(max(position),0)+1 INTO offset_position FROM public.trainer_program_workouts WHERE program_id=p_program_id;
 UPDATE public.trainer_program_workouts SET position=position+offset_position WHERE program_id=p_program_id;
 IF n=0 THEN RETURN; END IF;
 FOR i IN 1..n LOOP
   UPDATE public.trainer_program_workouts SET position=i-1
     WHERE program_id=p_program_id AND video_id=p_video_ids[i];
 END LOOP;
END $$;
