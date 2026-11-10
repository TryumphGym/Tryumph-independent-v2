-- Preserve payments. Hold unused class-specific token top-ups and queue real refunds
-- when subscription settlement and an already-open drop-in checkout race.
BEGIN;
DO $$ DECLARE c record;BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.wallet_token_units'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%state%' LOOP EXECUTE format('ALTER TABLE public.wallet_token_units DROP CONSTRAINT %I',c.conname);END LOOP;END $$;
ALTER TABLE public.wallet_token_units ADD CONSTRAINT wallet_unit_state CHECK(state IN ('available','spent','refunded','held'));
CREATE TABLE public.live_payment_links(checkout_id text PRIMARY KEY REFERENCES public.checkout_payment_state(checkout_id),user_id uuid NOT NULL REFERENCES auth.users(id),session_id uuid NOT NULL REFERENCES public.live_sessions(id),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.live_payment_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_payment_links FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.live_payment_links TO service_role;
CREATE FUNCTION public.reconcile_included_live_payment(p_checkout text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE link live_payment_links%ROWTYPE;s live_sessions%ROWTYPE;lot wallet_token_lots%ROWTYPE;BEGIN
 SELECT * INTO link FROM live_payment_links WHERE checkout_id=p_checkout;IF NOT FOUND THEN RETURN;END IF;
 PERFORM 1 FROM profiles WHERE id=link.user_id FOR UPDATE;
 SELECT * INTO s FROM live_sessions WHERE id=link.session_id;
 IF NOT creator_has_access(link.user_id,s.trainer_id) OR NOT EXISTS(SELECT 1 FROM creator_receipts r WHERE r.user_id=link.user_id AND r.trainer_id=s.trainer_id AND r.fulfillable AND NOT r.refund_pending AND r.refunded_cents=0 AND r.period_start<=s.starts_at AND r.period_end>s.starts_at AND NOT EXISTS(SELECT 1 FROM creator_disputes d WHERE d.order_id=r.id AND d.status IN ('open','lost'))) THEN RETURN;END IF;
 SELECT * INTO lot FROM wallet_token_lots WHERE id=p_checkout AND user_id=link.user_id AND purchased=1 AND gross_cents=500 FOR UPDATE;
 IF lot.id IS NULL THEN RETURN;END IF;
 -- Never refund an already consumed legitimate drop-in or an unrelated bulk wallet purchase.
 PERFORM 1 FROM wallet_token_units WHERE lot_id=lot.id AND unit_index=0 AND state='available' AND redemption_id IS NULL FOR UPDATE;IF NOT FOUND THEN RETURN;END IF;
 UPDATE wallet_token_units SET state='held' WHERE lot_id=lot.id AND unit_index=0;
 UPDATE wallet_token_lots SET frozen=true WHERE id=lot.id;PERFORM sync_wallet_balance(link.user_id);
 INSERT INTO refund_jobs(checkout_id,reason,target_cents) VALUES(p_checkout,'subscription_included_live',500) ON CONFLICT(checkout_id) DO UPDATE SET target_cents=500,completed_at=CASE WHEN coalesce(refund_jobs.target_cents,500)<500 THEN NULL ELSE refund_jobs.completed_at END;
 PERFORM notify_account(link.user_id,'included-live-refund:'||p_checkout,'session','Your subscription includes this class. The unused class top-up is held and a $5 refund is queued; it is not yet confirmed.','/account');
END $$;
ALTER FUNCTION public.settle_paid_checkout(text,jsonb,integer) RENAME TO settle_paid_checkout_v54;
CREATE FUNCTION public.settle_paid_checkout(p_kind text,p_args jsonb,p_refunded integer DEFAULT 0) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF p_kind='tokens' AND p_args ? 'p_session_id' AND ((p_args->>'p_tokens')::integer<>1 OR (p_args->>'p_gross_cents')::integer<>500 OR NOT EXISTS(SELECT 1 FROM live_sessions WHERE id=(p_args->>'p_session_id')::uuid)) THEN RAISE EXCEPTION 'Invalid class-specific top-up';END IF;
 PERFORM settle_paid_checkout_v54(p_kind,p_args,p_refunded);
 IF p_kind='tokens' AND p_args ? 'p_session_id' THEN
 IF NOT EXISTS(SELECT 1 FROM checkout_payment_state WHERE checkout_id=p_args->>'p_checkout_id' AND kind='tokens' AND user_id=(p_args->>'p_user_id')::uuid AND quantity=1 AND gross_cents=500 AND fee_cents=(p_args->>'p_fee_cents')::integer) THEN RAISE EXCEPTION 'Class payment identity mismatch';END IF;
 IF EXISTS(SELECT 1 FROM live_payment_links WHERE checkout_id=p_args->>'p_checkout_id' AND (user_id<>(p_args->>'p_user_id')::uuid OR session_id<>(p_args->>'p_session_id')::uuid)) THEN RAISE EXCEPTION 'Class payment replay mismatch';END IF;
 INSERT INTO live_payment_links(checkout_id,user_id,session_id) VALUES(p_args->>'p_checkout_id',(p_args->>'p_user_id')::uuid,(p_args->>'p_session_id')::uuid) ON CONFLICT DO NOTHING;PERFORM reconcile_included_live_payment(p_args->>'p_checkout_id');END IF;
END $$;
CREATE FUNCTION public.reconcile_membership_live_payments() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE payment text;BEGIN FOR payment IN SELECT l.checkout_id FROM live_payment_links l JOIN live_sessions s ON s.id=l.session_id WHERE l.user_id=NEW.user_id AND s.trainer_id=NEW.trainer_id AND s.starts_at>=NEW.period_start AND s.starts_at<NEW.period_end LOOP PERFORM reconcile_included_live_payment(payment);END LOOP;RETURN NEW;END $$;
CREATE TRIGGER membership_live_payment_reconciliation AFTER INSERT ON public.creator_receipts FOR EACH ROW EXECUTE FUNCTION public.reconcile_membership_live_payments();
REVOKE ALL ON FUNCTION public.settle_paid_checkout(text,jsonb,integer),public.reconcile_included_live_payment(text),public.reconcile_membership_live_payments() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paid_checkout(text,jsonb,integer),public.reconcile_included_live_payment(text) TO service_role;
COMMIT;
