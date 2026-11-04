-- Planning only: no charge, activation, placement or impression API exists in this release.
BEGIN;
CREATE TABLE public.spotlight_packages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),days integer NOT NULL UNIQUE CHECK(days IN (3,7,30)),price_cents integer NOT NULL CHECK(price_cents BETWEEN 50 AND 1000000),available boolean NOT NULL DEFAULT false,inventory integer NOT NULL DEFAULT 0 CHECK(inventory>=0),updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.spotlight_packages(days,price_cents) VALUES(3,500),(7,1500),(30,4900);
CREATE TABLE public.spotlight_campaigns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),trainer_id uuid NOT NULL REFERENCES auth.users(id),target_type text NOT NULL CHECK(target_type IN ('profile','program','live')),target_id uuid NOT NULL,package_id uuid NOT NULL REFERENCES public.spotlight_packages(id),budget_cents integer NOT NULL CHECK(budget_cents BETWEEN 50 AND 1000000),tags text[] NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','cancelled')),admin_eligible boolean NOT NULL DEFAULT false,admin_note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX spotlight_owner ON public.spotlight_campaigns(trainer_id,created_at);
ALTER TABLE public.spotlight_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotlight_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spotlight_packages,public.spotlight_campaigns FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.spotlight_packages,public.spotlight_campaigns TO service_role;
GRANT SELECT ON public.spotlight_packages,public.spotlight_campaigns TO authenticated;
GRANT UPDATE ON public.spotlight_packages,public.spotlight_campaigns TO authenticated;
CREATE POLICY spotlight_prices ON public.spotlight_packages FOR SELECT TO authenticated USING(trainer_is_eligible(auth.uid(),false) OR has_role(auth.uid(),'admin'));
CREATE POLICY spotlight_packages_admin ON public.spotlight_packages FOR UPDATE TO authenticated USING(has_role(auth.uid(),'admin')) WITH CHECK(has_role(auth.uid(),'admin'));
CREATE POLICY spotlight_campaign_owner ON public.spotlight_campaigns FOR SELECT TO authenticated USING(trainer_id=auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY spotlight_campaign_admin ON public.spotlight_campaigns FOR UPDATE TO authenticated USING(has_role(auth.uid(),'admin')) WITH CHECK(has_role(auth.uid(),'admin'));
CREATE FUNCTION public.save_spotlight_draft(p_type text,p_target uuid,p_package uuid,p_budget integer,p_tags text[],p_id uuid DEFAULT NULL,p_cancel boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE result uuid;BEGIN
 IF NOT trainer_is_eligible(auth.uid(),false) OR NOT valid_discovery_tags(p_tags) OR cardinality(p_tags)>8 OR NOT p_tags <@ ARRAY['weight_loss','strength','core','flexibility','endurance','functional','running','wellness'] OR NOT EXISTS(SELECT 1 FROM spotlight_packages WHERE id=p_package) OR NOT ((p_type='profile' AND p_target=auth.uid()) OR (p_type='program' AND EXISTS(SELECT 1 FROM trainer_programs p JOIN program_editions e ON e.id=p.current_edition WHERE p.id=p_target AND p.trainer_id=auth.uid() AND p.published AND NOT p.blocked AND e.review_status='approved')) OR (p_type='live' AND EXISTS(SELECT 1 FROM live_sessions WHERE id=p_target AND trainer_id=auth.uid() AND session_type='scheduled' AND status='scheduled' AND starts_at>now() AND trainer_is_eligible(auth.uid(),true)))) THEN RAISE EXCEPTION 'Verified owner and an eligible profile, approved program or scheduled live required';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('spotlight:'||auth.uid()));
 IF p_id IS NULL THEN IF (SELECT count(*) FROM spotlight_campaigns WHERE trainer_id=auth.uid() AND status='draft')>=20 THEN RAISE EXCEPTION 'Manage your existing drafts first';END IF;INSERT INTO spotlight_campaigns(trainer_id,target_type,target_id,package_id,budget_cents,tags) VALUES(auth.uid(),p_type,p_target,p_package,p_budget,p_tags) RETURNING id INTO result;
 ELSE UPDATE spotlight_campaigns SET target_type=p_type,target_id=p_target,package_id=p_package,budget_cents=p_budget,tags=p_tags,status=CASE WHEN p_cancel THEN 'cancelled' ELSE 'draft' END,admin_eligible=false,updated_at=now() WHERE id=p_id AND trainer_id=auth.uid() AND status='draft' RETURNING id INTO result;IF NOT FOUND THEN RAISE EXCEPTION 'Editable campaign not found';END IF;END IF;RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_spotlight_draft(text,uuid,uuid,integer,text[],uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_spotlight_draft(text,uuid,uuid,integer,text[],uuid,boolean) TO authenticated;
COMMIT;
