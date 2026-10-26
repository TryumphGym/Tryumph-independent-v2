-- Signed chargeback events suspend access and preserve a recoverable, auditable ledger.
CREATE TABLE IF NOT EXISTS payment_disputes(id text PRIMARY KEY,checkout_id text NOT NULL,status text NOT NULL CHECK(status IN ('open','won','lost')),
 wallet_remaining integer,wallet_revoked integer,reconciled boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON payment_disputes TO service_role;
ALTER TABLE wallet_token_lots ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false;
ALTER TABLE trainer_earnings ADD COLUMN IF NOT EXISTS adjustment_for uuid REFERENCES trainer_earnings(id);
CREATE OR REPLACE FUNCTION public.apply_payment_dispute(p_id text,p_checkout_id text,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v checkout_payment_state%ROWTYPE; prior payment_disputes%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_checkout_id));
 SELECT * INTO prior FROM payment_disputes WHERE id=p_id FOR UPDATE;
 IF FOUND AND prior.status IN ('won','lost') THEN RETURN; END IF;
 INSERT INTO payment_disputes(id,checkout_id,status) VALUES(p_id,p_checkout_id,p_status)
 ON CONFLICT(id) DO UPDATE SET status=p_status;
 SELECT * INTO v FROM checkout_payment_state WHERE checkout_id=p_checkout_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF p_status='open' OR p_status='lost' THEN
  UPDATE payment_disputes SET wallet_remaining=coalesce(wallet_remaining,(SELECT remaining FROM wallet_token_lots WHERE id=p_checkout_id)),
   wallet_revoked=coalesce(wallet_revoked,(SELECT revoked FROM wallet_token_lots WHERE id=p_checkout_id)) WHERE id=p_id;
  UPDATE wallet_token_lots SET frozen=true WHERE id=p_checkout_id;
  UPDATE profiles SET tokens=(SELECT coalesce(sum(remaining),0) FROM wallet_token_lots WHERE user_id=v.user_id AND NOT frozen) WHERE id=v.user_id;
  UPDATE private_session_access SET status='cancelled' WHERE checkout_id=p_checkout_id AND status='paid';
  UPDATE live_room_access SET status='cancelled' WHERE (stripe_checkout_session_id=p_checkout_id OR wallet_lot_id=p_checkout_id) AND status='paid';
  UPDATE trainer_earnings SET reversal_target_cents=payout_cents,
   status=CASE WHEN transfer_id IS NULL AND operation_key IS NULL THEN 'refunded' ELSE 'reversal_due' END
   WHERE ref=p_checkout_id OR ref IN(SELECT 'wallet:'||session_id::text||':'||user_id::text FROM live_room_access WHERE wallet_lot_id=p_checkout_id);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.restore_won_disputes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d payment_disputes%ROWTYPE; v checkout_payment_state%ROWTYPE; e trainer_earnings%ROWTYPE;
 desired integer; actual integer; refund_target integer;
