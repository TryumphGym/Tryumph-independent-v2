CREATE TABLE IF NOT EXISTS public.live_checkout_intents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL REFERENCES live_sessions(id),expires_at timestamptz NOT NULL DEFAULT now()+interval '60 minutes',
 UNIQUE(user_id,session_id));
ALTER TABLE live_checkout_intents ENABLE ROW LEVEL SECURITY;
GRANT ALL ON live_checkout_intents TO service_role;
CREATE OR REPLACE FUNCTION public.get_live_checkout_intent(p_user_id uuid,p_session_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE out_id uuid;
BEGIN
 INSERT INTO live_checkout_intents(user_id,session_id) VALUES(p_user_id,p_session_id)
 ON CONFLICT(user_id,session_id) DO UPDATE SET id=CASE WHEN live_checkout_intents.expires_at<now() THEN gen_random_uuid() ELSE live_checkout_intents.id END,
 expires_at=CASE WHEN live_checkout_intents.expires_at<now() THEN now()+interval '60 minutes' ELSE live_checkout_intents.expires_at END
 RETURNING id INTO out_id;
 RETURN out_id;
END $$;
REVOKE ALL ON FUNCTION get_live_checkout_intent(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION get_live_checkout_intent(uuid,uuid) TO service_role;
ALTER TABLE live_room_access ADD COLUMN IF NOT EXISTS first_joined_at timestamptz;
create or replace function public.apply_paid_live_checkout(p_checkout_id text,p_user_id uuid,p_session_id uuid,p_gross_cents integer,p_fee_cents integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_trainer text;
begin
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text||p_user_id::text));
  if p_gross_cents<>500 OR p_fee_cents<0 OR p_gross_cents < p_fee_cents then raise exception 'Invalid fees'; end if;
  select trainer_id::text into v_trainer from public.live_sessions where id=p_session_id AND status IN ('scheduled','live');
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
 SELECT * INTO v_lot FROM public.wallet_token_lots WHERE user_id=p_user_id AND remaining>0
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
