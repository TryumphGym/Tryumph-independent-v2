-- Apply after 0023 and 0027. Atomic, paid-token-backed attendance; no client can mint paid access.
CREATE TABLE IF NOT EXISTS public.wallet_token_lots (
 id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
 purchased integer NOT NULL CHECK (purchased>0), remaining integer NOT NULL CHECK (remaining>=0),
 gross_cents integer NOT NULL, fee_cents integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (remaining<=purchased)
);
ALTER TABLE public.wallet_token_lots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_token_lots FROM anon,authenticated;
DROP POLICY IF EXISTS wallet_owner_read ON public.wallet_token_lots;
CREATE POLICY wallet_owner_read ON public.wallet_token_lots FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.wallet_token_lots TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_paid_token_checkout(p_checkout_id text,p_user_id uuid,p_tokens integer,p_gross_cents integer,p_fee_cents integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_tokens NOT BETWEEN 1 AND 100 OR p_gross_cents<p_fee_cents OR p_fee_cents<0 THEN RAISE EXCEPTION 'Invalid token purchase'; END IF;
 INSERT INTO public.checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents,quantity)
 VALUES(p_checkout_id,'tokens',p_user_id,p_gross_cents,p_fee_cents,p_tokens) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO public.wallet_token_lots(id,user_id,purchased,remaining,gross_cents,fee_cents)
 VALUES(p_checkout_id,p_user_id,p_tokens,p_tokens,p_gross_cents,p_fee_cents);
 UPDATE public.profiles SET tokens=coalesce(tokens,0)+p_tokens,
 ledger=jsonb_build_array(jsonb_build_object('id',p_checkout_id,'label','Bought '||p_tokens||' tokens',
 'tokens',p_tokens,'date',current_date,'netPerToken',(p_gross_cents-p_fee_cents)/p_tokens)) || coalesce(ledger,'[]'::jsonb)
 WHERE id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_paid_token_checkout(text,uuid,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paid_token_checkout(text,uuid,integer,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_paid_live_token(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_trainer uuid; v_balance integer; v_lot public.wallet_token_lots%ROWTYPE; v_net integer;
BEGIN
 SELECT trainer_id INTO v_trainer FROM public.live_sessions WHERE id=p_session_id AND starts_at>now()-interval '4 hours'
   AND starts_at<now()+interval '1 day';
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
 INSERT INTO public.live_room_access(session_id,user_id,status) VALUES(p_session_id,p_user_id,'paid')
 ON CONFLICT(session_id,user_id) DO UPDATE SET status='paid';
 INSERT INTO public.trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
 VALUES(v_trainer::text,'live','wallet:'||p_session_id::text||':'||p_user_id::text,
   floor(v_lot.gross_cents::numeric/v_lot.purchased)::integer,
   floor(v_lot.fee_cents::numeric/v_lot.purchased)::integer,v_net,50,floor(v_net*0.5)::integer)
 ON CONFLICT(ref) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.redeem_paid_live_token(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_paid_live_token(uuid,uuid) TO service_role;