BEGIN
 FOR d IN SELECT * FROM payment_disputes WHERE status='won' AND NOT reconciled FOR UPDATE LOOP
  IF EXISTS(SELECT 1 FROM trainer_earnings WHERE operation_key IS NOT NULL AND
   (ref=d.checkout_id OR ref IN(SELECT 'wallet:'||session_id::text||':'||user_id::text FROM live_room_access WHERE wallet_lot_id=d.checkout_id))) THEN CONTINUE; END IF;
  SELECT * INTO v FROM checkout_payment_state WHERE checkout_id=d.checkout_id;
  IF NOT FOUND THEN CONTINUE; END IF;
  UPDATE wallet_token_lots SET frozen=false WHERE id=d.checkout_id;
  UPDATE profiles SET tokens=(SELECT coalesce(sum(remaining),0) FROM wallet_token_lots WHERE user_id=v.user_id AND NOT frozen) WHERE id=v.user_id;
  IF v.refunded_cents=0 THEN
   UPDATE private_session_access SET status='paid' WHERE checkout_id=d.checkout_id AND status='cancelled';
   UPDATE live_room_access a SET status='paid' WHERE (stripe_checkout_session_id=d.checkout_id OR wallet_lot_id=d.checkout_id)
    AND status='cancelled' AND EXISTS(SELECT 1 FROM live_sessions WHERE id=a.session_id AND status IN ('scheduled','live'));
  END IF;
  FOR e IN SELECT * FROM trainer_earnings WHERE ref=d.checkout_id OR
    ref IN(SELECT 'wallet:'||session_id::text||':'||user_id::text FROM live_room_access WHERE wallet_lot_id=d.checkout_id) FOR UPDATE LOOP
   refund_target=CASE WHEN v.gross_cents>0 THEN floor(e.payout_cents::numeric*v.refunded_cents/v.gross_cents) ELSE e.payout_cents END;
   desired=e.payout_cents-refund_target;
   IF e.transfer_id IS NULL THEN
    UPDATE trainer_earnings SET reversal_target_cents=refund_target,status=CASE WHEN desired>0 THEN 'pending' ELSE 'refunded' END WHERE id=e.id;
   ELSE
    actual=e.payout_cents-e.withheld_cents-e.transfer_reversed_cents;
    UPDATE trainer_earnings SET reversal_target_cents=greatest(refund_target,e.withheld_cents+e.transfer_reversed_cents),
      status=CASE WHEN refund_target>e.withheld_cents+e.transfer_reversed_cents THEN 'reversal_due' ELSE 'paid' END WHERE id=e.id;
    IF desired>actual THEN
     INSERT INTO trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents,adjustment_for)
     VALUES(e.trainer_slug,e.source,'dispute-recovery:'||d.id||':'||e.id::text,desired-actual,0,desired-actual,100,desired-actual,e.id)
     ON CONFLICT(ref) DO NOTHING;
    END IF;
   END IF;
  END LOOP;
  UPDATE payment_disputes SET reconciled=true WHERE id=d.id;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION apply_payment_dispute(text,text,text),restore_won_disputes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION apply_payment_dispute(text,text,text),restore_won_disputes() TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_paid_live_token(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_trainer uuid; v_balance integer; v_lot public.wallet_token_lots%ROWTYPE; v_net integer; v_gross integer; v_fee integer; unit integer;
BEGIN
 SELECT trainer_id INTO v_trainer FROM public.live_sessions WHERE id=p_session_id AND starts_at>now()-interval '4 hours'
   AND starts_at<now()+interval '1 day' AND status IN ('scheduled','live');
 IF v_trainer IS NULL THEN RAISE EXCEPTION 'Class unavailable'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.live_room_access WHERE user_id=p_user_id AND session_id=p_session_id AND status='paid') THEN RETURN; END IF;
 SELECT coalesce(tokens,0) INTO v_balance FROM public.profiles WHERE id=p_user_id;
 IF v_balance<1 THEN RAISE EXCEPTION 'No available tokens'; END IF;
 SELECT * INTO v_lot FROM public.wallet_token_lots WHERE user_id=p_user_id AND remaining>0 AND NOT frozen
 ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No verified purchased tokens available'; END IF;
 unit=v_lot.purchased-v_lot.remaining;
 v_gross=floor(v_lot.gross_cents::numeric*(unit+1)/v_lot.purchased)-floor(v_lot.gross_cents::numeric*unit/v_lot.purchased);
 v_fee=floor(v_lot.fee_cents::numeric*(unit+1)/v_lot.purchased)-floor(v_lot.fee_cents::numeric*unit/v_lot.purchased);
 v_net=v_gross-v_fee;
 UPDATE public.wallet_token_lots SET remaining=remaining-1 WHERE id=v_lot.id;
 UPDATE public.profiles SET tokens=tokens-1 WHERE id=p_user_id;
 INSERT INTO public.live_room_access(session_id,user_id,status,wallet_lot_id) VALUES(p_session_id,p_user_id,'paid',v_lot.id)
 ON CONFLICT(session_id,user_id) DO UPDATE SET status='paid',wallet_lot_id=excluded.wallet_lot_id;
 INSERT INTO public.trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
 VALUES(v_trainer::text,'live','wallet:'||p_session_id::text||':'||p_user_id::text,
   v_gross,v_fee,v_net,50,floor(v_net*0.5)::integer)
 ON CONFLICT(ref) DO NOTHING;
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
   UPDATE profiles SET tokens=(SELECT coalesce(sum(remaining),0) FROM wallet_token_lots WHERE user_id=v.user_id AND NOT frozen) WHERE id=v.user_id;
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
