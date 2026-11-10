-- Reservation never debits a wallet. Only the signed provider attendance handler calls consume.
CREATE OR REPLACE FUNCTION reserve_live_class(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s live_sessions%ROWTYPE;
BEGIN
 SELECT * INTO s FROM live_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR s.status NOT IN ('scheduled','live') OR s.starts_at+s.minutes*interval '1 minute'<now()
 OR NOT trainer_is_eligible(s.trainer_id,true) OR NOT account_can_act(p_user_id,false) OR s.trainer_id=p_user_id THEN RAISE EXCEPTION 'Class unavailable'; END IF;
 INSERT INTO live_room_access(session_id,user_id,status) VALUES(p_session_id,p_user_id,'pending')
 ON CONFLICT(session_id,user_id) DO UPDATE SET status=CASE WHEN live_room_access.status='paid' THEN 'paid' ELSE 'pending' END;
 PERFORM notify_account(p_user_id,'reserved:'||p_session_id,'session','Class reserved: '||s.title||'. One token is spent only on verified room entry.','/live');
END $$;
CREATE OR REPLACE FUNCTION redeem_paid_live_token(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM reserve_live_class(p_user_id,p_session_id); END $$;
CREATE OR REPLACE FUNCTION consume_attended_live_token(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s live_sessions%ROWTYPE; l wallet_token_lots%ROWTYPE; u wallet_token_units%ROWTYPE; redemption uuid; gross integer; fee integer; net integer;
BEGIN
 SELECT * INTO s FROM live_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR s.status NOT IN ('scheduled','live') OR s.starts_at+s.minutes*interval '1 minute'<now()
 OR s.starts_at>now()+interval '10 minutes' OR NOT trainer_is_eligible(s.trainer_id,true) OR s.trainer_id=p_user_id THEN RAISE EXCEPTION 'Class unavailable'; END IF;
 PERFORM 1 FROM profiles WHERE id=p_user_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM live_room_access WHERE session_id=p_session_id AND user_id=p_user_id AND status='paid') THEN
  UPDATE live_room_access SET first_joined_at=now() WHERE session_id=p_session_id AND user_id=p_user_id AND first_joined_at IS NULL;
  IF FOUND THEN PERFORM notify_friend_attendance(p_user_id,p_session_id); END IF;
  RETURN;
 END IF;
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
 UPDATE live_room_access SET first_joined_at=coalesce(first_joined_at,now()) WHERE session_id=p_session_id AND user_id=p_user_id;
 PERFORM notify_friend_attendance(p_user_id,p_session_id);
 PERFORM sync_wallet_balance(p_user_id);
END $$;

REVOKE ALL ON FUNCTION reserve_live_class(uuid,uuid),consume_attended_live_token(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION reserve_live_class(uuid,uuid),consume_attended_live_token(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION set_live_reservation(p_session uuid,p_reserved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF p_reserved THEN PERFORM reserve_live_class(auth.uid(),p_session); END IF;
 UPDATE profiles SET reservations=(SELECT coalesce(jsonb_agg(v),'[]') FROM (
  SELECT value v FROM jsonb_array_elements(reservations) WHERE value<>to_jsonb(p_session::text)
  UNION SELECT to_jsonb(p_session::text) WHERE p_reserved) dedup) WHERE id=auth.uid();
 IF NOT p_reserved THEN DELETE FROM live_room_access WHERE session_id=p_session AND user_id=auth.uid() AND status='pending'; END IF;
END $$;
REVOKE ALL ON FUNCTION set_live_reservation(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION set_live_reservation(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION generate_live_session_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 FOR r IN SELECT a.user_id,s.id,s.title FROM live_room_access a JOIN live_sessions s ON s.id=a.session_id
 WHERE a.status IN ('pending','paid') AND s.status IN ('scheduled','live') AND s.starts_at>now() AND s.starts_at<=now()+interval '10 minutes' LOOP
  PERFORM notify_account(r.user_id,'class-reminder:'||r.id,'session',r.title||' starts within 10 minutes. Reservation is free; a token is spent on verified entry.','/live');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION generate_live_session_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION generate_live_session_reminders() TO service_role;
