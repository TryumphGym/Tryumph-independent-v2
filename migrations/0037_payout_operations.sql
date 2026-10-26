-- A persisted operation outlives a process crash. Retries use the same Stripe idempotency key.
ALTER TABLE trainer_earnings DROP CONSTRAINT IF EXISTS trainer_earnings_status_check;
ALTER TABLE trainer_earnings ADD CONSTRAINT trainer_earnings_status_check CHECK(status IN ('pending','paid','refunded','reversal_due','transferring'));
ALTER TABLE trainer_earnings ADD COLUMN IF NOT EXISTS withheld_cents integer NOT NULL DEFAULT 0;
ALTER TABLE trainer_earnings ADD COLUMN IF NOT EXISTS operation_key text;
ALTER TABLE trainer_earnings ADD COLUMN IF NOT EXISTS operation_kind text;
ALTER TABLE trainer_earnings ADD COLUMN IF NOT EXISTS operation_amount integer;
ALTER TABLE trainer_earnings ADD COLUMN IF NOT EXISTS operation_target integer;
ALTER TABLE trainer_earnings ADD COLUMN IF NOT EXISTS operation_lease_until timestamptz;
CREATE OR REPLACE FUNCTION claim_earning_operation(p_id uuid)
RETURNS SETOF public.trainer_earnings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e trainer_earnings%ROWTYPE; amount integer; kind text;
BEGIN
 SELECT * INTO e FROM trainer_earnings WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR e.status NOT IN ('pending','transferring','reversal_due') THEN RETURN; END IF;
 IF e.operation_key IS NOT NULL THEN
  IF e.operation_lease_until>now() THEN RETURN; END IF;
 ELSE
  IF e.transfer_id IS NULL THEN
   amount=e.payout_cents-e.reversal_target_cents; kind='transfer';
  ELSE
   amount=e.reversal_target_cents-e.withheld_cents-e.transfer_reversed_cents; kind='reversal';
  END IF;
  IF amount<=0 THEN
   UPDATE trainer_earnings SET status=CASE WHEN transfer_id IS NULL THEN 'refunded' ELSE 'paid' END WHERE id=p_id;
   RETURN;
  END IF;
  UPDATE trainer_earnings SET operation_kind=kind,operation_amount=amount,operation_target=e.reversal_target_cents,
   operation_key='earning:'||id::text||':'||kind||':'||e.reversal_target_cents::text,
   status=CASE WHEN kind='transfer' THEN 'transferring' ELSE 'reversal_due' END WHERE id=p_id;
 END IF;
 UPDATE trainer_earnings SET operation_lease_until=now()+interval '2 minutes' WHERE id=p_id;
 RETURN QUERY SELECT * FROM trainer_earnings WHERE id=p_id;
END $$;
CREATE OR REPLACE FUNCTION finish_earning_operation(p_id uuid,p_key text,p_provider_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e trainer_earnings%ROWTYPE;
BEGIN
 SELECT * INTO e FROM trainer_earnings WHERE id=p_id FOR UPDATE;
 IF e.operation_key IS DISTINCT FROM p_key THEN RETURN; END IF;
 IF p_provider_id IS NULL OR length(p_provider_id)<3 THEN RAISE EXCEPTION 'Missing provider confirmation'; END IF;
 IF e.operation_kind='transfer' THEN
  UPDATE trainer_earnings SET transfer_id=p_provider_id,withheld_cents=payout_cents-e.operation_amount WHERE id=p_id;
 ELSE
  UPDATE trainer_earnings SET transfer_reversed_cents=transfer_reversed_cents+e.operation_amount WHERE id=p_id;
 END IF;
 UPDATE trainer_earnings SET status=CASE WHEN reversal_target_cents>withheld_cents+transfer_reversed_cents THEN 'reversal_due' ELSE 'paid' END,
 operation_key=NULL,operation_kind=NULL,operation_amount=NULL,operation_target=NULL,operation_lease_until=NULL WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION claim_earning_operation(uuid),finish_earning_operation(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION claim_earning_operation(uuid),finish_earning_operation(uuid,text,text) TO service_role;
