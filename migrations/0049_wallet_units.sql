-- Each purchased token is an auditable unit. Returns/refunds never reuse an earning reference.
CREATE TABLE IF NOT EXISTS wallet_redemptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lot_id text NOT NULL REFERENCES wallet_token_lots(id),
 unit_index integer NOT NULL,user_id uuid NOT NULL REFERENCES auth.users(id),session_id uuid NOT NULL REFERENCES live_sessions(id),
 cancelled boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS wallet_token_units(lot_id text NOT NULL REFERENCES wallet_token_lots(id),unit_index integer NOT NULL,
 state text NOT NULL CHECK(state IN ('available','spent','refunded')),redemption_id uuid REFERENCES wallet_redemptions(id),PRIMARY KEY(lot_id,unit_index));
ALTER TABLE wallet_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_token_units ENABLE ROW LEVEL SECURITY;
GRANT ALL ON wallet_redemptions,wallet_token_units TO service_role;
GRANT SELECT ON wallet_redemptions,wallet_token_units TO authenticated;
DROP POLICY IF EXISTS redemption_owner_read ON wallet_redemptions;
CREATE POLICY redemption_owner_read ON wallet_redemptions FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS wallet_unit_owner_read ON wallet_token_units;
CREATE POLICY wallet_unit_owner_read ON wallet_token_units FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM wallet_token_lots WHERE id=lot_id AND user_id=auth.uid()));
-- Preserve known purchased balances. Previously spent units need historical Stripe reconciliation;
-- no extra spendable units are created for them by this backfill.
INSERT INTO wallet_token_units(lot_id,unit_index,state)
 SELECT l.id,n,CASE WHEN n<l.remaining THEN 'available' WHEN n>=l.purchased-l.revoked THEN 'refunded' ELSE 'spent' END
 FROM wallet_token_lots l CROSS JOIN LATERAL generate_series(0,l.purchased-1)n ON CONFLICT DO NOTHING;
