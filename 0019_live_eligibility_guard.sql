-- Apply in Supabase SQL editor after confirming live_sessions and trainer_videos exist.
-- A trainer cannot create or reschedule live sessions without current verified CPR/AED
-- and at least five approved on-demand videos. Runs even if client bypasses Studio.
CREATE OR REPLACE FUNCTION public.enforce_live_trainer_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approved_count integer;
  cpr_ok boolean;
BEGIN
  -- Prevent changing session ownership through UPDATE.
  IF TG_OP = 'UPDATE' AND NEW.trainer_id IS DISTINCT FROM OLD.trainer_id THEN
    RAISE EXCEPTION 'Cannot transfer a live session to another trainer';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.certifications c
    WHERE c.user_id = NEW.trainer_id
      AND c.status = 'verified'
      AND c.verified_at IS NOT NULL
      AND c.verified_by IS NOT NULL
      AND c.expires IS NOT NULL
      AND c.expires ~ '^\\d{4}-\\d{2}-\\d{2}$'
      AND c.expires::date >= CURRENT_DATE
      AND c.name ~* '(^|[^[:alnum:]])(CPR|cardiopulmonary resuscitation)([^[:alnum:]]|$)'
  ) INTO cpr_ok;

  IF NOT cpr_ok THEN
    RAISE EXCEPTION 'A current, admin-verified CPR/AED certification is required';
  END IF;

  SELECT COUNT(*) INTO approved_count
  FROM public.trainer_videos v
  WHERE v.user_id = NEW.trainer_id AND v.review_status = 'approved';

  IF approved_count < 5 THEN
    RAISE EXCEPTION 'Five approved on-demand videos are required to host live classes';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_live_trainer_eligibility() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS live_trainer_eligibility_guard ON public.live_sessions;
CREATE TRIGGER live_trainer_eligibility_guard
BEFORE INSERT OR UPDATE OF trainer_id, starts_at ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_live_trainer_eligibility();
