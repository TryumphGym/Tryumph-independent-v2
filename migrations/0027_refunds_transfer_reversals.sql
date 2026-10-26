-- Apply after 0023. Preserve transfer history: refunded earnings must not be deleted.
ALTER TABLE public.trainer_earnings DROP CONSTRAINT IF EXISTS trainer_earnings_status_check;
ALTER TABLE public.trainer_earnings ADD CONSTRAINT trainer_earnings_status_check
 CHECK(status IN ('pending','paid','refunded','reversal_due','transferring'));
ALTER TABLE public.trainer_earnings ADD COLUMN IF NOT EXISTS transfer_reversed_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.trainer_earnings ADD COLUMN IF NOT EXISTS reversal_target_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.trainer_earnings DROP CONSTRAINT IF EXISTS earnings_reversal_bounds;
ALTER TABLE public.trainer_earnings ADD CONSTRAINT earnings_reversal_bounds
 CHECK(transfer_reversed_cents>=0 AND reversal_target_cents>=0 AND reversal_target_cents<=payout_cents);
-- Replace legacy function from 0023, making cumulative partial refunds idempotent and
-- allowing Stripe's transfer reversal worker to settle already-transferred earnings.
CREATE OR REPLACE FUNCTION public.apply_checkout_refund(p_checkout_id text,p_refund_cents integer,p_fully_refunded boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.checkout_payment_state%ROWTYPE; e public.trainer_earnings%ROWTYPE; target integer;
BEGIN
 SELECT * INTO v FROM public.checkout_payment_state WHERE checkout_id=p_checkout_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF p_refund_cents < 0 OR p_refund_cents > v.gross_cents THEN RAISE EXCEPTION 'Bad refund amount'; END IF;
 IF p_refund_cents <= v.refunded_cents THEN RETURN; END IF;
 UPDATE public.checkout_payment_state SET refunded_cents=p_refund_cents WHERE checkout_id=p_checkout_id;
 IF p_fully_refunded THEN
   IF v.kind='tokens' THEN
     UPDATE public.profiles SET tokens=greatest(0,tokens-v.quantity) WHERE id=v.user_id;
   ELSIF v.kind='booking' THEN
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
     UPDATE public.trainer_earnings SET status=CASE WHEN p_fully_refunded THEN 'refunded' ELSE 'pending' END,
       reversal_target_cents=target WHERE id=e.id;
   END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_checkout_refund(text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_checkout_refund(text,integer,boolean) TO service_role;