ALTER TABLE live_room_access ADD COLUMN IF NOT EXISTS wallet_redemption_id uuid REFERENCES wallet_redemptions(id);
ALTER TABLE refund_jobs ADD COLUMN IF NOT EXISTS target_cents integer;
CREATE OR REPLACE FUNCTION sync_wallet_balance(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE wallet_token_lots l SET remaining=(SELECT count(*) FROM wallet_token_units WHERE lot_id=l.id AND state='available'),
 revoked=(SELECT count(*) FROM wallet_token_units WHERE lot_id=l.id AND state='refunded') WHERE user_id=p_user_id;
 UPDATE profiles SET tokens=(SELECT coalesce(sum(remaining),0) FROM wallet_token_lots WHERE user_id=p_user_id AND NOT frozen) WHERE id=p_user_id;
END $$;
CREATE OR REPLACE FUNCTION apply_paid_token_checkout(p_checkout_id text,p_user_id uuid,p_tokens integer,p_gross_cents integer,p_fee_cents integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_tokens NOT BETWEEN 1 AND 100 OR p_gross_cents<>p_tokens*500 OR p_fee_cents<0 OR p_fee_cents>p_gross_cents THEN RAISE EXCEPTION 'Invalid token purchase'; END IF;
 INSERT INTO checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents,quantity)
 VALUES(p_checkout_id,'tokens',p_user_id,p_gross_cents,p_fee_cents,p_tokens) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO wallet_token_lots(id,user_id,purchased,remaining,gross_cents,fee_cents) VALUES(p_checkout_id,p_user_id,p_tokens,p_tokens,p_gross_cents,p_fee_cents);
 INSERT INTO wallet_token_units(lot_id,unit_index,state) SELECT p_checkout_id,n,'available' FROM generate_series(0,p_tokens-1)n;
 UPDATE profiles SET ledger=jsonb_build_array(jsonb_build_object('id',p_checkout_id,'label','Bought '||p_tokens||' tokens','tokens',p_tokens,'date',current_date))||coalesce(ledger,'[]'::jsonb) WHERE id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing profile'; END IF;
 PERFORM sync_wallet_balance(p_user_id);
END $$;
CREATE OR REPLACE FUNCTION redeem_paid_live_token(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s live_sessions%ROWTYPE; l wallet_token_lots%ROWTYPE; u wallet_token_units%ROWTYPE; redemption uuid; gross integer; fee integer; net integer;
BEGIN
 SELECT * INTO s FROM live_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR s.status NOT IN ('scheduled','live') OR s.starts_at+s.minutes*interval '1 minute'<now()
 OR NOT trainer_is_eligible(s.trainer_id,true) OR s.trainer_id=p_user_id THEN RAISE EXCEPTION 'Class unavailable'; END IF;
 PERFORM 1 FROM profiles WHERE id=p_user_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM live_room_access WHERE session_id=p_session_id AND user_id=p_user_id AND status='paid') THEN RETURN; END IF;
 SELECT units.* INTO u FROM wallet_token_units units JOIN wallet_token_lots lots ON lots.id=units.lot_id
 WHERE lots.user_id=p_user_id AND NOT lots.frozen AND units.state='available' ORDER BY lots.created_at,units.unit_index LIMIT 1 FOR UPDATE OF units;
 IF NOT FOUND THEN RAISE EXCEPTION 'No verified purchased tokens available'; END IF;
 SELECT * INTO l FROM wallet_token_lots WHERE id=u.lot_id;
 gross=floor(l.gross_cents::numeric*(u.unit_index+1)/l.purchased)-floor(l.gross_cents::numeric*u.unit_index/l.purchased);
 fee=floor(l.fee_cents::numeric*(u.unit_index+1)/l.purchased)-floor(l.fee_cents::numeric*u.unit_index/l.purchased);net=gross-fee;
 INSERT INTO wallet_redemptions(lot_id,unit_index,user_id,session_id) VALUES(l.id,u.unit_index,p_user_id,p_session_id) RETURNING id INTO redemption;
 UPDATE wallet_token_units SET state='spent',redemption_id=redemption WHERE lot_id=u.lot_id AND unit_index=u.unit_index;
 INSERT INTO live_room_access(session_id,user_id,status,wallet_lot_id,wallet_redemption_id) VALUES(p_session_id,p_user_id,'paid',l.id,redemption)
 ON CONFLICT(session_id,user_id) DO UPDATE SET status='paid',wallet_lot_id=l.id,wallet_redemption_id=redemption,stripe_checkout_session_id=NULL;
 INSERT INTO trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
 VALUES(s.trainer_id::text,'live','wallet:'||redemption::text,gross,fee,net,50,floor(net*0.5));
 UPDATE profiles SET ledger=jsonb_build_array(jsonb_build_object('id','wallet:'||redemption::text,'label','Live class: '||s.title,'tokens',-1,'date',current_date))||coalesce(ledger,'[]'::jsonb) WHERE id=p_user_id;
 PERFORM sync_wallet_balance(p_user_id);
END $$;
CREATE OR REPLACE FUNCTION apply_checkout_refund(p_checkout_id text,p_refund_cents integer,p_fully_refunded boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v checkout_payment_state%ROWTYPE; u wallet_token_units%ROWTYPE; e trainer_earnings%ROWTYPE; target integer; revoked_count integer; rounded integer; before_balance integer; after_balance integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_checkout_id));
 SELECT * INTO v FROM checkout_payment_state WHERE checkout_id=p_checkout_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF p_refund_cents<0 OR p_refund_cents>v.gross_cents THEN RAISE EXCEPTION 'Invalid refund'; END IF;
 IF p_refund_cents<=v.refunded_cents THEN RETURN; END IF;
 UPDATE checkout_payment_state SET refunded_cents=p_refund_cents WHERE checkout_id=p_checkout_id;
 IF v.kind='tokens' THEN
  SELECT tokens INTO before_balance FROM profiles WHERE id=v.user_id FOR UPDATE;
  revoked_count=ceil(v.quantity::numeric*p_refund_cents/v.gross_cents);
  FOR u IN SELECT * FROM wallet_token_units WHERE lot_id=p_checkout_id AND unit_index>=v.quantity-revoked_count AND state<>'refunded' FOR UPDATE LOOP
   UPDATE wallet_token_units SET state='refunded' WHERE lot_id=u.lot_id AND unit_index=u.unit_index;
   IF u.redemption_id IS NOT NULL THEN
    UPDATE live_room_access SET status='refunded' WHERE wallet_redemption_id=u.redemption_id;
    UPDATE trainer_earnings SET reversal_target_cents=payout_cents,
      status=CASE WHEN transfer_id IS NULL AND operation_key IS NULL THEN 'refunded' ELSE 'reversal_due' END WHERE ref='wallet:'||u.redemption_id::text;
   END IF;
  END LOOP;
  PERFORM sync_wallet_balance(v.user_id);
  SELECT tokens INTO after_balance FROM profiles WHERE id=v.user_id;
  UPDATE profiles SET ledger=jsonb_build_array(jsonb_build_object('id','refund:'||p_checkout_id||':'||p_refund_cents::text,
   'label','Payment refund $'||((p_refund_cents-v.refunded_cents)/100.0)::text,'tokens',after_balance-before_balance,'date',current_date))||coalesce(ledger,'[]'::jsonb) WHERE id=v.user_id;
  -- Token refunds are whole $5 units. Finish a provider-initiated fractional refund via an auditable job.
  rounded=least(v.gross_cents,revoked_count*500);
  IF rounded>p_refund_cents THEN
   INSERT INTO refund_jobs(checkout_id,reason,target_cents) VALUES(p_checkout_id,'complete_token_unit_refund',rounded)
   ON CONFLICT(checkout_id) DO UPDATE SET target_cents=CASE WHEN refund_jobs.target_cents IS NULL THEN NULL ELSE greatest(refund_jobs.target_cents,excluded.target_cents) END,completed_at=NULL;
  END IF;
 ELSIF p_refund_cents=v.gross_cents THEN
  UPDATE private_session_access SET status='refunded' WHERE checkout_id=p_checkout_id;
  DELETE FROM trainer_busy WHERE source='booked' AND (trainer_id,day,time) IN(SELECT trainer_id::text,day,time FROM private_session_access WHERE checkout_id=p_checkout_id);
  UPDATE profiles SET bookings=(SELECT coalesce(jsonb_agg(b),'[]'::jsonb) FROM jsonb_array_elements(coalesce(bookings,'[]'::jsonb)) b WHERE b->>'id'<>p_checkout_id) WHERE id=v.user_id;
  UPDATE live_room_access SET status='refunded' WHERE stripe_checkout_session_id=p_checkout_id;
 END IF;
 SELECT * INTO e FROM trainer_earnings WHERE ref=p_checkout_id FOR UPDATE;
 IF FOUND THEN
  target=floor(e.payout_cents::numeric*p_refund_cents/v.gross_cents);
  UPDATE trainer_earnings SET reversal_target_cents=target,status=CASE
   WHEN operation_key IS NOT NULL THEN CASE WHEN transfer_id IS NULL THEN 'transferring' ELSE 'reversal_due' END
   WHEN transfer_id IS NOT NULL THEN CASE WHEN target>withheld_cents+transfer_reversed_cents THEN 'reversal_due' ELSE 'paid' END
   WHEN p_refund_cents=v.gross_cents THEN 'refunded' ELSE 'pending' END WHERE id=e.id;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.queue_cancelled_class_refunds()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a live_room_access%ROWTYPE;
