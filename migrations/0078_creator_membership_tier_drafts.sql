-- Three-tier creator membership planning wizard. Draft-only: checkout and entitlement
-- enforcement are deliberately unchanged until tier-aware Stripe/provider acceptance.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.creator_tier_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  four_class_min_cents integer NOT NULL DEFAULT 999 CHECK(four_class_min_cents >= 50),
  eight_class_min_cents integer NOT NULL DEFAULT 1499 CHECK(eight_class_min_cents >= four_class_min_cents),
  unlimited_min_cents integer NOT NULL DEFAULT 2999 CHECK(unlimited_min_cents >= eight_class_min_cents),
  standard_commission_bps integer NOT NULL DEFAULT 1000 CHECK(standard_commission_bps = 1000),
  live_commission_bps integer NOT NULL DEFAULT 2000 CHECK(live_commission_bps = 2000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.creator_tier_policy(singleton) VALUES(true);
ALTER TABLE public.creator_tier_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creator_tier_policy FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.creator_tier_policy TO service_role;

CREATE TABLE public.creator_tier_drafts (
  trainer_id uuid NOT NULL REFERENCES auth.users(id),
  tier_no smallint NOT NULL CHECK(tier_no BETWEEN 1 AND 3),
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK(length(description) <= 3000),
  price_cents integer NOT NULL CHECK(price_cents BETWEEN 50 AND 1000000),
  benefits jsonb NOT NULL,
  commission_bps integer NOT NULL CHECK(commission_bps IN (1000,2000)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trainer_id, tier_no),
  CONSTRAINT creator_tier_draft_benefit_object CHECK(jsonb_typeof(benefits)='object')
);
ALTER TABLE public.creator_tier_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creator_tier_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.creator_tier_drafts TO authenticated;
GRANT ALL ON public.creator_tier_drafts TO service_role;
CREATE POLICY creator_tier_draft_owner_read ON public.creator_tier_drafts
 FOR SELECT TO authenticated USING(trainer_id=(SELECT auth.uid()));

CREATE FUNCTION public.creator_tier_setup() RETURNS jsonb LANGUAGE sql STABLE
 SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
   'policy',(SELECT to_jsonb(p) FROM creator_tier_policy p WHERE singleton),
   'tiers',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY tier_no),'[]'::jsonb)
            FROM creator_tier_drafts t WHERE trainer_id=auth.uid())
 )
$$;

