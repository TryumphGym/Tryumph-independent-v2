-- Marketplace evolution, November 2, 2026. Staging only; no historical rows rewritten.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.save_trybe_poll(text,text,text,text[],integer,timestamptz,boolean,boolean,uuid,integer)') IS NULL OR to_regprocedure('public.claim_program_payout(uuid)') IS NULL THEN RAISE EXCEPTION 'Reconcile the launch foundation and modules through 0059 first'; END IF;
 IF to_regclass('public.creator_offers') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.posts'::regclass AND attname='audience' AND NOT attisdropped) THEN RAISE EXCEPTION 'Creator module already exists; inspect before replay'; END IF;
END $$;
-- Keep p_live for compatibility with all existing callers; it no longer imposes a quota.
CREATE OR REPLACE FUNCTION public.trainer_is_eligible(p_user_id uuid,p_live boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT account_can_act(p_user_id) AND EXISTS(SELECT 1 FROM profiles WHERE id=p_user_id AND role='trainer')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified' AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id AND valid_iso_date(expires) AND expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AND name ~* '\m(CPR|cardiopulmonary resuscitation)\M')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified' AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id AND valid_iso_date(expires) AND expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AND name ~* '\m(AED|automated external defibrillator)\M')
 AND NOT EXISTS(SELECT 1 FROM trainer_credential_requirements r WHERE r.trainer_id=p_user_id AND NOT EXISTS(SELECT 1 FROM certifications c WHERE c.user_id=p_user_id AND lower(c.name)=lower(r.credential_name) AND c.status='verified' AND c.verified_at IS NOT NULL AND c.verified_by IS NOT NULL AND c.verified_by<>c.user_id AND valid_iso_date(c.expires) AND c.expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')))
$$;
CREATE OR REPLACE FUNCTION public.check_trainer_live_eligibility() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.trainer_id<>OLD.trainer_id THEN RAISE EXCEPTION 'Cannot reassign a class'; END IF;
 IF NOT creator_can_sell(NEW.trainer_id) THEN RAISE EXCEPTION 'Current verified required credentials including CPR/AED and payout eligibility are required'; END IF;
 IF NEW.starts_at<now() AND (TG_OP='INSERT' OR NEW.starts_at IS DISTINCT FROM OLD.starts_at) THEN RAISE EXCEPTION 'Cannot schedule in the past'; END IF;RETURN NEW;
END $$;
CREATE TABLE public.creator_commerce(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,commission_bps integer NOT NULL DEFAULT 1000 CHECK(commission_bps=1000),terms_version text,approved_by uuid REFERENCES auth.users(id),approved_at timestamptz,CHECK(NOT enabled OR (length(terms_version) BETWEEN 3 AND 120 AND approved_by IS NOT NULL AND approved_at IS NOT NULL)));
INSERT INTO public.creator_commerce(singleton) VALUES(true);
CREATE TABLE public.creator_offers(trainer_id uuid PRIMARY KEY REFERENCES auth.users(id),title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),description text NOT NULL DEFAULT '' CHECK(length(description)<=3000),price_cents integer NOT NULL CHECK(price_cents BETWEEN 50 AND 1000000),currency text NOT NULL DEFAULT 'usd' CHECK(currency='usd'),enabled boolean NOT NULL DEFAULT false,blocked boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.creator_prices(trainer_id uuid REFERENCES public.creator_offers(trainer_id),revision integer NOT NULL,price_cents integer NOT NULL CHECK(price_cents>=50),stripe_price_id text UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(trainer_id,revision));
CREATE TABLE public.creator_customers(user_id uuid PRIMARY KEY REFERENCES auth.users(id),customer_id text NOT NULL UNIQUE);
CREATE TABLE public.creator_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),trainer_id uuid NOT NULL REFERENCES auth.users(id),revision integer NOT NULL,price_cents integer NOT NULL CHECK(price_cents>=50),commission_bps integer NOT NULL CHECK(commission_bps=1000),terms_version text NOT NULL,consent_version text NOT NULL DEFAULT 'monthly-auto-renew-v1',consented_at timestamptz NOT NULL DEFAULT now(),destination text NOT NULL,checkout_id text UNIQUE,subscription_id text UNIQUE,customer_id text,state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','confirmed','cancelled')),billing_status text NOT NULL DEFAULT 'incomplete',cancel_at_period_end boolean NOT NULL DEFAULT false,renewal_stop_requested boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '45 minutes',FOREIGN KEY(trainer_id,revision) REFERENCES public.creator_prices(trainer_id,revision));
CREATE UNIQUE INDEX creator_one_pending_checkout ON public.creator_orders(user_id,trainer_id) WHERE state='pending';
CREATE INDEX creator_order_renewals ON public.creator_orders(created_at,id) WHERE subscription_id IS NOT NULL;
CREATE TABLE public.creator_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.creator_orders(id),invoice_id text NOT NULL UNIQUE,intent_id text NOT NULL UNIQUE,user_id uuid NOT NULL REFERENCES auth.users(id),trainer_id uuid NOT NULL REFERENCES auth.users(id),destination text NOT NULL,price_cents integer NOT NULL CHECK(price_cents>=50),fee_cents integer NOT NULL CHECK(fee_cents BETWEEN 0 AND price_cents),commission_bps integer NOT NULL CHECK(commission_bps=1000),refunded_cents integer NOT NULL DEFAULT 0 CHECK(refunded_cents BETWEEN 0 AND price_cents),refund_pending boolean NOT NULL DEFAULT false,fulfillable boolean NOT NULL,period_start timestamptz NOT NULL,period_end timestamptz NOT NULL,paid_at timestamptz NOT NULL,payout_dirty boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),CHECK(period_end>period_start AND period_end<=period_start+interval '62 days'));
CREATE INDEX creator_receipt_access ON public.creator_receipts(user_id,trainer_id,period_end DESC);
CREATE INDEX creator_receipt_trainer ON public.creator_receipts(trainer_id,paid_at DESC);
CREATE TABLE public.creator_disputes(id text PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.creator_receipts(id),status text NOT NULL CHECK(status IN ('open','won','lost')));
CREATE TABLE public.creator_transfer_operations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.creator_receipts(id),sequence integer NOT NULL,kind text NOT NULL CHECK(kind IN ('transfer','reversal')),amount integer NOT NULL CHECK(amount>0),transfer_id text,provider_id text UNIQUE,lease_until timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(order_id,sequence));
CREATE TABLE public.creator_refund_jobs(receipt_id uuid PRIMARY KEY REFERENCES public.creator_receipts(id),reason text NOT NULL,provider_id text,completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.creator_maintenance_state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),cursor_at timestamptz NOT NULL DEFAULT '-infinity',cursor_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000');
INSERT INTO public.creator_maintenance_state(singleton) VALUES(true);
CREATE FUNCTION public.creator_can_sell(p_trainer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT trainer_is_eligible(p_trainer,false) AND EXISTS(SELECT 1 FROM trainer_accounts WHERE user_id=p_trainer AND payouts_enabled AND stripe_account_id IS NOT NULL) $$;
CREATE FUNCTION public.creator_has_access(p_user uuid,p_trainer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_user IS NOT NULL AND account_can_act(p_user,false) AND NOT EXISTS(SELECT 1 FROM creator_offers WHERE trainer_id=p_trainer AND blocked) AND EXISTS(SELECT 1 FROM creator_receipts r WHERE r.user_id=p_user AND r.trainer_id=p_trainer AND r.fulfillable AND NOT r.refund_pending AND r.refunded_cents=0 AND r.period_start<=now() AND r.period_end>now() AND NOT EXISTS(SELECT 1 FROM creator_disputes d WHERE d.order_id=r.id AND d.status IN ('open','lost')))
$$;
CREATE FUNCTION public.is_creator_subscriber(p_trainer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT creator_has_access(auth.uid(),p_trainer) $$;
CREATE FUNCTION public.save_creator_offer(p_title text,p_description text,p_price integer,p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE revision_no integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer') OR (p_enabled AND NOT creator_can_sell(auth.uid())) THEN RAISE EXCEPTION 'Verified credentials and a payout-eligible Connect account required'; END IF;
 IF length(trim(p_title)) NOT BETWEEN 1 AND 120 OR length(p_description)>3000 OR p_price NOT BETWEEN 50 AND 1000000 OR p_enabled IS NULL THEN RAISE EXCEPTION 'Invalid monthly offer'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('creator-offer:'||auth.uid()));
 INSERT INTO creator_offers(trainer_id,title,description,price_cents,enabled) VALUES(auth.uid(),trim(p_title),p_description,p_price,p_enabled) ON CONFLICT(trainer_id) DO UPDATE SET title=excluded.title,description=excluded.description,price_cents=excluded.price_cents,enabled=excluded.enabled,revision=creator_offers.revision+1,updated_at=now() RETURNING revision INTO revision_no;
 INSERT INTO creator_prices(trainer_id,revision,price_cents) VALUES(auth.uid(),revision_no,p_price);
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'trainer',auth.uid()::text,'membership_offer_updated');
END $$;
CREATE FUNCTION public.approve_creator_terms(p_owner uuid,p_enabled boolean,p_bps integer,p_terms text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT has_role(p_owner,'admin') OR p_bps IS DISTINCT FROM 1000 OR length(trim(p_terms)) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Owner approval required'; END IF;
 UPDATE creator_commerce SET enabled=p_enabled,commission_bps=p_bps,terms_version=p_terms,approved_by=p_owner,approved_at=now();
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(p_owner,'commerce','memberships','terms_approved',p_terms||':'||p_bps);
END $$;
CREATE FUNCTION public.creator_offer_details(p_trainer uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce((SELECT jsonb_build_object('trainerId',trainer_id,'title',title,'description',description,'priceCents',price_cents,'currency',currency,'enabled',enabled AND NOT blocked AND creator_can_sell(trainer_id),'subscribed',creator_has_access(auth.uid(),trainer_id)) FROM creator_offers WHERE trainer_id=p_trainer),'{}')
$$;
CREATE FUNCTION public.begin_creator_order(p_user uuid,p_trainer uuid) RETURNS SETOF public.creator_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o creator_orders%ROWTYPE;p creator_offers%ROWTYPE;c creator_commerce%ROWTYPE;destination_id text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('creator-order:'||p_user||':'||p_trainer));
 SELECT * INTO p FROM creator_offers WHERE trainer_id=p_trainer;SELECT * INTO c FROM creator_commerce WHERE singleton;
 IF p.trainer_id IS NULL OR NOT p.enabled OR p.blocked OR NOT c.enabled OR p_user=p_trainer OR NOT account_can_act(p_user,false) OR NOT creator_can_sell(p_trainer) THEN RAISE EXCEPTION 'Monthly checkout disabled or trainer unavailable'; END IF;
 SELECT * INTO o FROM creator_orders WHERE user_id=p_user AND trainer_id=p_trainer AND (state='pending' OR (state='confirmed' AND billing_status NOT IN ('canceled','incomplete_expired'))) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN NEXT o;RETURN; END IF;
 IF creator_has_access(p_user,p_trainer) THEN RAISE EXCEPTION 'Already subscribed through a paid period'; END IF;
 SELECT stripe_account_id INTO destination_id FROM trainer_accounts WHERE user_id=p_trainer AND payouts_enabled;
 INSERT INTO creator_orders(user_id,trainer_id,revision,price_cents,commission_bps,terms_version,destination) VALUES(p_user,p_trainer,p.revision,p.price_cents,c.commission_bps,c.terms_version,destination_id) RETURNING * INTO o;RETURN NEXT o;
END $$;
CREATE FUNCTION public.attach_creator_subscription(p_order uuid,p_checkout text,p_subscription text,p_customer text,p_status text,p_cancel boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM creator_orders WHERE id=p_order AND (checkout_id IS NULL OR checkout_id=p_checkout) AND (subscription_id IS NULL OR nullif(p_subscription,'') IS NULL OR subscription_id=p_subscription) AND (customer_id IS NULL OR customer_id=p_customer) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription identity mismatch'; END IF;
 UPDATE creator_orders SET checkout_id=p_checkout,customer_id=p_customer,subscription_id=coalesce(subscription_id,nullif(p_subscription,'')),state=CASE WHEN nullif(p_subscription,'') IS NULL THEN state ELSE 'confirmed' END,billing_status=p_status,cancel_at_period_end=p_cancel WHERE id=p_order;
END $$;
CREATE FUNCTION public.record_creator_invoice(p_order uuid,p_invoice text,p_intent text,p_gross integer,p_fee integer,p_refunded integer,p_start timestamptz,p_end timestamptz,p_paid timestamptz) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o creator_orders%ROWTYPE;r creator_receipts%ROWTYPE;eligible boolean;
BEGIN
 SELECT * INTO o FROM creator_orders WHERE id=p_order FOR UPDATE;
 IF o.subscription_id IS NULL OR o.price_cents<>p_gross OR p_fee NOT BETWEEN 0 AND p_gross OR p_refunded NOT BETWEEN 0 AND p_gross OR p_start>p_paid+interval '5 minutes' OR p_paid>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'Invalid confirmed recurring payment'; END IF;
 SELECT * INTO r FROM creator_receipts WHERE invoice_id=p_invoice FOR UPDATE;
 IF FOUND THEN
  IF r.order_id<>p_order OR r.intent_id<>p_intent OR r.price_cents<>p_gross OR r.fee_cents<>p_fee OR r.period_start<>p_start OR r.period_end<>p_end THEN RAISE EXCEPTION 'Invoice replay mismatch'; END IF;
  UPDATE creator_receipts SET refunded_cents=greatest(refunded_cents,p_refunded),payout_dirty=true WHERE id=r.id;RETURN r.id;
 END IF;
 eligible=creator_can_sell(o.trainer_id) AND EXISTS(SELECT 1 FROM creator_offers WHERE trainer_id=o.trainer_id AND enabled AND NOT blocked) AND NOT o.renewal_stop_requested;
 INSERT INTO creator_receipts(order_id,invoice_id,intent_id,user_id,trainer_id,destination,price_cents,fee_cents,commission_bps,refunded_cents,fulfillable,refund_pending,period_start,period_end,paid_at) VALUES(o.id,p_invoice,p_intent,o.user_id,o.trainer_id,o.destination,p_gross,p_fee,o.commission_bps,p_refunded,eligible,NOT eligible,p_start,p_end,p_paid) RETURNING * INTO r;
 IF NOT eligible THEN INSERT INTO creator_refund_jobs(receipt_id,reason) VALUES(r.id,'Trainer ineligible or renewal stopped at settlement'); END IF;
 INSERT INTO trybe_memberships(user_id,trybe_id) VALUES(o.user_id,'coach-'||o.trainer_id::text) ON CONFLICT DO NOTHING;RETURN r.id;
END $$;
CREATE FUNCTION public.adjust_creator_receipt(p_receipt uuid,p_refunded integer,p_dispute text DEFAULT '',p_status text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM creator_receipts WHERE id=p_receipt AND p_refunded BETWEEN 0 AND price_cents FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invoice adjustment'; END IF;
 UPDATE creator_receipts SET refunded_cents=greatest(refunded_cents,p_refunded),payout_dirty=true WHERE id=p_receipt;
 IF nullif(p_dispute,'') IS NOT NULL THEN
  IF p_status NOT IN ('open','won','lost') OR EXISTS(SELECT 1 FROM creator_disputes WHERE id=p_dispute AND order_id<>p_receipt) THEN RAISE EXCEPTION 'Invalid dispute'; END IF;
  INSERT INTO creator_disputes(id,order_id,status) VALUES(p_dispute,p_receipt,p_status) ON CONFLICT(id) DO UPDATE SET status=CASE WHEN creator_disputes.status IN ('won','lost') THEN creator_disputes.status ELSE excluded.status END;
 END IF;
END $$;
CREATE FUNCTION public.request_creator_refund(p_receipt uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR length(trim(p_reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Admin refund review required'; END IF;
 UPDATE creator_receipts SET refund_pending=true,payout_dirty=true WHERE id=p_receipt;IF NOT FOUND THEN RAISE EXCEPTION 'Unknown receipt'; END IF;
 INSERT INTO creator_refund_jobs(receipt_id,reason) VALUES(p_receipt,p_reason) ON CONFLICT DO NOTHING;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'membership',p_receipt::text,'refund_requested',p_reason);
END $$;
CREATE FUNCTION public.moderate_creator_offer(p_trainer uuid,p_blocked boolean,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR length(trim(p_reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Admin moderation required'; END IF;
 UPDATE creator_offers SET blocked=p_blocked WHERE trainer_id=p_trainer;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'trainer',p_trainer::text,'membership_block:'||p_blocked,p_reason);
END $$;
CREATE FUNCTION public.creator_dashboard() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('offer',(SELECT to_jsonb(o) FROM creator_offers o WHERE trainer_id=auth.uid()),'subscribers',(SELECT count(DISTINCT r.user_id) FROM creator_receipts r WHERE r.trainer_id=auth.uid() AND creator_has_access(r.user_id,r.trainer_id)),'grossCents',(SELECT coalesce(sum(price_cents),0) FROM creator_receipts WHERE trainer_id=auth.uid()),'refundedCents',(SELECT coalesce(sum(refunded_cents),0) FROM creator_receipts WHERE trainer_id=auth.uid()),'feesCents',(SELECT coalesce(sum(fee_cents),0) FROM creator_receipts WHERE trainer_id=auth.uid()),'earnedCents',(SELECT coalesce(sum(CASE WHEN refund_pending OR EXISTS(SELECT 1 FROM creator_disputes d WHERE d.order_id=r.id AND d.status IN ('open','lost')) THEN 0 ELSE floor(greatest(price_cents-refunded_cents-fee_cents,0)::numeric*(10000-commission_bps)/10000) END),0) FROM creator_receipts r WHERE trainer_id=auth.uid()),'subscriptions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'trainerId',o.trainer_id,'priceCents',o.price_cents,'billingStatus',o.billing_status,'cancelAtPeriodEnd',o.cancel_at_period_end,'accessUntil',(SELECT max(period_end) FROM creator_receipts r WHERE r.order_id=o.id AND r.refunded_cents=0 AND NOT r.refund_pending),'hasAccess',creator_has_access(o.user_id,o.trainer_id)) ORDER BY o.created_at DESC),'[]') FROM creator_orders o WHERE o.user_id=auth.uid() AND o.subscription_id IS NOT NULL))
$$;
CREATE FUNCTION public.guard_paid_program_offer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.builder_version=2 AND NEW.published AND EXISTS(SELECT 1 FROM program_editions WHERE id=NEW.current_edition AND document->>'mode'='native') AND NOT creator_can_sell(NEW.trainer_id) THEN RAISE EXCEPTION 'Paid publication requires verified credentials and payout eligibility'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER creator_paid_program_guard BEFORE INSERT OR UPDATE ON public.trainer_programs FOR EACH ROW EXECUTE FUNCTION public.guard_paid_program_offer();
CREATE FUNCTION public.guard_new_program_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL AND NOT creator_can_sell(NEW.trainer_id) THEN NEW.refund_pending=true;INSERT INTO program_refund_requests(order_id,reason) VALUES(NEW.id,'Trainer payout eligibility unavailable at settlement') ON CONFLICT DO NOTHING; END IF;RETURN NEW;
END $$;
CREATE TRIGGER creator_new_program_payment BEFORE UPDATE ON public.program_orders FOR EACH ROW EXECUTE FUNCTION public.guard_new_program_payment();
CREATE OR REPLACE FUNCTION public.claim_creator_payout(p_order uuid) RETURNS SETOF public.creator_transfer_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o creator_receipts%ROWTYPE;x creator_transfer_operations%ROWTYPE;desired integer;actual integer;amount integer;n integer;
BEGIN
 SELECT * INTO o FROM creator_receipts WHERE id=p_order FOR UPDATE;IF o.paid_at IS NULL THEN RETURN; END IF;
 SELECT * INTO x FROM creator_transfer_operations WHERE order_id=o.id AND provider_id IS NULL;
 IF FOUND THEN
  IF x.created_at<now()-interval '23 hours' THEN RAISE EXCEPTION 'Ambiguous payout requires provider reconciliation'; END IF;
  IF x.lease_until>now() THEN RETURN; END IF;
 ELSE
  desired=floor(greatest(o.price_cents-o.refunded_cents-o.fee_cents,0)::bigint*(10000-o.commission_bps)::numeric/10000);
  IF o.refund_pending OR EXISTS(SELECT 1 FROM creator_disputes WHERE order_id=o.id AND status IN ('open','lost')) THEN desired=0; END IF;
  SELECT coalesce(sum(CASE WHEN pay.kind='transfer' THEN pay.amount ELSE -pay.amount END),0) INTO actual FROM creator_transfer_operations pay WHERE pay.order_id=o.id AND pay.provider_id IS NOT NULL;
  IF actual=desired THEN UPDATE creator_receipts SET payout_dirty=false WHERE id=o.id;RETURN; END IF;SELECT coalesce(max(sequence),0)+1 INTO n FROM creator_transfer_operations WHERE order_id=o.id;
  IF actual<desired THEN
   INSERT INTO creator_transfer_operations(order_id,sequence,kind,amount) VALUES(o.id,n,'transfer',desired-actual) RETURNING * INTO x;
  ELSE
   SELECT t.* INTO x FROM creator_transfer_operations t WHERE t.order_id=o.id AND t.kind='transfer' AND t.provider_id IS NOT NULL AND t.amount>(SELECT coalesce(sum(r.amount),0) FROM creator_transfer_operations r WHERE r.order_id=o.id AND r.kind='reversal' AND r.transfer_id=t.provider_id AND r.provider_id IS NOT NULL) ORDER BY t.sequence LIMIT 1;
   amount=least(actual-desired,x.amount-(SELECT coalesce(sum(r.amount),0) FROM creator_transfer_operations r WHERE r.order_id=o.id AND r.kind='reversal' AND r.transfer_id=x.provider_id AND r.provider_id IS NOT NULL));
   INSERT INTO creator_transfer_operations(order_id,sequence,kind,amount,transfer_id) VALUES(o.id,n,'reversal',amount,x.provider_id) RETURNING * INTO x;
  END IF;
 END IF;
 UPDATE creator_transfer_operations SET lease_until=now()+interval '2 minutes' WHERE id=x.id RETURNING * INTO x;RETURN NEXT x;
END $$;
CREATE OR REPLACE FUNCTION public.finish_creator_payout(p_operation uuid,p_provider text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE x creator_transfer_operations%ROWTYPE;parent uuid;
BEGIN
 SELECT order_id INTO parent FROM creator_transfer_operations WHERE id=p_operation;PERFORM 1 FROM creator_receipts WHERE id=parent FOR UPDATE;
 SELECT * INTO x FROM creator_transfer_operations WHERE id=p_operation FOR UPDATE;
 IF x.id IS NULL OR length(p_provider)<4 OR (x.provider_id IS NOT NULL AND x.provider_id<>p_provider) THEN RAISE EXCEPTION 'Payout confirmation mismatch'; END IF;
 UPDATE creator_transfer_operations SET provider_id=p_provider WHERE id=x.id;UPDATE creator_receipts SET payout_dirty=true WHERE id=x.order_id;
END $$;


CREATE FUNCTION public.creator_renewal_batch(p_limit integer DEFAULT 100) RETURNS SETOF public.creator_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cursor_state creator_maintenance_state%ROWTYPE;r creator_orders%ROWTYPE;n integer:=0;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid maintenance batch'; END IF;
 SELECT * INTO cursor_state FROM creator_maintenance_state WHERE singleton FOR UPDATE;
 FOR r IN SELECT * FROM creator_orders WHERE subscription_id IS NOT NULL AND billing_status NOT IN ('canceled','incomplete_expired') AND (created_at,id)>(cursor_state.cursor_at,cursor_state.cursor_id) ORDER BY created_at,id LIMIT p_limit LOOP
 UPDATE creator_maintenance_state SET cursor_at=r.created_at,cursor_id=r.id WHERE singleton;n=n+1;RETURN NEXT r;END LOOP;
 IF n<p_limit THEN UPDATE creator_maintenance_state SET cursor_at='-infinity',cursor_id='00000000-0000-0000-0000-000000000000' WHERE singleton;END IF;
END $$;
REVOKE ALL ON FUNCTION public.creator_renewal_batch(integer) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.creator_renewal_batch(integer) TO service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['creator_commerce','creator_offers','creator_prices','creator_customers','creator_orders','creator_receipts','creator_disputes','creator_transfer_operations','creator_refund_jobs','creator_maintenance_state'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.creator_can_sell(uuid),public.creator_has_access(uuid,uuid),public.is_creator_subscriber(uuid),public.save_creator_offer(text,text,integer,boolean),public.approve_creator_terms(uuid,boolean,integer,text),public.creator_offer_details(uuid),public.begin_creator_order(uuid,uuid),public.attach_creator_subscription(uuid,text,text,text,text,boolean),public.record_creator_invoice(uuid,text,text,integer,integer,integer,timestamptz,timestamptz,timestamptz),public.adjust_creator_receipt(uuid,integer,text,text),public.request_creator_refund(uuid,text),public.moderate_creator_offer(uuid,boolean,text),public.creator_dashboard(),public.guard_paid_program_offer(),public.guard_new_program_payment(),public.claim_creator_payout(uuid),public.finish_creator_payout(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_creator_subscriber(uuid),public.creator_offer_details(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_creator_offer(text,text,integer,boolean),public.creator_dashboard(),public.request_creator_refund(uuid,text),public.moderate_creator_offer(uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_can_sell(uuid),public.creator_has_access(uuid,uuid),public.approve_creator_terms(uuid,boolean,integer,text),public.begin_creator_order(uuid,uuid),public.attach_creator_subscription(uuid,text,text,text,text,boolean),public.record_creator_invoice(uuid,text,text,integer,integer,integer,timestamptz,timestamptz,timestamptz),public.adjust_creator_receipt(uuid,integer,text,text),public.claim_creator_payout(uuid),public.finish_creator_payout(uuid,text) TO service_role;
COMMIT;