BEGIN
 IF NEW.status='cancelled' AND OLD.status<>'cancelled' THEN
  INSERT INTO refund_jobs(checkout_id,reason) SELECT stripe_checkout_session_id,'class_cancelled' FROM live_room_access WHERE session_id=NEW.id AND status='paid' AND stripe_checkout_session_id IS NOT NULL
   ON CONFLICT(checkout_id) DO UPDATE SET target_cents=NULL,completed_at=NULL;
  FOR a IN SELECT * FROM live_room_access WHERE session_id=NEW.id AND status='paid' AND wallet_redemption_id IS NOT NULL FOR UPDATE LOOP
   UPDATE wallet_token_units SET state='available',redemption_id=NULL WHERE redemption_id=a.wallet_redemption_id AND state='spent';
   UPDATE wallet_redemptions SET cancelled=true WHERE id=a.wallet_redemption_id;
   UPDATE live_room_access SET status='cancelled' WHERE id=a.id;
   UPDATE trainer_earnings SET reversal_target_cents=payout_cents,status=CASE WHEN transfer_id IS NULL AND operation_key IS NULL THEN 'refunded' ELSE 'reversal_due' END WHERE ref='wallet:'||a.wallet_redemption_id::text;
   UPDATE profiles SET ledger=jsonb_build_array(jsonb_build_object('id','returned:'||a.wallet_redemption_id::text,
    'label','Class cancelled — token returned','tokens',1,'date',current_date))||coalesce(ledger,'[]'::jsonb) WHERE id=a.user_id;
   PERFORM sync_wallet_balance(a.user_id);
  END LOOP;
 END IF;
 IF NEW.starts_at IS DISTINCT FROM OLD.starts_at AND EXISTS(SELECT 1 FROM live_room_access WHERE session_id=NEW.id AND status='paid') THEN RAISE EXCEPTION 'Cancel a booked class before changing its time'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sync_wallet_balance(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sync_wallet_balance(uuid) TO service_role;

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
   WHERE ref=p_checkout_id OR ref IN(SELECT 'wallet:'||id::text FROM wallet_redemptions WHERE lot_id=p_checkout_id);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.restore_won_disputes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d payment_disputes%ROWTYPE; v checkout_payment_state%ROWTYPE; e trainer_earnings%ROWTYPE;
 desired integer; actual integer; refund_target integer;
BEGIN
 FOR d IN SELECT * FROM payment_disputes WHERE status='won' AND NOT reconciled FOR UPDATE LOOP
  IF EXISTS(SELECT 1 FROM trainer_earnings WHERE operation_key IS NOT NULL AND
   (ref=d.checkout_id OR ref IN(SELECT 'wallet:'||id::text FROM wallet_redemptions WHERE lot_id=d.checkout_id))) THEN CONTINUE; END IF;
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
    ref IN(SELECT 'wallet:'||id::text FROM wallet_redemptions WHERE lot_id=d.checkout_id) FOR UPDATE LOOP
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

create or replace function public.apply_paid_live_checkout(p_checkout_id text,p_user_id uuid,p_session_id uuid,p_gross_cents integer,p_fee_cents integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_trainer text;
begin
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text||p_user_id::text));
  if p_gross_cents<>500 OR p_fee_cents<0 OR p_gross_cents < p_fee_cents then raise exception 'Invalid fees'; end if;
  select trainer_id::text into v_trainer from public.live_sessions where id=p_session_id AND status IN ('scheduled','live') FOR UPDATE;
  if v_trainer is null then raise exception 'Unknown session'; end if;
  insert into public.checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents)
  values(p_checkout_id,'live',p_user_id,p_gross_cents,p_fee_cents)
  on conflict do nothing;
  if not found then return; end if;
  IF EXISTS(SELECT 1 FROM live_room_access WHERE session_id=p_session_id AND user_id=p_user_id AND status='paid') THEN
   INSERT INTO refund_jobs(checkout_id,reason) VALUES(p_checkout_id,'duplicate_class_payment') ON CONFLICT DO NOTHING; RETURN;
  END IF;
  insert into public.live_room_access(session_id,user_id,stripe_checkout_session_id,status)
  values(p_session_id,p_user_id,p_checkout_id,'paid')
  on conflict(session_id,user_id) do update set status='paid',stripe_checkout_session_id=excluded.stripe_checkout_session_id;
  insert into public.trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
  values(v_trainer,'live',p_checkout_id,p_gross_cents,p_fee_cents,p_gross_cents-p_fee_cents,50,(p_gross_cents-p_fee_cents)/2)
  on conflict(ref) do nothing;
end $$;


CREATE OR REPLACE FUNCTION public.apply_paid_private_booking(
 p_checkout_id text,p_user_id uuid,p_trainer_id text,p_day text,p_time text,
 p_gross_cents integer,p_fee_cents integer,p_trainer_cents integer,p_hold_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h public.private_booking_holds%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_checkout_id));
 IF EXISTS(SELECT 1 FROM checkout_payment_state WHERE checkout_id=p_checkout_id) THEN RETURN; END IF;
 IF p_trainer_id !~ '^[0-9a-f-]{36}$' OR p_day !~ '^\d{4}-\d{2}-\d{2}$' OR p_time !~ '^\d{2}:\d{2}$'
 OR p_gross_cents<p_fee_cents OR p_fee_cents<0 OR p_trainer_cents<>floor((p_gross_cents-p_fee_cents)*0.9)::integer THEN RAISE EXCEPTION 'Invalid booking'; END IF;
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