CREATE FUNCTION public.save_creator_tier_draft(
 p_tier smallint,p_title text,p_description text,p_price integer,p_benefits jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 cfg creator_tier_policy%ROWTYPE;
 scheduled boolean;
 members_only boolean;
 live_count integer;
 programs text;
 selected jsonb;
 item text;
 charge integer;
 min_price integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer')
 THEN RAISE EXCEPTION 'Trainer sign-in required'; END IF;
 IF p_tier IS NULL OR p_tier NOT BETWEEN 1 AND 3 OR p_title IS NULL
    OR length(trim(p_title)) NOT BETWEEN 1 AND 120 OR p_description IS NULL
    OR length(p_description)>3000 OR p_price IS NULL OR p_price NOT BETWEEN 50 AND 1000000
    OR p_benefits IS NULL OR jsonb_typeof(p_benefits)<>'object'
 THEN RAISE EXCEPTION 'Invalid membership tier'; END IF;
 IF (p_benefits - ARRAY['scheduledLives','memberOnlyLives','liveClassesPerMonth','programAccess','selectedProgramIds','memberVideos','earlyAccess','trybePosts','autoIncludeNewPrograms']) <> '{}'::jsonb
 THEN RAISE EXCEPTION 'Unknown membership benefit'; END IF;
 IF jsonb_typeof(p_benefits->'scheduledLives')<>'boolean'
    OR jsonb_typeof(p_benefits->'memberOnlyLives')<>'boolean'
    OR jsonb_typeof(p_benefits->'liveClassesPerMonth')<>'number'
    OR jsonb_typeof(p_benefits->'programAccess')<>'string'
    OR jsonb_typeof(p_benefits->'selectedProgramIds')<>'array'
    OR jsonb_typeof(p_benefits->'memberVideos')<>'boolean'
    OR jsonb_typeof(p_benefits->'earlyAccess')<>'boolean'
    OR jsonb_typeof(p_benefits->'trybePosts')<>'boolean'
    OR jsonb_typeof(p_benefits->'autoIncludeNewPrograms')<>'boolean'
 THEN RAISE EXCEPTION 'Every membership benefit must be explicitly configured'; END IF;
 scheduled=(p_benefits->>'scheduledLives')::boolean;
 members_only=(p_benefits->>'memberOnlyLives')::boolean;
 live_count=(p_benefits->>'liveClassesPerMonth')::integer;
 programs=p_benefits->>'programAccess';
 selected=p_benefits->'selectedProgramIds';
 IF live_count NOT IN (0,4,8,-1) OR ((scheduled OR members_only) <> (live_count<>0))
 THEN RAISE EXCEPTION 'Choose a valid live-class allowance and at least one live-class type'; END IF;
 IF programs NOT IN ('none','all','selected')
    OR jsonb_array_length(selected)>100
    OR (programs<>'selected' AND jsonb_array_length(selected)>0)
    OR (programs='selected' AND jsonb_array_length(selected)=0)
    OR ((p_benefits->>'autoIncludeNewPrograms')::boolean AND programs<>'all')
 THEN RAISE EXCEPTION 'Select a valid program access option'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements_text(selected) LOOP
   IF NOT EXISTS(SELECT 1 FROM trainer_programs WHERE id=item::uuid AND trainer_id=auth.uid())
   THEN RAISE EXCEPTION 'Selected program does not belong to this trainer'; END IF;
 END LOOP;
 SELECT * INTO cfg FROM creator_tier_policy WHERE singleton FOR SHARE;
 min_price=CASE live_count WHEN 4 THEN cfg.four_class_min_cents
                           WHEN 8 THEN cfg.eight_class_min_cents
                           WHEN -1 THEN cfg.unlimited_min_cents ELSE 50 END;
 IF p_price<min_price THEN RAISE EXCEPTION 'This live benefit requires a monthly price of at least % cents',min_price; END IF;
 charge=CASE WHEN live_count<>0 THEN cfg.live_commission_bps ELSE cfg.standard_commission_bps END;
 PERFORM pg_advisory_xact_lock(hashtext('creator-tiers:'||auth.uid()::text));
 INSERT INTO creator_tier_drafts(trainer_id,tier_no,title,description,price_cents,benefits,commission_bps)
 VALUES(auth.uid(),p_tier,trim(p_title),p_description,p_price,p_benefits,charge)
 ON CONFLICT(trainer_id,tier_no) DO UPDATE SET
  title=excluded.title,description=excluded.description,price_cents=excluded.price_cents,
  benefits=excluded.benefits,commission_bps=excluded.commission_bps,updated_at=now();
END $$;

CREATE FUNCTION public.delete_creator_tier_draft(p_tier smallint) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR p_tier IS NULL OR p_tier NOT BETWEEN 1 AND 3 THEN
  RAISE EXCEPTION 'Invalid trainer tier'; END IF;
 DELETE FROM creator_tier_drafts WHERE trainer_id=auth.uid() AND tier_no=p_tier;
END $$;

CREATE FUNCTION public.update_creator_tier_policy(p_four integer,p_eight integer,p_unlimited integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin permission required'; END IF;
 IF p_four IS NULL OR p_eight IS NULL OR p_unlimited IS NULL
    OR p_four<50 OR p_eight<p_four OR p_unlimited<p_eight THEN
  RAISE EXCEPTION 'Invalid tier price floors'; END IF;
 -- Never silently invalidate a previously saved draft; trainers must edit it
 -- before it can be published by the later billing implementation.
 UPDATE creator_tier_policy SET four_class_min_cents=p_four,
  eight_class_min_cents=p_eight,unlimited_min_cents=p_unlimited,updated_at=now()
 WHERE singleton;
END $$;
REVOKE ALL ON FUNCTION public.creator_tier_setup(),public.save_creator_tier_draft(smallint,text,text,integer,jsonb),
 public.delete_creator_tier_draft(smallint),public.update_creator_tier_policy(integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.creator_tier_setup(),public.save_creator_tier_draft(smallint,text,text,integer,jsonb),
 public.delete_creator_tier_draft(smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_creator_tier_policy(integer,integer,integer) TO authenticated;
COMMIT;
