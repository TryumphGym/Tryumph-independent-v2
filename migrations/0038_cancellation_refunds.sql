CREATE TABLE IF NOT EXISTS public.refund_jobs(checkout_id text PRIMARY KEY,reason text NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,provider_id text);
ALTER TABLE public.refund_jobs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.refund_jobs TO service_role;
CREATE OR REPLACE FUNCTION public.queue_cancelled_class_refunds()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='cancelled' AND OLD.status<>'cancelled' THEN
  INSERT INTO refund_jobs(checkout_id,reason)
   SELECT stripe_checkout_session_id,'class_cancelled' FROM live_room_access
    WHERE session_id=NEW.id AND status='paid' AND stripe_checkout_session_id IS NOT NULL ON CONFLICT DO NOTHING;
  -- Wallet redemptions are refunded atomically to the original lot exactly once.
  WITH returned AS (UPDATE live_room_access SET status='cancelled' WHERE session_id=NEW.id AND status='paid'
   AND wallet_lot_id IS NOT NULL RETURNING wallet_lot_id,user_id,session_id)
  UPDATE wallet_token_lots l SET remaining=remaining+1 FROM returned r WHERE l.id=r.wallet_lot_id;
  UPDATE profiles p SET tokens=(SELECT coalesce(sum(remaining),0) FROM wallet_token_lots WHERE user_id=p.id)
   WHERE id IN(SELECT user_id FROM live_room_access WHERE session_id=NEW.id AND wallet_lot_id IS NOT NULL);
  UPDATE trainer_earnings SET reversal_target_cents=payout_cents,
    status=CASE WHEN transfer_id IS NULL AND operation_key IS NULL THEN 'refunded' ELSE 'reversal_due' END
   WHERE ref IN(SELECT 'wallet:'||session_id::text||':'||user_id::text FROM live_room_access WHERE session_id=NEW.id AND wallet_lot_id IS NOT NULL);
 END IF;
 IF NEW.starts_at IS DISTINCT FROM OLD.starts_at AND EXISTS(SELECT 1 FROM live_room_access WHERE session_id=NEW.id AND status='paid')
 THEN RAISE EXCEPTION 'Cancel a booked class before changing its time'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cancellation_refunds ON live_sessions;
CREATE TRIGGER cancellation_refunds AFTER UPDATE ON live_sessions FOR EACH ROW EXECUTE FUNCTION queue_cancelled_class_refunds();
DROP POLICY IF EXISTS "coach deletes own" ON live_sessions;
-- A trainer cannot erase a calendar reservation backed by a payment.
DROP POLICY IF EXISTS "owner manage own busy" ON trainer_busy;
DROP POLICY IF EXISTS busy_owner_insert ON trainer_busy;
CREATE POLICY busy_owner_insert ON trainer_busy FOR INSERT TO authenticated WITH CHECK(trainer_id=auth.uid()::text AND source='personal');
DROP POLICY IF EXISTS busy_owner_delete ON trainer_busy;
CREATE POLICY busy_owner_delete ON trainer_busy FOR DELETE TO authenticated USING(trainer_id=auth.uid()::text AND source='personal');
DROP POLICY IF EXISTS busy_owner_update ON trainer_busy;
CREATE POLICY busy_owner_update ON trainer_busy FOR UPDATE TO authenticated USING(trainer_id=auth.uid()::text AND source='personal') WITH CHECK(trainer_id=auth.uid()::text AND source='personal');
CREATE OR REPLACE FUNCTION public.cancel_private_session(p_checkout_id text,p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE;
BEGIN
 SELECT * INTO b FROM private_session_access WHERE checkout_id=p_checkout_id FOR UPDATE;
 IF NOT FOUND OR p_user_id NOT IN (b.trainer_id,b.member_id) THEN RAISE EXCEPTION 'Not your booking'; END IF;
 IF b.status<>'paid' THEN RETURN; END IF;
 IF b.starts_at<=now() THEN RAISE EXCEPTION 'Contact support for a session already started'; END IF;
 UPDATE private_session_access SET status='cancelled' WHERE checkout_id=p_checkout_id;
 INSERT INTO refund_jobs(checkout_id,reason) VALUES(p_checkout_id,'private_cancelled') ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.cancel_private_session(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_private_session(text,uuid) TO service_role;
