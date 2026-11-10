-- Versioned engineering source. Staging first; no production SQL is run by the app.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.account_can_act(uuid,boolean)') IS NULL OR to_regprocedure('public.trainer_is_eligible(uuid,boolean)') IS NULL
 OR to_regclass('public.trainer_programs') IS NULL OR to_regclass('public.trainer_accounts') IS NULL
 OR NOT has_function_privilege('anon','public.has_role(uuid,public.app_role)','EXECUTE')
 THEN RAISE EXCEPTION 'Reconcile the existing launch schema first. Do not select a baseline from migration history.'; END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='program-demonstrations') OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY['program_usage','program_images','program_edition_images','program_drafts','program_editions','program_edition_videos','program_commerce','program_orders','program_enrollments','program_progress','program_disputes','program_payout_operations','program_refund_requests','program_audit'])) OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY(ARRAY['program_access','program_member','program_metrics','register_program_image','review_program_image','program_validate_demo','program_validate','save_fitness_program','submit_fitness_program','review_fitness_program','set_fitness_program_visibility','moderate_fitness_program','enroll_fitness_program','set_program_progress','grant_external_program','program_media_access','start_program_usage','report_program_usage','program_admin_report','checkpoint_program_step','approve_program_terms','begin_program_order','attach_program_checkout','sync_program_entitlement','confirm_program_order','adjust_program_payment','request_program_refund','cancel_program_order','claim_program_payout','finish_program_payout','withdraw_program_media','guard_structured_program','guard_program_media','guard_legacy_program_media'])) OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attnum>0 AND NOT a.attisdropped AND ((a.attrelid=to_regclass('public.trainer_videos') AND a.attname='access_scope') OR (a.attrelid=to_regclass('public.video_uploads') AND a.attname='access_scope') OR (a.attrelid=to_regclass('public.trainer_programs') AND a.attname=ANY(ARRAY['builder_version','summary','current_edition','blocked'])))) THEN RAISE EXCEPTION 'Program schema already exists. Inspect and reconcile; do not replay or replace existing program records.'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','storage') AND t.tgname=ANY(ARRAY['program_video_withdrawn','program_image_withdrawn','structured_program_guard','program_media_guard','legacy_program_media_guard'])) OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polname=ANY(ARRAY['program_premium_read_guard','structured_program_read_guard','structured_program_enrolled_read','program_draft_owner','program_edition_access','program_enrollment_owner','program_progress_owner','program_orders_owner','program_audit_admin','program_image_owner','program_image_upload_guard','program_image_upload','program_image_read','program_image_private_guard','program_image_immutable','program_image_delete'])) THEN RAISE EXCEPTION 'Reserved program trigger or policy already exists; inspect before reconciliation'; END IF;
END $$;
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS access_scope text NOT NULL DEFAULT 'public' CHECK(access_scope IN ('public','program'));
ALTER TABLE public.video_uploads ADD COLUMN IF NOT EXISTS access_scope text NOT NULL DEFAULT 'public' CHECK(access_scope IN ('public','program'));
ALTER TABLE public.trainer_programs ADD COLUMN IF NOT EXISTS builder_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.trainer_programs ADD COLUMN IF NOT EXISTS summary jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.trainer_programs ADD COLUMN IF NOT EXISTS current_edition uuid;
ALTER TABLE public.trainer_programs ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.program_drafts(program_id uuid PRIMARY KEY REFERENCES public.trainer_programs(id),document jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.program_editions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid NOT NULL REFERENCES public.trainer_programs(id),version integer NOT NULL,
 document jsonb NOT NULL,review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected','revoked')),review_note text NOT NULL DEFAULT '',reviewed_by uuid REFERENCES auth.users(id),reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(program_id,version));
ALTER TABLE public.trainer_programs ADD CONSTRAINT structured_program_current_edition_fk FOREIGN KEY(current_edition) REFERENCES public.program_editions(id);
CREATE TABLE IF NOT EXISTS public.program_edition_videos(edition_id uuid REFERENCES public.program_editions(id),video_id uuid REFERENCES public.trainer_videos(id),PRIMARY KEY(edition_id,video_id));
CREATE TABLE IF NOT EXISTS public.program_images(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),trainer_id uuid NOT NULL REFERENCES auth.users(id),object_path text NOT NULL UNIQUE,review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),reviewed_by uuid REFERENCES auth.users(id),reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.program_edition_images(edition_id uuid REFERENCES public.program_editions(id),image_id uuid REFERENCES public.program_images(id),PRIMARY KEY(edition_id,image_id));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('program-demonstrations','program-demonstrations',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
CREATE TABLE IF NOT EXISTS public.program_commerce(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,commission_bps integer DEFAULT 500 CHECK(commission_bps BETWEEN 0 AND 10000),terms_version text,approved_by uuid REFERENCES auth.users(id),approved_at timestamptz,
 CHECK(NOT enabled OR (commission_bps IS NOT NULL AND length(terms_version) BETWEEN 3 AND 120 AND approved_by IS NOT NULL AND approved_at IS NOT NULL)));
INSERT INTO public.program_commerce(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.program_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid NOT NULL REFERENCES public.trainer_programs(id),edition_id uuid NOT NULL REFERENCES public.program_editions(id),user_id uuid NOT NULL REFERENCES auth.users(id),trainer_id uuid NOT NULL REFERENCES auth.users(id),
 price_cents integer NOT NULL CHECK(price_cents>=50),access_days integer CHECK(access_days IN (30,90)),commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 10000),terms_version text NOT NULL,destination text NOT NULL,
 checkout_id text UNIQUE,intent_id text UNIQUE,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','refunded','cancelled')),fee_cents integer CHECK(fee_cents BETWEEN 0 AND price_cents),refunded_cents integer NOT NULL DEFAULT 0 CHECK(refunded_cents BETWEEN 0 AND price_cents),refund_pending boolean NOT NULL DEFAULT false,
 payout_dirty boolean NOT NULL DEFAULT true,paid_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '45 minutes');
