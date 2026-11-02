BEGIN;
DO $$ BEGIN IF to_regclass('public.creator_video_access') IS NULL THEN RAISE EXCEPTION 'Apply creator content first'; END IF;IF to_regclass('public.program_assets') IS NOT NULL THEN RAISE EXCEPTION 'Digital asset module exists; inspect before replay'; END IF;END $$;
ALTER TABLE public.trainer_videos ADD COLUMN discovery_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.live_sessions ADD COLUMN discovery_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.live_sessions ADD COLUMN equipment_notes text NOT NULL DEFAULT '' CHECK(length(equipment_notes)<=1000);
ALTER TABLE public.live_sessions ADD COLUMN modification_notes text NOT NULL DEFAULT '' CHECK(length(modification_notes)<=2000);
ALTER TABLE public.profiles ADD COLUMN focus_tags text[] NOT NULL DEFAULT '{}';
CREATE TABLE public.discovery_categories(id text PRIMARY KEY,group_name text NOT NULL CHECK(group_name IN ('goal','life_stage','accessibility')),label text NOT NULL UNIQUE);
INSERT INTO public.discovery_categories VALUES
('weight_loss','goal','Weight loss'),('strength','goal','Strength training'),('core','goal','Core strength'),('flexibility','goal','Flexibility'),('endurance','goal','Endurance'),('functional','goal','Functional fitness'),('running','goal','Marathon / running preparation'),('wellness','goal','General wellness'),
('prenatal','life_stage','Pregnancy / Prenatal'),('postpartum','life_stage','Postpartum recovery'),('pelvic_floor','life_stage','Pelvic floor-focused exercise'),('menopause','life_stage','Menopause'),('senior','life_stage','Senior fitness'),('returning','life_stage','Returning after inactivity'),
('low_impact','accessibility','Low-impact'),('joint_friendly','accessibility','Joint-friendly'),('arthritis_friendly','accessibility','Arthritis-friendly'),('limited_mobility','accessibility','Limited mobility'),('seated','accessibility','Seated / chair workouts'),('balance','accessibility','Balance and stability'),('back_friendly','accessibility','Back-friendly modifications'),('rehabilitation','accessibility','Rehabilitation-oriented exercise'),('beginner','accessibility','Beginner-friendly'),('adaptive','accessibility','Adaptive fitness');
ALTER TABLE public.discovery_categories ENABLE ROW LEVEL SECURITY;REVOKE ALL ON public.discovery_categories FROM PUBLIC,anon,authenticated;GRANT SELECT ON public.discovery_categories TO anon,authenticated;GRANT ALL ON public.discovery_categories TO service_role;CREATE POLICY discovery_read ON public.discovery_categories FOR SELECT TO anon,authenticated USING(true);
CREATE FUNCTION public.valid_discovery_tags(p_tags text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT p_tags IS NOT NULL AND cardinality(p_tags)<=24 AND NOT EXISTS(SELECT 1 FROM unnest(p_tags) t WHERE NOT EXISTS(SELECT 1 FROM discovery_categories WHERE id=t)) $$;
CREATE FUNCTION public.guard_discovery_tags() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tags text[];
BEGIN IF TG_TABLE_NAME='profiles' THEN tags=NEW.focus_tags;ELSE tags=NEW.discovery_tags;END IF;IF NOT valid_discovery_tags(tags) THEN RAISE EXCEPTION 'Unknown discovery category';END IF;RETURN NEW;END $$;
CREATE TRIGGER discovery_profile_tags BEFORE INSERT OR UPDATE OF focus_tags ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_discovery_tags();
CREATE TRIGGER discovery_workout_tags BEFORE INSERT OR UPDATE OF discovery_tags ON public.trainer_videos FOR EACH ROW EXECUTE FUNCTION public.guard_discovery_tags();
CREATE TRIGGER discovery_live_tags BEFORE INSERT OR UPDATE OF discovery_tags ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_discovery_tags();
-- A focus label is never proof of a clinical license. Match each protected title to its own evidence.
CREATE FUNCTION public.assert_fitness_claims(p_user uuid,p_claims text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE title_pattern text; credential_pattern text;claims text;
BEGIN
 IF p_claims ~* '(^|[^a-z])(I|we) (diagnose|treat|cure)[[:space:]]|(^|[^a-z])(this|workout|program|exercise|course) (diagnoses|treats|cures)[[:space:]]' THEN RAISE EXCEPTION 'Fitness listings cannot claim to diagnose, treat or cure medical conditions'; END IF;
 claims=regexp_replace(p_claims,'(not (a |an )?|(consult|ask|contact|see|speak with|talk to) (your |a |an )?)(physical therapist|physiotherapist|medical doctor|physician|registered dietitian|licensed clinical)','', 'gi');
 FOR title_pattern,credential_pattern IN SELECT * FROM (VALUES
 ('physical therapist|physiotherapist','physical therap|physiotherap'),
 ('medical doctor|physician','medical licen|physician'),
 ('registered dietitian','registered dietitian'),
 ('licensed clinical','clinical licen|clinical psych')) t(a,b) LOOP
  IF claims ~* title_pattern AND NOT EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user AND status='verified' AND verified_by<>user_id AND verified_at IS NOT NULL AND document_path IS NOT NULL AND document_path<>'' AND valid_iso_date(expires) AND expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AND name ~* credential_pattern) THEN RAISE EXCEPTION 'This protected professional title requires matching independently verified current professional evidence'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION public.guard_professional_claims() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF TG_OP='INSERT' OR NEW.extra->'trainer' IS DISTINCT FROM OLD.extra->'trainer' THEN PERFORM assert_fitness_claims(NEW.id,coalesce(NEW.extra->'trainer'->>'bio','')||' '||coalesce((NEW.extra->'trainer'->'specialties')::text,'')); END IF;RETURN NEW;END $$;
CREATE TRIGGER professional_profile_claims BEFORE INSERT OR UPDATE OF extra ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_professional_claims();
GRANT UPDATE(focus_tags) ON public.profiles TO authenticated;
CREATE INDEX discovery_workouts ON public.trainer_videos USING gin(discovery_tags);
CREATE INDEX discovery_lives ON public.live_sessions USING gin(discovery_tags);
CREATE INDEX discovery_trainers ON public.profiles USING gin(focus_tags);
-- Expand the allowlisted public catalog with the newly added non-sensitive workout tags.
CREATE OR REPLACE VIEW public.public_workout_catalog WITH (security_barrier=true) AS SELECT v.id,v.user_id,v.title,v.category,v.level,v.path,v.created_at,v.minutes,v.equipment,v.pregnancy_safe,v.playlist,v.breaks,v.break_seconds,v.required_equipment,v.optional_equipment,v.description,v.spotify_url,v.review_status,v.access_scope,v.discovery_tags FROM public.trainer_videos v WHERE v.review_status='approved' AND (v.access_scope='public' OR public.creator_video_public(v.id));
CREATE TABLE public.program_assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),trainer_id uuid NOT NULL REFERENCES auth.users(id),path text NOT NULL UNIQUE,title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),reviewed_by uuid REFERENCES auth.users(id),reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.program_edition_assets(edition_id uuid REFERENCES public.program_editions(id),asset_id uuid REFERENCES public.program_assets(id),PRIMARY KEY(edition_id,asset_id));
CREATE TABLE public.program_download_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),asset_id uuid NOT NULL REFERENCES public.program_assets(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX program_download_limits ON public.program_download_events(user_id,created_at);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('program-downloads','program-downloads',false,10485760,ARRAY['application/pdf']);
CREATE FUNCTION public.register_program_asset(p_path text,p_title text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN IF NOT trainer_is_eligible(auth.uid(),false) OR split_part(p_path,'/',1)<>auth.uid()::text OR length(trim(p_title)) NOT BETWEEN 1 AND 160 OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='program-downloads' AND name=p_path) THEN RAISE EXCEPTION 'Upload a private PDF into your own folder first'; END IF;INSERT INTO program_assets(trainer_id,path,title) VALUES(auth.uid(),p_path,trim(p_title)) RETURNING id INTO result;RETURN result;END $$;
CREATE FUNCTION public.review_program_asset(p_id uuid,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NOT has_role(auth.uid(),'admin') OR p_status NOT IN ('approved','rejected') OR NOT EXISTS(SELECT 1 FROM program_assets WHERE id=p_id AND trainer_id<>auth.uid()) THEN RAISE EXCEPTION 'Independent asset review required'; END IF;UPDATE program_assets SET review_status=p_status,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=p_id;INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'program_asset',p_id::text,'review:'||p_status);END $$;
ALTER FUNCTION public.program_validate(jsonb,uuid,boolean) RENAME TO program_validate_v58;
CREATE FUNCTION public.program_validate(p_data jsonb,p_trainer uuid,p_allow_empty boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE kind text:=coalesce(p_data->>'product_type','workout_program');a jsonb;
BEGIN
 IF coalesce(p_data->>'intensity','') NOT IN ('','gentle','moderate','challenging') OR kind NOT IN ('workout_program','video_course','challenge','download') OR NOT valid_discovery_tags(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_data->'discovery_tags','[]')))) OR jsonb_typeof(coalesce(p_data->'downloads','[]'))<>'array' OR jsonb_array_length(coalesce(p_data->'downloads','[]'))>20 THEN RAISE EXCEPTION 'Invalid product type, categories or downloads';END IF;
 PERFORM assert_fitness_claims(p_trainer,coalesce(p_data->>'title','')||' '||coalesce(p_data->>'description',''));
 PERFORM program_validate_v58(p_data,p_trainer,p_allow_empty OR kind='download');
 FOR a IN SELECT value FROM jsonb_array_elements(coalesce(p_data->'downloads','[]')) LOOP IF NOT EXISTS(SELECT 1 FROM program_assets WHERE id=(a #>> '{}')::uuid AND trainer_id=p_trainer AND (p_allow_empty OR review_status='approved')) THEN RAISE EXCEPTION 'Use your independently approved private files'; END IF;END LOOP;
 IF NOT p_allow_empty AND kind='download' AND jsonb_array_length(coalesce(p_data->'downloads','[]'))=0 THEN RAISE EXCEPTION 'A downloadable product needs approved content';END IF;
 IF NOT p_allow_empty AND EXISTS(SELECT 1 FROM jsonb_path_query(p_data,'$.weeks[*].days[*].workouts[*]') s WHERE s->>'video_id' IS NULL) THEN RAISE EXCEPTION 'Included video workouts must be complete'; END IF;
END $$;
CREATE FUNCTION public.link_program_assets() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN INSERT INTO program_edition_assets SELECT NEW.id,(value #>> '{}')::uuid FROM jsonb_array_elements(coalesce(NEW.document->'downloads','[]')) ON CONFLICT DO NOTHING;RETURN NEW;END $$;
CREATE TRIGGER link_edition_assets AFTER INSERT ON public.program_editions FOR EACH ROW EXECUTE FUNCTION public.link_program_assets();
CREATE FUNCTION public.guard_program_assets() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NEW.published AND EXISTS(SELECT 1 FROM program_edition_assets x JOIN program_assets a ON a.id=x.asset_id WHERE x.edition_id=NEW.current_edition AND a.review_status<>'approved') THEN RAISE EXCEPTION 'Program contains an unapproved file';END IF;IF NEW.current_edition IS NOT NULL THEN NEW.summary=NEW.summary||coalesce((SELECT jsonb_build_object('intensity',coalesce(document->>'intensity',''),'product_type',coalesce(document->>'product_type','workout_program'),'discovery_tags',coalesce(document->'discovery_tags','[]')) FROM program_editions WHERE id=NEW.current_edition),'{}');END IF;RETURN NEW;END $$;
CREATE TRIGGER program_asset_publication BEFORE INSERT OR UPDATE ON public.trainer_programs FOR EACH ROW EXECUTE FUNCTION public.guard_program_assets();
CREATE OR REPLACE FUNCTION public.guard_new_program_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL AND (NOT creator_can_sell(NEW.trainer_id) OR EXISTS(SELECT 1 FROM program_edition_assets x JOIN program_assets a ON a.id=x.asset_id WHERE x.edition_id=NEW.edition_id AND a.review_status<>'approved')) THEN NEW.refund_pending=true;INSERT INTO program_refund_requests(order_id,reason) VALUES(NEW.id,'Paid delivery is unfulfillable at settlement') ON CONFLICT DO NOTHING;END IF;RETURN NEW;END $$;
CREATE FUNCTION public.program_asset_access(p_user uuid,p_edition uuid,p_asset uuid) RETURNS TABLE(path text,deadline timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e program_editions%ROWTYPE;p trainer_programs%ROWTYPE;
BEGIN
 SELECT * INTO e FROM program_editions WHERE id=p_edition;SELECT * INTO p FROM trainer_programs WHERE id=e.program_id;
 IF NOT EXISTS(SELECT 1 FROM program_edition_assets x JOIN program_assets a ON a.id=x.asset_id WHERE x.edition_id=p_edition AND a.id=p_asset AND a.review_status='approved') OR NOT (has_role(p_user,'admin') OR p.trainer_id=p_user OR (NOT p.blocked AND e.review_status='approved' AND account_can_act(p_user,false) AND EXISTS(SELECT 1 FROM program_enrollments WHERE user_id=p_user AND edition_id=p_edition AND state='active' AND (expires_at IS NULL OR expires_at>now())))) THEN RAISE EXCEPTION 'Purchased file access denied';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('download:'||p_user));IF (SELECT count(*) FROM program_download_events WHERE user_id=p_user AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'Download limit reached';END IF;
 INSERT INTO program_download_events(user_id,asset_id) VALUES(p_user,p_asset);
 RETURN QUERY SELECT a.path,CASE WHEN p.trainer_id=p_user OR has_role(p_user,'admin') THEN NULL ELSE (SELECT expires_at FROM program_enrollments WHERE user_id=p_user AND edition_id=p_edition) END FROM program_assets a WHERE a.id=p_asset;
END $$;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['program_assets','program_edition_assets','program_download_events'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;END $$;
GRANT SELECT ON public.program_assets TO authenticated;CREATE POLICY program_asset_owner ON public.program_assets FOR SELECT TO authenticated USING(trainer_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY program_pdf_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='program-downloads' AND (storage.foldername(name))[1]=auth.uid()::text AND public.trainer_is_eligible(auth.uid(),false));
CREATE POLICY program_pdf_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='program-downloads' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY program_pdf_private ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(bucket_id<>'program-downloads' OR ((storage.foldername(name))[1]=auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY program_pdf_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(bucket_id<>'program-downloads' OR ((storage.foldername(name))[1]=auth.uid()::text AND public.trainer_is_eligible(auth.uid(),false)));
CREATE POLICY program_pdf_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(bucket_id<>'program-downloads') WITH CHECK(bucket_id<>'program-downloads');
CREATE POLICY program_pdf_retain ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(bucket_id<>'program-downloads');
REVOKE ALL ON FUNCTION public.valid_discovery_tags(text[]),public.guard_discovery_tags(),public.guard_professional_claims(),public.register_program_asset(text,text),public.review_program_asset(uuid,text),public.program_validate(jsonb,uuid,boolean),public.link_program_assets(),public.guard_program_assets(),public.program_asset_access(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_program_asset(text,text),public.review_program_asset(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.program_asset_access(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.discovery_focus(p_tags text[],p_text text) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT ARRAY(SELECT DISTINCT id FROM (SELECT unnest(coalesce(p_tags,'{}')) id UNION ALL SELECT id FROM (VALUES
 ('weight_loss','weight loss|fat loss|lose weight'),('strength','strength|resistance|muscle'),('core','core|abdom|diastasis'),('flexibility','flexibility|stretch|mobility'),('endurance','endurance|cardio|stamina'),('functional','functional'),('running','running|marathon|run preparation|run a (5k|10k|half)'),('wellness','wellness|general fitness|build a habit|stress relief|increase energy'),('prenatal','prenatal|pregnancy'),('postpartum','postpartum|postnatal'),('pelvic_floor','pelvic.floor'),('menopause','menopaus'),('senior','senior|older adult'),('returning','returning|inactivity|decondition'),('low_impact','low.impact'),('joint_friendly','joint.friendly'),('arthritis_friendly','arthritis.friendly'),('limited_mobility','limited.mobility'),('seated','seated|chair workout'),('balance','balance|stability'),('back_friendly','back.friendly|back care'),('rehabilitation','rehabilitation.oriented|rehab.focus'),('beginner','beginner'),('adaptive','adaptive')) t(id,pattern) WHERE lower(translate(coalesce(p_text,''),'_-','  ')) ~ pattern) mapped ORDER BY id)
$$;
CREATE OR REPLACE VIEW public.public_workout_catalog WITH (security_barrier=true) AS SELECT v.id,v.user_id,v.title,v.category,v.level,v.path,v.created_at,v.minutes,v.equipment,v.pregnancy_safe,v.playlist,v.breaks,v.break_seconds,v.required_equipment,v.optional_equipment,v.description,v.spotify_url,v.review_status,v.access_scope,v.discovery_tags,public.discovery_focus(v.discovery_tags,v.category||' '||v.level||' '||coalesce(split_part(v.equipment,'|',2),'')||' '||coalesce(split_part(v.equipment,'|',3),'')||CASE WHEN v.pregnancy_safe THEN ' prenatal' ELSE '' END) AS discovery_focus_tags FROM public.trainer_videos v WHERE v.review_status='approved' AND (v.access_scope='public' OR public.creator_video_public(v.id)) AND v.category !~* 'youth|homeschool|nutrition';
CREATE VIEW public.discoverable_programs WITH (security_barrier=true) AS SELECT p.*,public.discovery_focus(ARRAY(SELECT jsonb_array_elements_text(coalesce(p.summary->'discovery_tags','[]'))),coalesce(p.summary->>'category','')||' '||coalesce(p.summary->>'difficulty','')||' '||coalesce(p.summary->'goals','[]')::text) AS discovery_focus_tags FROM public.trainer_programs p WHERE p.builder_version=2 AND p.published AND NOT p.blocked AND EXISTS(SELECT 1 FROM public.program_editions e WHERE e.id=p.current_edition AND e.review_status='approved') AND coalesce(p.summary->>'category','') !~* 'youth|homeschool|nutrition';
CREATE VIEW public.discoverable_lives WITH (security_barrier=true) AS SELECT l.*,public.discovery_focus(l.discovery_tags,l.category||' '||l.level) AS discovery_focus_tags FROM public.live_sessions l WHERE l.status IN ('scheduled','live') AND public.trainer_is_eligible(l.trainer_id,true) AND l.category !~* 'youth|homeschool|nutrition';
REVOKE ALL ON public.discoverable_programs,public.discoverable_lives FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.discoverable_programs,public.discoverable_lives TO anon,authenticated,service_role;
CREATE FUNCTION public.withdraw_program_asset() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NEW.review_status<>'approved' AND OLD.review_status='approved' THEN UPDATE trainer_programs SET published=false WHERE current_edition IN(SELECT edition_id FROM program_edition_assets WHERE asset_id=NEW.id);END IF;RETURN NEW;END $$;
CREATE TRIGGER withdraw_program_asset AFTER UPDATE OF review_status ON public.program_assets FOR EACH ROW EXECUTE FUNCTION public.withdraw_program_asset();
CREATE FUNCTION public.guard_content_claims() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF TG_TABLE_NAME='trainer_videos' THEN PERFORM assert_fitness_claims(NEW.user_id,NEW.title||' '||coalesce(NEW.description,''));ELSE PERFORM assert_fitness_claims(NEW.trainer_id,NEW.title||' '||coalesce(NEW.description,''));END IF;RETURN NEW;END $$;
CREATE TRIGGER discovery_video_claims BEFORE INSERT OR UPDATE OF title,description ON public.trainer_videos FOR EACH ROW EXECUTE FUNCTION public.guard_content_claims();
CREATE TRIGGER discovery_live_claims BEFORE INSERT OR UPDATE OF title,description ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_content_claims();
REVOKE ALL ON FUNCTION public.assert_fitness_claims(uuid,text),public.withdraw_program_asset(),public.guard_content_claims() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_focus(text[],text) TO anon,authenticated,service_role;
COMMIT;
