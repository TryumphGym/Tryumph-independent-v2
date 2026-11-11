-- Make on-demand uploads optional for live hosting without relaxing credential or payout checks.
-- This is a forward-only migration for a reviewed staging deployment; do not replay old migrations.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.trainer_is_eligible(p_user_id uuid,p_live boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT account_can_act(p_user_id) AND EXISTS(SELECT 1 FROM profiles WHERE id=p_user_id AND role='trainer')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified' AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id AND valid_iso_date(expires) AND expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AND name ~* '\m(CPR|cardiopulmonary resuscitation)\M')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified' AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id AND valid_iso_date(expires) AND expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AND name ~* '\m(AED|automated external defibrillator)\M')
 AND NOT EXISTS(SELECT 1 FROM trainer_credential_requirements r WHERE r.trainer_id=p_user_id AND NOT EXISTS(SELECT 1 FROM certifications c WHERE c.user_id=p_user_id AND lower(c.name)=lower(r.credential_name) AND c.status='verified' AND c.verified_at IS NOT NULL AND c.verified_by IS NOT NULL AND c.verified_by<>c.user_id AND valid_iso_date(c.expires) AND c.expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')))
$$;

CREATE OR REPLACE FUNCTION public.check_trainer_live_eligibility() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN IF TG_OP='UPDATE' AND NEW.trainer_id<>OLD.trainer_id THEN RAISE EXCEPTION 'Cannot reassign a class';END IF;IF NOT trainer_is_eligible(NEW.trainer_id,true) OR NOT creator_can_sell(NEW.trainer_id) THEN RAISE EXCEPTION 'Current credentials and payout eligibility required';END IF;IF NEW.starts_at<now() AND (TG_OP='INSERT' OR NEW.starts_at IS DISTINCT FROM OLD.starts_at) THEN RAISE EXCEPTION 'Cannot schedule in the past';END IF;RETURN NEW;END $$;

COMMIT;