CREATE UNIQUE INDEX IF NOT EXISTS program_one_checkout ON public.program_orders(user_id,program_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS public.program_enrollments(user_id uuid NOT NULL REFERENCES auth.users(id),program_id uuid NOT NULL REFERENCES public.trainer_programs(id),edition_id uuid NOT NULL REFERENCES public.program_editions(id),starts_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz,source text NOT NULL CHECK(source IN ('free','native','external_reviewed')),state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),order_id uuid UNIQUE REFERENCES public.program_orders(id),verification_reference text,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,edition_id));
CREATE TABLE IF NOT EXISTS public.program_progress(user_id uuid NOT NULL REFERENCES auth.users(id),edition_id uuid NOT NULL REFERENCES public.program_editions(id),step_id uuid NOT NULL,completed boolean NOT NULL DEFAULT false,variation_id uuid,elapsed_seconds integer NOT NULL DEFAULT 0 CHECK(elapsed_seconds BETWEEN 0 AND 18000),resumed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,edition_id,step_id));
CREATE TABLE IF NOT EXISTS public.program_disputes(id text PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.program_orders(id),status text NOT NULL CHECK(status IN ('open','won','lost')));
CREATE TABLE IF NOT EXISTS public.program_payout_operations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.program_orders(id),sequence integer NOT NULL,kind text NOT NULL CHECK(kind IN ('transfer','reversal')),amount integer NOT NULL CHECK(amount>0),transfer_id text,provider_id text UNIQUE,lease_until timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(order_id,sequence));
CREATE TABLE IF NOT EXISTS public.program_refund_requests(order_id uuid PRIMARY KEY REFERENCES public.program_orders(id),requested_by uuid REFERENCES auth.users(id),reason text NOT NULL,provider_id text,completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.program_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor uuid REFERENCES auth.users(id),program_id uuid REFERENCES public.trainer_programs(id),action text NOT NULL,detail text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.program_usage(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),edition_id uuid NOT NULL REFERENCES public.program_editions(id),step_id uuid NOT NULL,video_id uuid NOT NULL REFERENCES public.trainer_videos(id),reported_seconds integer NOT NULL DEFAULT 0 CHECK(reported_seconds BETWEEN 0 AND 18000),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX program_usage_edition ON public.program_usage(edition_id,created_at);
CREATE INDEX program_public_catalog ON public.trainer_programs(created_at DESC,id DESC) WHERE builder_version=2 AND published;
CREATE INDEX program_catalog_filters ON public.trainer_programs((summary->>'mode'),(summary->>'category')) WHERE builder_version=2 AND published;
CREATE INDEX IF NOT EXISTS program_media_membership ON public.program_edition_videos(video_id);
CREATE INDEX IF NOT EXISTS program_dispute_order ON public.program_disputes(order_id,status);
CREATE INDEX IF NOT EXISTS program_editions_program ON public.program_editions(program_id,created_at DESC);
CREATE INDEX program_orders_program ON public.program_orders(program_id,paid_at);
CREATE INDEX IF NOT EXISTS program_orders_trainer ON public.program_orders(trainer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS program_enrollment_program ON public.program_enrollments(program_id,state);
CREATE INDEX IF NOT EXISTS program_payout_dirty ON public.program_orders(created_at) WHERE payout_dirty AND paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS program_progress_resume ON public.program_progress(user_id,edition_id,resumed_at DESC);

CREATE OR REPLACE FUNCTION public.program_access(p_edition uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND (has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM program_editions e JOIN trainer_programs p ON p.id=e.program_id WHERE e.id=p_edition AND (p.trainer_id=auth.uid() OR (NOT p.blocked AND e.review_status='approved' AND account_can_act(auth.uid(),false) AND EXISTS(SELECT 1 FROM program_enrollments n WHERE n.edition_id=e.id AND n.user_id=auth.uid() AND n.state='active' AND (n.expires_at IS NULL OR n.expires_at>now()))))))
$$;
CREATE OR REPLACE FUNCTION public.program_member(p_program uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM program_enrollments WHERE program_id=p_program AND user_id=auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.program_metrics() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_object_agg(p.id,jsonb_build_object(
 'enrollments',(SELECT count(*) FROM program_enrollments n WHERE n.program_id=p.id AND n.state='active' AND (n.expires_at IS NULL OR n.expires_at>now())),
 'sales',(SELECT count(*) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'gross',(SELECT coalesce(sum(o.price_cents),0) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'refunded',(SELECT coalesce(sum(o.refunded_cents),0) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'fees',(SELECT coalesce(sum(o.fee_cents),0) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'payable',(SELECT coalesce(sum(CASE WHEN o.refund_pending OR EXISTS(SELECT 1 FROM program_disputes d WHERE d.order_id=o.id AND d.status IN ('open','lost')) THEN 0 ELSE floor(greatest(o.price_cents-o.refunded_cents-o.fee_cents,0)::bigint*(10000-o.commission_bps)::numeric/10000) END),0) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'transferred',(SELECT coalesce(sum(CASE WHEN x.kind='transfer' THEN x.amount ELSE -x.amount END),0) FROM program_payout_operations x JOIN program_orders o ON o.id=x.order_id WHERE o.program_id=p.id AND x.provider_id IS NOT NULL)
 )),'{}'::jsonb) FROM trainer_programs p WHERE p.trainer_id=auth.uid() AND p.builder_version=2
$$;
CREATE OR REPLACE FUNCTION public.register_program_image(p_path text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF NOT trainer_is_eligible(auth.uid(),false) OR split_part(p_path,'/',1)<>auth.uid()::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='program-demonstrations' AND name=p_path) THEN RAISE EXCEPTION 'Upload your own private demonstration image first'; END IF;
 INSERT INTO program_images(trainer_id,object_path) VALUES(auth.uid(),p_path) ON CONFLICT(object_path) DO UPDATE SET object_path=excluded.object_path RETURNING id INTO result;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.review_program_image(p_id uuid,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR p_status NOT IN ('approved','rejected') OR NOT EXISTS(SELECT 1 FROM program_images WHERE id=p_id AND trainer_id<>auth.uid()) THEN RAISE EXCEPTION 'Independent image review required'; END IF;
 UPDATE program_images SET review_status=p_status,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=p_id;
 INSERT INTO program_audit(actor,action,detail) VALUES(auth.uid(),'image_review',p_id||':'||p_status);
END $$;
CREATE OR REPLACE FUNCTION public.program_validate_demo(p_demo jsonb,p_trainer uuid,p_draft boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF length(trim(coalesce(p_demo->>'label',''))) NOT BETWEEN 1 AND 80 OR length(coalesce(p_demo->>'description',''))>2000 OR length(coalesce(p_demo->>'instructions',''))>2000 OR length(coalesce(p_demo->>'safety_notes',''))>2000 OR jsonb_typeof(coalesce(p_demo->'equipment','[]'))<>'array' OR jsonb_array_length(coalesce(p_demo->'equipment','[]'))>20 THEN RAISE EXCEPTION 'Invalid exercise or variation details'; END IF;
 IF p_demo ? 'video_id' AND NOT EXISTS(SELECT 1 FROM trainer_videos WHERE id=(p_demo->>'video_id')::uuid AND user_id=p_trainer AND review_status='approved' AND category !~* '(youth|nutrition|homeschool)' AND path ~* '^bunny:[0-9]+:[a-f0-9-]{36}$') THEN RAISE EXCEPTION 'Demonstrations require your approved Bunny media'; END IF;
 IF p_demo ? 'image_id' AND NOT EXISTS(SELECT 1 FROM program_images WHERE id=(p_demo->>'image_id')::uuid AND trainer_id=p_trainer AND (p_draft OR review_status='approved')) THEN RAISE EXCEPTION 'Approved private image required'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.program_validate(p_data jsonb,p_trainer uuid,p_allow_empty boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w jsonb;d jsonb;s jsonb;variation jsonb;seen uuid[]:='{}';v uuid;steps integer:=0;
BEGIN
 IF p_data IS NULL OR NOT (p_data ?& ARRAY['title','description','mode','difficulty','category','goals','equipment','price_cents','pregnancy','postpartum','weeks','access_period']) OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR length(trim(coalesce(p_data->>'title',''))) NOT BETWEEN 1 AND 160 OR length(coalesce(p_data->>'description',''))>4000
 OR coalesce(p_data->>'mode','') NOT IN ('free','native','external') OR coalesce(p_data->>'difficulty','') NOT IN ('Beginner','Intermediate','Advanced','All levels')
 OR coalesce(p_data->>'category','')='' OR p_data->>'category' ~* '(youth|nutrition|homeschool)' OR length(p_data->>'category')>80 OR jsonb_typeof(p_data->'goals') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'equipment') IS DISTINCT FROM 'array'
 OR coalesce((p_data->>'price_cents')::integer,-1) NOT BETWEEN 0 AND 1000000 OR (p_data->>'mode'='native' AND (p_data->>'price_cents')::integer<50)
 OR (p_data->>'mode'='free' AND (p_data->>'price_cents')::integer<>0)
 OR coalesce(p_data->>'access_period','') NOT IN ('30','90','lifetime')
 OR coalesce(p_data->>'pregnancy','') NOT IN ('not_assessed','trainer_labeled','not_suitable') OR coalesce(p_data->>'postpartum','') NOT IN ('not_assessed','trainer_labeled','not_suitable')
 OR (coalesce(p_data->>'cover_url','')<>'' AND p_data->>'cover_url' !~ '^https://[^/[:space:]]+/')
 OR (p_data->>'mode'='external' AND coalesce(p_data->>'external_url','') !~ '^https://[^/[:space:]]+')
 OR jsonb_typeof(p_data->'weeks') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'weeks') NOT BETWEEN 1 AND 52 OR octet_length(p_data::text)>250000
 THEN RAISE EXCEPTION 'Invalid program metadata'; END IF;
 IF jsonb_array_length(p_data->'goals')>30 OR jsonb_array_length(p_data->'equipment')>30 OR EXISTS(SELECT 1 FROM jsonb_array_elements((p_data->'goals')||(p_data->'equipment')) a WHERE jsonb_typeof(a)<>'string' OR length(a #>> '{}')>100) OR length(coalesce(p_data->>'suitability_notes',''))>2000 THEN RAISE EXCEPTION 'Invalid goals, equipment or suitability notes'; END IF;
 FOR w IN SELECT value FROM jsonb_array_elements(p_data->'weeks') LOOP
  IF coalesce(w->>'id','')::uuid=ANY(seen) THEN RAISE EXCEPTION 'Duplicate week identifier'; END IF;seen=array_append(seen,(w->>'id')::uuid);
  IF jsonb_typeof(w->'days') IS DISTINCT FROM 'array' OR jsonb_array_length(w->'days') NOT BETWEEN 1 AND 7 OR length(coalesce(w->>'title',''))>160 THEN RAISE EXCEPTION 'Each week needs 1–7 days'; END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(w->'days') LOOP
   IF coalesce(d->>'id','')::uuid=ANY(seen) THEN RAISE EXCEPTION 'Duplicate day identifier'; END IF; seen=array_append(seen,coalesce(d->>'id','')::uuid);
   IF jsonb_typeof(d->'rest') IS DISTINCT FROM 'boolean' OR jsonb_typeof(d->'workouts') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'workouts')>20 OR length(coalesce(d->>'instructions',''))>4000 OR length(coalesce(d->>'title',''))>160
    OR ((d->>'rest')::boolean AND jsonb_array_length(d->'workouts')<>0) THEN RAISE EXCEPTION 'Invalid program day'; END IF;
   FOR s IN SELECT value FROM jsonb_array_elements(d->'workouts') LOOP
    IF coalesce(s->>'id','')::uuid=ANY(seen) THEN RAISE EXCEPTION 'Duplicate workout identifier'; END IF;seen=array_append(seen,coalesce(s->>'id','')::uuid);steps=steps+1;
    v=(s->>'video_id')::uuid;
    IF (NOT p_allow_empty OR v IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM trainer_videos WHERE id=v AND user_id=p_trainer AND review_status='approved' AND category !~* '(youth|nutrition|homeschool)' AND path ~* '^bunny:[0-9]+:[a-f0-9-]{36}$') OR length(coalesce(s->>'instructions',''))>4000 THEN RAISE EXCEPTION 'Only your approved Bunny workouts may be used'; END IF;
    IF s ? 'duration_seconds' AND coalesce((s->>'duration_seconds')::integer,-1) NOT BETWEEN 0 AND 18000 THEN RAISE EXCEPTION 'Invalid step timer'; END IF;
    IF jsonb_typeof(coalesce(s->'variations','[]')) IS DISTINCT FROM 'array' OR jsonb_array_length(coalesce(s->'variations','[]'))>6 OR jsonb_typeof(coalesce(s->'exercises','[]')) IS DISTINCT FROM 'array' OR jsonb_array_length(coalesce(s->'exercises','[]'))>40 THEN RAISE EXCEPTION 'Use up to six variations and forty exercise steps'; END IF;
    FOR variation IN SELECT value FROM jsonb_path_query(s,'$.variations[*]') value UNION ALL SELECT value FROM jsonb_path_query(s,'$.exercises[*]') value UNION ALL SELECT value FROM jsonb_path_query(s,'$.exercises[*].variations[*]') value LOOP
     IF coalesce(variation->>'id','')::uuid=ANY(seen) THEN RAISE EXCEPTION 'Duplicate exercise/variation identifier'; END IF;seen=array_append(seen,(variation->>'id')::uuid);
     PERFORM program_validate_demo(variation,p_trainer,p_allow_empty);
     IF jsonb_array_length(coalesce(variation->'variations','[]'))>6 THEN RAISE EXCEPTION 'Use up to six variations per exercise'; END IF;
    END LOOP;
    IF jsonb_typeof(coalesce(s->'intervals','[]')) IS DISTINCT FROM 'array' OR jsonb_array_length(coalesce(s->'intervals','[]'))>50 THEN RAISE EXCEPTION 'Use at most fifty timed intervals'; END IF;
    FOR variation IN SELECT value FROM jsonb_array_elements(coalesce(s->'intervals','[]')) LOOP
     IF coalesce(variation->>'id','')::uuid=ANY(seen) THEN RAISE EXCEPTION 'Duplicate interval identifier'; END IF;seen=array_append(seen,(variation->>'id')::uuid);
     IF coalesce(variation->>'kind','') NOT IN ('work','rest') OR coalesce((variation->>'seconds')::integer,0) NOT BETWEEN 1 AND 3600 OR length(coalesce(variation->>'label',''))>80 THEN RAISE EXCEPTION 'Invalid work/rest interval'; END IF;
     IF variation ? 'exercise_id' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(s->'exercises','[]')) ex WHERE ex->>'id'=variation->>'exercise_id') THEN RAISE EXCEPTION 'Interval references an unknown exercise'; END IF;
    END LOOP;
    IF (SELECT coalesce(sum((part->>'seconds')::integer),0) FROM jsonb_array_elements(coalesce(s->'intervals','[]')) part)>18000 THEN RAISE EXCEPTION 'Interval plan exceeds five hours'; END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 IF steps>500 OR (NOT p_allow_empty AND steps=0) THEN RAISE EXCEPTION 'Programs need 1–500 workouts'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.save_fitness_program(p_data jsonb,p_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid:=p_id;
BEGIN
 IF auth.uid() IS NULL OR NOT trainer_is_eligible(auth.uid(),false) THEN RAISE EXCEPTION 'Current verified trainer credentials required'; END IF;
 IF result IS NOT NULL AND NOT EXISTS(SELECT 1 FROM trainer_programs WHERE id=result AND trainer_id=auth.uid() AND builder_version=2 FOR UPDATE) THEN RAISE EXCEPTION 'Not your structured program'; END IF;
 PERFORM program_validate(p_data,auth.uid(),true);
 IF result IS NULL THEN INSERT INTO trainer_programs(trainer_id,title,description,builder_version) VALUES(auth.uid(),p_data->>'title',p_data->>'description',2) RETURNING id INTO result;
 ELSIF NOT EXISTS(SELECT 1 FROM trainer_programs WHERE id=result AND trainer_id=auth.uid() AND builder_version=2 FOR UPDATE) THEN RAISE EXCEPTION 'Not your structured program'; END IF;
 INSERT INTO program_drafts(program_id,document) VALUES(result,p_data) ON CONFLICT(program_id) DO UPDATE SET document=excluded.document,updated_at=now();
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.submit_fitness_program(p_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE doc jsonb;result uuid;n integer;r record;
BEGIN
 PERFORM 1 FROM trainer_programs WHERE id=p_id AND trainer_id=auth.uid() AND builder_version=2 FOR UPDATE;
 IF NOT FOUND OR NOT trainer_is_eligible(auth.uid(),false) THEN RAISE EXCEPTION 'Verified owner required'; END IF;
 SELECT document INTO doc FROM program_drafts WHERE program_id=p_id;PERFORM program_validate(doc,auth.uid());
 FOR r IN SELECT wi,di,si,v.title,v.minutes,t.step FROM jsonb_array_elements(doc->'weeks') WITH ORDINALITY w(week,wi)
 CROSS JOIN LATERAL jsonb_array_elements(w.week->'days') WITH ORDINALITY d(day,di)
 CROSS JOIN LATERAL jsonb_array_elements(d.day->'workouts') WITH ORDINALITY t(step,si)
 JOIN trainer_videos v ON v.id=(t.step->>'video_id')::uuid LOOP
  doc=jsonb_set(doc,ARRAY['weeks',(r.wi-1)::text,'days',(r.di-1)::text,'workouts',(r.si-1)::text,'title'],to_jsonb(r.title));
  doc=jsonb_set(doc,ARRAY['weeks',(r.wi-1)::text,'days',(r.di-1)::text,'workouts',(r.si-1)::text,'duration_seconds'],CASE WHEN jsonb_array_length(coalesce(r.step->'intervals','[]'))>0 THEN (SELECT to_jsonb(sum((v->>'seconds')::integer)) FROM jsonb_array_elements(r.step->'intervals') v) ELSE coalesce(r.step->'duration_seconds',to_jsonb(r.minutes*60)) END);
 END LOOP;
 SELECT coalesce(max(version),0)+1 INTO n FROM program_editions WHERE program_id=p_id;
 INSERT INTO program_editions(program_id,version,document) VALUES(p_id,n,doc) RETURNING id INTO result;
 INSERT INTO program_edition_videos SELECT DISTINCT result,(value #>> '{}')::uuid FROM jsonb_path_query(doc,'$.weeks[*].days[*].workouts[*].video_id') value
 UNION SELECT DISTINCT result,(value #>> '{}')::uuid FROM jsonb_path_query(doc,'$.weeks[*].days[*].workouts[*].variations[*].video_id') value
 UNION SELECT DISTINCT result,(value #>> '{}')::uuid FROM jsonb_path_query(doc,'$.weeks[*].days[*].workouts[*].exercises[*].video_id') value
 UNION SELECT DISTINCT result,(value #>> '{}')::uuid FROM jsonb_path_query(doc,'$.weeks[*].days[*].workouts[*].exercises[*].variations[*].video_id') value;
 INSERT INTO program_edition_images SELECT DISTINCT result,(value #>> '{}')::uuid FROM jsonb_path_query(doc,'$.weeks[*].days[*].workouts[*].variations[*].image_id') value
 UNION SELECT DISTINCT result,(value #>> '{}')::uuid FROM jsonb_path_query(doc,'$.weeks[*].days[*].workouts[*].exercises[*].image_id') value
 UNION SELECT DISTINCT result,(value #>> '{}')::uuid FROM jsonb_path_query(doc,'$.weeks[*].days[*].workouts[*].exercises[*].variations[*].image_id') value;
 INSERT INTO program_audit(actor,program_id,action) VALUES(auth.uid(),p_id,'submitted:'||n);
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.review_fitness_program(p_edition uuid,p_status text,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e program_editions%ROWTYPE;p trainer_programs%ROWTYPE;
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR p_status NOT IN ('approved','rejected','revoked') OR length(p_note)>2000 THEN RAISE EXCEPTION 'Admin review required'; END IF;
 SELECT * INTO e FROM program_editions WHERE id=p_edition FOR UPDATE;SELECT * INTO p FROM trainer_programs WHERE id=e.program_id FOR UPDATE;
 IF p.id IS NULL OR p.trainer_id=auth.uid() THEN RAISE EXCEPTION 'Independent admin review required'; END IF;
 IF p_status='approved' THEN
  IF NOT trainer_is_eligible(p.trainer_id,false) OR EXISTS(SELECT 1 FROM program_edition_images x JOIN program_images i ON i.id=x.image_id WHERE x.edition_id=e.id AND i.review_status<>'approved') OR EXISTS(SELECT 1 FROM program_edition_videos x JOIN trainer_videos v ON v.id=x.video_id WHERE x.edition_id=e.id AND v.review_status<>'approved') THEN RAISE EXCEPTION 'Current credentials and approved videos required'; END IF;
  IF e.review_status<>'pending' THEN RAISE EXCEPTION 'Submit a new edition for review'; END IF;
 END IF;
 UPDATE program_editions SET review_status=p_status,review_note=p_note,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=e.id;
 IF p_status='approved' THEN
  UPDATE trainer_programs SET title=e.document->>'title',description=e.document->>'description',summary=(SELECT jsonb_object_agg(k,v) FROM jsonb_each(e.document) j(k,v) WHERE k=ANY(ARRAY['title','description','cover_url','category','goals','difficulty','equipment','pregnancy','postpartum','suitability_notes','price_cents','mode','external_url','access_period']))||jsonb_build_object('duration_weeks',jsonb_array_length(e.document->'weeks'),'included_schedule',(SELECT jsonb_agg(jsonb_build_object('title',w->>'title','days',(SELECT jsonb_agg(jsonb_build_object('title',d->>'title','rest',(d->>'rest')::boolean,'workouts',(SELECT coalesce(jsonb_agg(jsonb_build_object('title',s->>'title','duration_seconds',(s->>'duration_seconds')::integer,'available',true)),'[]'::jsonb) FROM jsonb_array_elements(d->'workouts') s))) FROM jsonb_array_elements(w->'days') d))) FROM jsonb_array_elements(e.document->'weeks') w)),current_edition=e.id,published=true WHERE id=p.id;
 ELSIF p.current_edition=e.id THEN UPDATE trainer_programs SET published=false WHERE id=p.id; END IF;
 INSERT INTO program_audit(actor,program_id,action,detail) VALUES(auth.uid(),p.id,'review:'||p_status,p_note);
END $$;
CREATE OR REPLACE FUNCTION public.set_fitness_program_visibility(p_id uuid,p_published boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM trainer_programs p JOIN program_editions e ON e.id=p.current_edition WHERE p.id=p_id AND p.trainer_id=auth.uid() AND (NOT p_published OR (trainer_is_eligible(auth.uid(),false) AND NOT p.blocked AND e.review_status='approved' AND NOT EXISTS(SELECT 1 FROM program_edition_videos x JOIN trainer_videos v ON v.id=x.video_id WHERE x.edition_id=e.id AND v.review_status<>'approved') AND NOT EXISTS(SELECT 1 FROM program_edition_images x JOIN program_images i ON i.id=x.image_id WHERE x.edition_id=e.id AND i.review_status<>'approved')))) THEN RAISE EXCEPTION 'Program cannot be published'; END IF;
 UPDATE trainer_programs SET published=p_published WHERE id=p_id;INSERT INTO program_audit(actor,program_id,action) VALUES(auth.uid(),p_id,CASE WHEN p_published THEN 'published' ELSE 'unpublished' END);
END $$;
CREATE OR REPLACE FUNCTION public.moderate_fitness_program(p_id uuid,p_blocked boolean,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR length(trim(p_note)) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'Admin moderation reason required'; END IF;
 UPDATE trainer_programs SET blocked=p_blocked,published=CASE WHEN p_blocked THEN false ELSE published END WHERE id=p_id AND builder_version=2;
 INSERT INTO program_audit(actor,program_id,action,detail) VALUES(auth.uid(),p_id,CASE WHEN p_blocked THEN 'blocked' ELSE 'unblocked' END,p_note);
END $$;
CREATE OR REPLACE FUNCTION public.enroll_fitness_program(p_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e program_editions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT account_can_act(auth.uid(),false) THEN RAISE EXCEPTION 'Sign in with an active account'; END IF;
 SELECT e0.* INTO e FROM trainer_programs p JOIN program_editions e0 ON e0.id=p.current_edition WHERE p.id=p_id AND p.published AND NOT p.blocked AND e0.review_status='approved' AND trainer_is_eligible(p.trainer_id,false);
 IF e.id IS NULL OR EXISTS(SELECT 1 FROM program_edition_images x JOIN program_images i ON i.id=x.image_id WHERE x.edition_id=e.id AND i.review_status<>'approved') OR EXISTS(SELECT 1 FROM program_edition_videos x JOIN trainer_videos v ON v.id=x.video_id WHERE x.edition_id=e.id AND v.review_status<>'approved') OR e.document->>'mode'<>'free' THEN RAISE EXCEPTION 'Free enrollment unavailable; purchases require verification'; END IF;
 INSERT INTO program_enrollments(user_id,program_id,edition_id,source,expires_at) VALUES(auth.uid(),p_id,e.id,'free',CASE WHEN e.document->>'access_period'='lifetime' THEN NULL ELSE now()+(e.document->>'access_period')::integer*interval '1 day' END) ON CONFLICT(user_id,edition_id) DO UPDATE SET state='active',starts_at=now(),expires_at=excluded.expires_at WHERE program_enrollments.expires_at<=now() AND program_enrollments.source='free';RETURN e.id;
END $$;
CREATE OR REPLACE FUNCTION public.set_program_progress(p_edition uuid,p_step uuid,p_completed boolean DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM program_enrollments WHERE edition_id=p_edition AND user_id=auth.uid() AND state='active' AND (expires_at IS NULL OR expires_at>now())) OR NOT program_access(p_edition)
 OR NOT EXISTS(SELECT 1 FROM program_editions e CROSS JOIN LATERAL jsonb_path_query(e.document,'$.weeks[*].days[*].workouts[*].id') s WHERE e.id=p_edition AND (s #>> '{}')::uuid=p_step) THEN RAISE EXCEPTION 'Enrollment and valid workout required'; END IF;
 INSERT INTO program_progress(user_id,edition_id,step_id,completed) VALUES(auth.uid(),p_edition,p_step,coalesce(p_completed,false)) ON CONFLICT(user_id,edition_id,step_id) DO UPDATE SET completed=coalesce(p_completed,program_progress.completed),resumed_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.grant_external_program(p_edition uuid,p_member uuid,p_reference text,p_confirmed timestamptz DEFAULT now()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p uuid;doc jsonb;
BEGIN
 IF p_confirmed IS NULL OR p_confirmed>now() THEN RAISE EXCEPTION 'Purchase confirmation cannot be in the future'; END IF;
 IF NOT has_role(auth.uid(),'admin') OR length(trim(p_reference)) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'Admin receipt review required'; END IF;
 SELECT program_id,document INTO p,doc FROM program_editions WHERE id=p_edition AND review_status='approved' AND document->>'mode'='external';IF p IS NULL THEN RAISE EXCEPTION 'External edition not available'; END IF;
 INSERT INTO program_enrollments(user_id,program_id,edition_id,source,verification_reference,starts_at,expires_at) VALUES(p_member,p,p_edition,'external_reviewed',p_reference,p_confirmed,CASE WHEN doc->>'access_period'='lifetime' THEN NULL ELSE p_confirmed+(doc->>'access_period')::integer*interval '1 day' END) ON CONFLICT(user_id,edition_id) DO UPDATE SET state='active',verification_reference=excluded.verification_reference,starts_at=excluded.starts_at,expires_at=excluded.expires_at WHERE program_enrollments.expires_at<=now() AND program_enrollments.source='external_reviewed' AND excluded.starts_at>program_enrollments.starts_at AND excluded.verification_reference<>program_enrollments.verification_reference;
 INSERT INTO program_audit(actor,program_id,action,detail) VALUES(auth.uid(),p,'external_receipt_review',p_reference||':'||p_member||':'||p_edition||':'||p_confirmed);
END $$;
CREATE OR REPLACE FUNCTION public.program_media_access(p_user uuid,p_edition uuid,p_step uuid,p_variation uuid DEFAULT NULL) RETURNS TABLE(id uuid,path text,access_scope text,ads_allowed boolean,access_expires_at timestamptz,image_path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT (has_role(p_user,'admin') OR EXISTS(SELECT 1 FROM program_editions e JOIN trainer_programs p ON p.id=e.program_id WHERE e.id=p_edition AND (p.trainer_id=p_user OR (e.review_status='approved' AND NOT p.blocked AND account_can_act(p_user,false) AND EXISTS(SELECT 1 FROM program_enrollments n WHERE n.edition_id=e.id AND n.user_id=p_user AND n.state='active' AND (n.expires_at IS NULL OR n.expires_at>now())))))) THEN RAISE EXCEPTION 'Program access denied'; END IF;
 RETURN QUERY SELECT v.id,v.path,v.access_scope,(e.document->>'mode'='free' AND v.access_scope='public'),CASE WHEN has_role(p_user,'admin') OR EXISTS(SELECT 1 FROM trainer_programs own WHERE own.id=e.program_id AND own.trainer_id=p_user) THEN NULL ELSE (SELECT n.expires_at FROM program_enrollments n WHERE n.edition_id=e.id AND n.user_id=p_user AND n.state='active' LIMIT 1) END,img.object_path FROM program_editions e CROSS JOIN LATERAL jsonb_path_query(e.document,'$.weeks[*].days[*].workouts[*]') s CROSS JOIN LATERAL (SELECT (s->>'video_id')::uuid AS vid,NULL::uuid AS img WHERE p_variation IS NULL
 UNION ALL SELECT coalesce((var->>'video_id')::uuid,(s->>'video_id')::uuid),(var->>'image_id')::uuid FROM (SELECT value AS var FROM jsonb_path_query(s,'$.variations[*]') value UNION ALL SELECT value FROM jsonb_path_query(s,'$.exercises[*]') value UNION ALL SELECT value FROM jsonb_path_query(s,'$.exercises[*].variations[*]') value) options WHERE (var->>'id')::uuid=p_variation) choice JOIN trainer_videos v ON v.id=choice.vid LEFT JOIN program_images img ON img.id=choice.img AND img.review_status='approved'
 WHERE e.id=p_edition AND coalesce(s->>'id','')::uuid=p_step AND v.review_status='approved' AND (choice.img IS NULL OR img.id IS NOT NULL);
 IF NOT FOUND THEN RAISE EXCEPTION 'Approved workout unavailable'; END IF;
END $$;

-- Sessions record client-reported active playback at meaningful checkpoints, not provider-metered bytes.
CREATE FUNCTION public.start_program_usage(p_user uuid,p_edition uuid,p_step uuid,p_variation uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v uuid;result uuid;
BEGIN
 SELECT id INTO v FROM program_media_access(p_user,p_edition,p_step,p_variation);
 INSERT INTO program_usage(user_id,edition_id,step_id,video_id) VALUES(p_user,p_edition,p_step,v) RETURNING id INTO result;RETURN result;
END $$;
CREATE FUNCTION public.report_program_usage(p_id uuid,p_seconds integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u program_usage%ROWTYPE;
BEGIN
 SELECT * INTO u FROM program_usage WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
 IF u.id IS NULL OR p_seconds NOT BETWEEN 0 AND 18000 OR p_seconds>extract(epoch FROM now()-u.created_at)+5 THEN RAISE EXCEPTION 'Invalid playback checkpoint'; END IF;
 IF NOT program_access(u.edition_id) THEN RAISE EXCEPTION 'Program access denied'; END IF;
 UPDATE program_usage SET reported_seconds=greatest(reported_seconds,p_seconds),updated_at=now() WHERE id=u.id;
END $$;
CREATE FUNCTION public.program_admin_report() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('program_id',p.id,'title',p.title,'trainer_id',p.trainer_id,
 'sales',(SELECT count(*) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'gross_cents',(SELECT coalesce(sum(price_cents),0) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'refunded_cents',(SELECT coalesce(sum(refunded_cents),0) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'processing_cents',(SELECT coalesce(sum(fee_cents),0) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'trainer_cents',(SELECT coalesce(sum(CASE WHEN o.refund_pending OR EXISTS(SELECT 1 FROM program_disputes d WHERE d.order_id=o.id AND d.status IN ('open','lost')) THEN 0 ELSE floor(greatest(price_cents-refunded_cents-fee_cents,0)::bigint*(10000-commission_bps)::numeric/10000) END),0) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'platform_cents',(SELECT coalesce(sum(CASE WHEN o.refund_pending OR EXISTS(SELECT 1 FROM program_disputes d WHERE d.order_id=o.id AND d.status IN ('open','lost')) THEN 0 ELSE greatest(price_cents-refunded_cents-fee_cents,0)-floor(greatest(price_cents-refunded_cents-fee_cents,0)::bigint*(10000-commission_bps)::numeric/10000) END),0) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL),
 'held_orders',(SELECT count(*) FROM program_orders o WHERE o.program_id=p.id AND o.paid_at IS NOT NULL AND (o.refund_pending OR EXISTS(SELECT 1 FROM program_disputes d WHERE d.order_id=o.id AND d.status IN ('open','lost')))),
 'playback_sessions',(SELECT count(*) FROM program_usage u JOIN program_editions e ON e.id=u.edition_id WHERE e.program_id=p.id),
 'reported_seconds',(SELECT coalesce(sum(u.reported_seconds),0) FROM program_usage u JOIN program_editions e ON e.id=u.edition_id WHERE e.program_id=p.id)
 ) ORDER BY p.created_at DESC),'[]'::jsonb) FROM trainer_programs p WHERE builder_version=2);
END $$;
CREATE OR REPLACE FUNCTION public.checkpoint_program_step(p_edition uuid,p_step uuid,p_elapsed integer,p_variation uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_elapsed NOT BETWEEN 0 AND 18000 THEN RAISE EXCEPTION 'Invalid elapsed timer'; END IF;
 PERFORM set_program_progress(p_edition,p_step,NULL);
 PERFORM 1 FROM program_media_access(auth.uid(),p_edition,p_step,p_variation);
 UPDATE program_progress SET elapsed_seconds=p_elapsed,variation_id=p_variation,resumed_at=now() WHERE user_id=auth.uid() AND edition_id=p_edition AND step_id=p_step;
END $$;
CREATE OR REPLACE FUNCTION public.approve_program_terms(p_owner uuid,p_enabled boolean,p_bps integer,p_terms text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT has_role(p_owner,'admin') OR p_bps NOT BETWEEN 0 AND 10000 OR length(trim(p_terms)) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Owner-approved commercial terms required'; END IF;
 UPDATE program_commerce SET enabled=p_enabled,commission_bps=p_bps,terms_version=trim(p_terms),approved_by=p_owner,approved_at=now();
 INSERT INTO program_audit(actor,action,detail) VALUES(p_owner,'commerce_terms',p_terms||':'||p_bps||':'||p_enabled);
END $$;
CREATE OR REPLACE FUNCTION public.begin_program_order(p_user uuid,p_program uuid) RETURNS SETOF public.program_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e program_editions%ROWTYPE;p trainer_programs%ROWTYPE;c program_commerce%ROWTYPE;o program_orders%ROWTYPE;a trainer_accounts%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('program-order:'||p_user||':'||p_program));
 SELECT * INTO p FROM trainer_programs WHERE id=p_program;SELECT * INTO o FROM program_orders WHERE user_id=p_user AND program_id=p.id AND status='pending' FOR UPDATE;SELECT * INTO e FROM program_editions WHERE id=coalesce(o.edition_id,p.current_edition);SELECT * INTO c FROM program_commerce WHERE singleton;
 IF EXISTS(SELECT 1 FROM program_edition_images x JOIN program_images i ON i.id=x.image_id WHERE x.edition_id=e.id AND i.review_status<>'approved') OR EXISTS(SELECT 1 FROM program_edition_videos x JOIN trainer_videos v ON v.id=x.video_id WHERE x.edition_id=e.id AND v.review_status<>'approved') OR NOT c.enabled OR c.commission_bps IS NULL OR c.approved_by IS NULL OR NOT p.published OR p.blocked OR e.review_status<>'approved' OR e.document->>'mode'<>'native' OR p.trainer_id=p_user OR NOT account_can_act(p_user,false) OR NOT trainer_is_eligible(p.trainer_id,false) THEN RAISE EXCEPTION 'Paid program checkout is disabled or unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM program_enrollments WHERE user_id=p_user AND program_id=p.id AND state='active' AND (expires_at IS NULL OR expires_at>now())) THEN RAISE EXCEPTION 'Already enrolled'; END IF;
 IF o.id IS NOT NULL THEN RETURN NEXT o;RETURN; END IF;
 SELECT * INTO a FROM trainer_accounts WHERE user_id=p.trainer_id AND payouts_enabled AND stripe_account_id IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trainer payout account not ready'; END IF;
 INSERT INTO program_orders(program_id,edition_id,user_id,trainer_id,price_cents,access_days,commission_bps,terms_version,destination) VALUES(p.id,e.id,p_user,p.trainer_id,(e.document->>'price_cents')::integer,CASE WHEN e.document->>'access_period'='lifetime' THEN NULL ELSE (e.document->>'access_period')::integer END,c.commission_bps,c.terms_version,a.stripe_account_id) RETURNING * INTO o;RETURN NEXT o;
END $$;
CREATE OR REPLACE FUNCTION public.attach_program_checkout(p_order uuid,p_checkout text,p_intent text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM program_orders WHERE id=p_order AND (checkout_id IS NULL OR checkout_id=p_checkout) AND (intent_id IS NULL OR nullif(p_intent,'') IS NULL OR intent_id=p_intent) FOR UPDATE) THEN RAISE EXCEPTION 'Checkout identity mismatch'; END IF;
 UPDATE program_orders SET checkout_id=p_checkout,intent_id=coalesce(intent_id,nullif(p_intent,'')) WHERE id=p_order;
END $$;
CREATE OR REPLACE FUNCTION public.sync_program_entitlement(p_order uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o program_orders%ROWTYPE;best uuid;chosen program_orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM program_orders WHERE id=p_order;PERFORM pg_advisory_xact_lock(hashtext('program-order:'||o.user_id||':'||o.program_id));SELECT * INTO o FROM program_orders WHERE id=p_order FOR UPDATE;IF o.paid_at IS NULL THEN RETURN; END IF;
 SELECT n.id INTO best FROM program_orders n WHERE n.user_id=o.user_id AND n.edition_id=o.edition_id AND n.paid_at IS NOT NULL AND n.refunded_cents=0 AND NOT n.refund_pending AND (n.access_days IS NULL OR n.paid_at+n.access_days*interval '1 day'>now()) AND NOT EXISTS(SELECT 1 FROM program_disputes d WHERE d.order_id=n.id AND d.status IN ('open','lost')) ORDER BY n.paid_at DESC,n.created_at DESC,(n.id=(SELECT en.order_id FROM program_enrollments en WHERE en.user_id=o.user_id AND en.edition_id=o.edition_id AND en.state='active')) DESC NULLS LAST,n.id DESC LIMIT 1;
 SELECT * INTO chosen FROM program_orders WHERE id=coalesce(best,o.id);
 INSERT INTO program_enrollments(user_id,program_id,edition_id,source,state,order_id,starts_at,expires_at) VALUES(o.user_id,o.program_id,o.edition_id,'native',CASE WHEN best IS NOT NULL THEN 'active' ELSE 'revoked' END,chosen.id,chosen.paid_at,CASE WHEN chosen.access_days IS NULL THEN NULL ELSE chosen.paid_at+chosen.access_days*interval '1 day' END)
 ON CONFLICT(user_id,edition_id) DO UPDATE SET state=excluded.state,order_id=excluded.order_id,source='native',starts_at=excluded.starts_at,expires_at=excluded.expires_at;
END $$;
CREATE OR REPLACE FUNCTION public.confirm_program_order(p_order uuid,p_checkout text,p_intent text,p_gross integer,p_fee integer,p_refunded integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o program_orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM program_orders WHERE id=p_order;PERFORM pg_advisory_xact_lock(hashtext('program-order:'||o.user_id||':'||o.program_id));SELECT * INTO o FROM program_orders WHERE id=p_order FOR UPDATE;
 IF o.id IS NULL OR p_gross<>o.price_cents OR p_fee NOT BETWEEN 0 AND p_gross OR p_refunded NOT BETWEEN 0 AND p_gross OR (o.paid_at IS NOT NULL AND o.fee_cents<>p_fee) THEN RAISE EXCEPTION 'Payment amount or processing fee mismatch'; END IF;
 PERFORM attach_program_checkout(p_order,p_checkout,p_intent);
 UPDATE program_orders SET payout_dirty=true,paid_at=coalesce(paid_at,now()),fee_cents=p_fee,refunded_cents=greatest(refunded_cents,p_refunded),status=CASE WHEN greatest(refunded_cents,p_refunded)=price_cents THEN 'refunded' ELSE 'paid' END WHERE id=p_order;
 IF EXISTS(SELECT 1 FROM program_edition_images x JOIN program_images i ON i.id=x.image_id WHERE x.edition_id=o.edition_id AND i.review_status<>'approved') OR EXISTS(SELECT 1 FROM program_edition_videos x JOIN trainer_videos v ON v.id=x.video_id WHERE x.edition_id=o.edition_id AND v.review_status<>'approved') OR NOT trainer_is_eligible(o.trainer_id,false) OR EXISTS(SELECT 1 FROM trainer_programs WHERE id=o.program_id AND blocked) OR EXISTS(SELECT 1 FROM program_editions WHERE id=o.edition_id AND review_status<>'approved') THEN
  INSERT INTO program_refund_requests(order_id,reason) VALUES(o.id,'Unfulfillable program at settlement') ON CONFLICT DO NOTHING;
  UPDATE program_orders SET payout_dirty=true,refund_pending=true WHERE id=o.id;
 END IF;
 PERFORM sync_program_entitlement(p_order);
END $$;
CREATE OR REPLACE FUNCTION public.adjust_program_payment(p_order uuid,p_checkout text,p_intent text,p_refunded integer,p_dispute text,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o program_orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM program_orders WHERE id=p_order;PERFORM pg_advisory_xact_lock(hashtext('program-order:'||o.user_id||':'||o.program_id));
 PERFORM 1 FROM program_orders WHERE id=p_order AND p_refunded BETWEEN 0 AND price_cents FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Invalid payment adjustment'; END IF;
 PERFORM attach_program_checkout(p_order,p_checkout,p_intent);
 UPDATE program_orders SET payout_dirty=true,refunded_cents=greatest(refunded_cents,p_refunded),status=CASE WHEN paid_at IS NOT NULL AND greatest(refunded_cents,p_refunded)=price_cents THEN 'refunded' ELSE status END WHERE id=p_order;
 IF nullif(p_dispute,'') IS NOT NULL THEN
  IF p_status NOT IN ('open','won','lost') OR EXISTS(SELECT 1 FROM program_disputes WHERE id=p_dispute AND order_id<>p_order) THEN RAISE EXCEPTION 'Invalid dispute'; END IF;
  INSERT INTO program_disputes(id,order_id,status) VALUES(p_dispute,p_order,p_status) ON CONFLICT(id) DO UPDATE SET status=CASE WHEN program_disputes.status IN ('won','lost') THEN program_disputes.status ELSE excluded.status END;
 END IF;
 PERFORM sync_program_entitlement(p_order);
END $$;
CREATE OR REPLACE FUNCTION public.request_program_refund(p_order uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o program_orders%ROWTYPE;
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR length(trim(p_reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Admin refund review required'; END IF;
 SELECT * INTO o FROM program_orders WHERE id=p_order;PERFORM pg_advisory_xact_lock(hashtext('program-order:'||o.user_id||':'||o.program_id));SELECT * INTO o FROM program_orders WHERE id=p_order FOR UPDATE;IF o.paid_at IS NULL THEN RAISE EXCEPTION 'Confirmed purchase required'; END IF;
 INSERT INTO program_refund_requests(order_id,requested_by,reason) VALUES(p_order,auth.uid(),p_reason) ON CONFLICT DO NOTHING;
 UPDATE program_orders SET payout_dirty=true,refund_pending=true WHERE id=p_order;PERFORM sync_program_entitlement(p_order);
 INSERT INTO program_audit(actor,program_id,action,detail) VALUES(auth.uid(),o.program_id,'refund_requested',p_order::text||':'||p_reason);
END $$;
CREATE OR REPLACE FUNCTION public.cancel_program_order(p_order uuid,p_checkout text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN UPDATE program_orders SET status='cancelled' WHERE id=p_order AND checkout_id=p_checkout AND paid_at IS NULL;END $$;
CREATE OR REPLACE FUNCTION public.claim_program_payout(p_order uuid) RETURNS SETOF public.program_payout_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o program_orders%ROWTYPE;x program_payout_operations%ROWTYPE;desired integer;actual integer;amount integer;n integer;
BEGIN
 SELECT * INTO o FROM program_orders WHERE id=p_order FOR UPDATE;IF o.paid_at IS NULL THEN RETURN; END IF;
 SELECT * INTO x FROM program_payout_operations WHERE order_id=o.id AND provider_id IS NULL;
 IF FOUND THEN
  IF x.created_at<now()-interval '23 hours' THEN RAISE EXCEPTION 'Ambiguous payout requires provider reconciliation'; END IF;
  IF x.lease_until>now() THEN RETURN; END IF;
 ELSE
  desired=floor(greatest(o.price_cents-o.refunded_cents-o.fee_cents,0)::bigint*(10000-o.commission_bps)::numeric/10000);
  IF o.refund_pending OR EXISTS(SELECT 1 FROM program_disputes WHERE order_id=o.id AND status IN ('open','lost')) THEN desired=0; END IF;
  SELECT coalesce(sum(CASE WHEN pay.kind='transfer' THEN pay.amount ELSE -pay.amount END),0) INTO actual FROM program_payout_operations pay WHERE pay.order_id=o.id AND pay.provider_id IS NOT NULL;
  IF actual=desired THEN UPDATE program_orders SET payout_dirty=false WHERE id=o.id;RETURN; END IF;SELECT coalesce(max(sequence),0)+1 INTO n FROM program_payout_operations WHERE order_id=o.id;
  IF actual<desired THEN
   INSERT INTO program_payout_operations(order_id,sequence,kind,amount) VALUES(o.id,n,'transfer',desired-actual) RETURNING * INTO x;
  ELSE
   SELECT t.* INTO x FROM program_payout_operations t WHERE t.order_id=o.id AND t.kind='transfer' AND t.provider_id IS NOT NULL AND t.amount>(SELECT coalesce(sum(r.amount),0) FROM program_payout_operations r WHERE r.order_id=o.id AND r.kind='reversal' AND r.transfer_id=t.provider_id AND r.provider_id IS NOT NULL) ORDER BY t.sequence LIMIT 1;
   amount=least(actual-desired,x.amount-(SELECT coalesce(sum(r.amount),0) FROM program_payout_operations r WHERE r.order_id=o.id AND r.kind='reversal' AND r.transfer_id=x.provider_id AND r.provider_id IS NOT NULL));
   INSERT INTO program_payout_operations(order_id,sequence,kind,amount,transfer_id) VALUES(o.id,n,'reversal',amount,x.provider_id) RETURNING * INTO x;
  END IF;
 END IF;
 UPDATE program_payout_operations SET lease_until=now()+interval '2 minutes' WHERE id=x.id RETURNING * INTO x;RETURN NEXT x;
END $$;
CREATE OR REPLACE FUNCTION public.finish_program_payout(p_operation uuid,p_provider text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE x program_payout_operations%ROWTYPE;parent uuid;
BEGIN
 SELECT order_id INTO parent FROM program_payout_operations WHERE id=p_operation;PERFORM 1 FROM program_orders WHERE id=parent FOR UPDATE;
 SELECT * INTO x FROM program_payout_operations WHERE id=p_operation FOR UPDATE;
 IF x.id IS NULL OR length(p_provider)<4 OR (x.provider_id IS NOT NULL AND x.provider_id<>p_provider) THEN RAISE EXCEPTION 'Payout confirmation mismatch'; END IF;
 UPDATE program_payout_operations SET provider_id=p_provider WHERE id=x.id;UPDATE program_orders SET payout_dirty=true WHERE id=x.order_id;
END $$;

-- Withdraw affected listings immediately when an included asset loses approval.
CREATE FUNCTION public.withdraw_program_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.review_status<>'approved' AND OLD.review_status='approved' THEN
  IF TG_TABLE_NAME='trainer_videos' THEN UPDATE trainer_programs p SET published=false WHERE p.builder_version=2 AND EXISTS(SELECT 1 FROM program_edition_videos x WHERE x.edition_id=p.current_edition AND x.video_id=NEW.id);
  ELSE UPDATE trainer_programs p SET published=false WHERE p.builder_version=2 AND EXISTS(SELECT 1 FROM program_edition_images x WHERE x.edition_id=p.current_edition AND x.image_id=NEW.id); END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER program_video_withdrawn AFTER UPDATE OF review_status ON public.trainer_videos FOR EACH ROW EXECUTE FUNCTION public.withdraw_program_media();
CREATE TRIGGER program_image_withdrawn AFTER UPDATE OF review_status ON public.program_images FOR EACH ROW EXECUTE FUNCTION public.withdraw_program_media();
-- Invoker guards distinguish trusted definer RPCs from direct client writes.
CREATE OR REPLACE FUNCTION public.guard_structured_program() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user IN ('anon','authenticated') AND TG_OP='INSERT' AND (NEW.builder_version<>1 OR NEW.summary<>'{}'::jsonb OR NEW.current_edition IS NOT NULL OR NEW.blocked) THEN RAISE EXCEPTION 'Structured fields are server-managed'; END IF;
 IF current_user IN ('anon','authenticated') AND TG_OP='UPDATE' AND (NEW.builder_version,NEW.summary,NEW.current_edition,NEW.blocked) IS DISTINCT FROM (OLD.builder_version,OLD.summary,OLD.current_edition,OLD.blocked) THEN RAISE EXCEPTION 'Structured fields are server-managed'; END IF;
 IF current_user IN ('anon','authenticated') AND ((TG_OP<>'DELETE' AND NEW.builder_version=2) OR (TG_OP<>'INSERT' AND OLD.builder_version=2)) THEN RAISE EXCEPTION 'Use the transactional program builder'; END IF;
 IF current_user='authenticated' AND TG_OP<>'DELETE' AND NOT public.trainer_is_eligible(auth.uid(),false) THEN RAISE EXCEPTION 'Verified trainer required'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS structured_program_guard ON public.trainer_programs;
CREATE TRIGGER structured_program_guard BEFORE INSERT OR UPDATE OR DELETE ON public.trainer_programs FOR EACH ROW EXECUTE FUNCTION public.guard_structured_program();
CREATE OR REPLACE FUNCTION public.guard_program_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.access_scope<>OLD.access_scope THEN RAISE EXCEPTION 'Audience is immutable; upload a new video'; END IF;
  IF current_setting('role',true)='authenticated' AND NOT has_role(auth.uid(),'admin') AND EXISTS(SELECT 1 FROM program_edition_videos x JOIN program_editions e ON e.id=x.edition_id WHERE x.video_id=OLD.id AND (e.review_status='approved' OR EXISTS(SELECT 1 FROM program_enrollments n WHERE n.edition_id=e.id))) THEN RAISE EXCEPTION 'Published program media is immutable; upload a new workout'; END IF;
 END IF;
 IF NEW.access_scope='program' AND (NEW.path !~* '^bunny:[0-9]+:[a-f0-9-]{36}$' OR NOT EXISTS(SELECT 1 FROM video_uploads WHERE guid::text=split_part(NEW.path,':',3) AND library_id=split_part(NEW.path,':',2) AND user_id=NEW.user_id AND access_scope='program')) THEN RAISE EXCEPTION 'Protected upload ownership required'; END IF;
 IF NEW.access_scope='public' AND EXISTS(SELECT 1 FROM video_uploads WHERE guid::text=split_part(NEW.path,':',3) AND library_id=split_part(NEW.path,':',2) AND access_scope='program') THEN RAISE EXCEPTION 'Protected media cannot become public'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS program_media_guard ON public.trainer_videos;
CREATE TRIGGER program_media_guard BEFORE INSERT OR UPDATE ON public.trainer_videos FOR EACH ROW EXECUTE FUNCTION public.guard_program_media();
CREATE OR REPLACE FUNCTION public.guard_legacy_program_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM trainer_videos v JOIN trainer_programs p ON p.id=NEW.program_id WHERE v.id=NEW.video_id AND p.builder_version=1 AND v.user_id=p.trainer_id AND v.access_scope='public' AND v.review_status='approved' AND trainer_is_eligible(p.trainer_id,false)) THEN RAISE EXCEPTION 'Legacy playlists accept approved public workouts only'; END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS legacy_program_media_guard ON public.trainer_program_workouts;
CREATE TRIGGER legacy_program_media_guard BEFORE INSERT OR UPDATE ON public.trainer_program_workouts FOR EACH ROW EXECUTE FUNCTION public.guard_legacy_program_media();
DROP POLICY IF EXISTS program_premium_read_guard ON public.trainer_videos;
CREATE POLICY program_premium_read_guard ON public.trainer_videos AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(access_scope='public' OR user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS structured_program_read_guard ON public.trainer_programs;
CREATE POLICY structured_program_read_guard ON public.trainer_programs AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(builder_version=1 OR trainer_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR (public.program_member(id) OR (NOT blocked AND published AND current_edition IS NOT NULL)));
DROP POLICY IF EXISTS structured_program_enrolled_read ON public.trainer_programs;
CREATE POLICY structured_program_enrolled_read ON public.trainer_programs FOR SELECT TO authenticated USING(public.program_member(id));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['program_usage','program_images','program_edition_images','program_drafts','program_editions','program_edition_videos','program_commerce','program_orders','program_enrollments','program_progress','program_disputes','program_payout_operations','program_refund_requests','program_audit'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
GRANT SELECT ON public.program_images,public.program_drafts,public.program_editions,public.program_enrollments,public.program_progress,public.program_orders,public.program_audit TO authenticated;
DROP POLICY IF EXISTS program_draft_owner ON public.program_drafts;
CREATE POLICY program_draft_owner ON public.program_drafts FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.trainer_programs WHERE id=program_id AND trainer_id=auth.uid()));
DROP POLICY IF EXISTS program_edition_access ON public.program_editions;
CREATE POLICY program_edition_access ON public.program_editions FOR SELECT TO authenticated USING(public.program_access(id));
DROP POLICY IF EXISTS program_enrollment_owner ON public.program_enrollments;
CREATE POLICY program_enrollment_owner ON public.program_enrollments FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS program_progress_owner ON public.program_progress;
CREATE POLICY program_progress_owner ON public.program_progress FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS program_orders_owner ON public.program_orders;
CREATE POLICY program_orders_owner ON public.program_orders FOR SELECT TO authenticated USING(user_id=auth.uid() OR trainer_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS program_audit_admin ON public.program_audit;
CREATE POLICY program_audit_admin ON public.program_audit FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY program_image_owner ON public.program_images FOR SELECT TO authenticated USING(trainer_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY program_image_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(bucket_id<>'program-demonstrations' OR ((storage.foldername(name))[1]=auth.uid()::text AND public.trainer_is_eligible(auth.uid(),false)));
CREATE POLICY program_image_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='program-demonstrations' AND (storage.foldername(name))[1]=auth.uid()::text AND public.trainer_is_eligible(auth.uid(),false));
CREATE POLICY program_image_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='program-demonstrations' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY program_image_private_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(bucket_id<>'program-demonstrations' OR ((storage.foldername(name))[1]=auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY program_image_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(bucket_id<>'program-demonstrations') WITH CHECK(bucket_id<>'program-demonstrations');
CREATE POLICY program_image_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(bucket_id<>'program-demonstrations' OR ((storage.foldername(name))[1]=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.program_images WHERE object_path=storage.objects.name)));
REVOKE ALL ON FUNCTION public.withdraw_program_media(),public.guard_structured_program(),public.guard_program_media(),public.guard_legacy_program_media() FROM PUBLIC,anon,authenticated;
-- Revoke by explicit signature list; never change unrelated application grants.
REVOKE ALL ON FUNCTION public.start_program_usage(uuid,uuid,uuid,uuid),public.report_program_usage(uuid,integer),public.program_admin_report(),public.register_program_image(text),public.review_program_image(uuid,text),public.program_validate_demo(jsonb,uuid,boolean),public.program_metrics(),public.checkpoint_program_step(uuid,uuid,integer,uuid),public.program_member(uuid),public.moderate_fitness_program(uuid,boolean,text),public.program_access(uuid),public.program_validate(jsonb,uuid,boolean),public.save_fitness_program(jsonb,uuid),public.submit_fitness_program(uuid),public.review_fitness_program(uuid,text,text),public.set_fitness_program_visibility(uuid,boolean),public.enroll_fitness_program(uuid),public.set_program_progress(uuid,uuid,boolean),public.grant_external_program(uuid,uuid,text,timestamp with time zone),public.program_media_access(uuid,uuid,uuid,uuid),public.approve_program_terms(uuid,boolean,integer,text),public.begin_program_order(uuid,uuid),public.attach_program_checkout(uuid,text,text),public.sync_program_entitlement(uuid),public.confirm_program_order(uuid,text,text,integer,integer,integer),public.adjust_program_payment(uuid,text,text,integer,text,text),public.request_program_refund(uuid,text),public.cancel_program_order(uuid,text),public.claim_program_payout(uuid),public.finish_program_payout(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_program_usage(uuid,integer),public.program_admin_report(),public.register_program_image(text),public.review_program_image(uuid,text),public.program_metrics(),public.checkpoint_program_step(uuid,uuid,integer,uuid),public.moderate_fitness_program(uuid,boolean,text),public.program_access(uuid),public.save_fitness_program(jsonb,uuid),public.submit_fitness_program(uuid),public.review_fitness_program(uuid,text,text),public.set_fitness_program_visibility(uuid,boolean),public.enroll_fitness_program(uuid),public.set_program_progress(uuid,uuid,boolean),public.grant_external_program(uuid,uuid,text,timestamp with time zone),public.request_program_refund(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_program_usage(uuid,uuid,uuid,uuid),public.program_media_access(uuid,uuid,uuid,uuid),public.approve_program_terms(uuid,boolean,integer,text),public.begin_program_order(uuid,uuid),public.attach_program_checkout(uuid,text,text),public.confirm_program_order(uuid,text,text,integer,integer,integer),public.adjust_program_payment(uuid,text,text,integer,text,text),public.cancel_program_order(uuid,text),public.claim_program_payout(uuid),public.finish_program_payout(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.program_member(uuid) TO anon,authenticated;
COMMIT;
