-- Additive everyday discovery and private subjective workout feedback. Apply only after 0062 on staging.
BEGIN;
DO $$ BEGIN IF to_regclass('public.discovery_categories') IS NULL THEN RAISE EXCEPTION 'Apply 0062 first'; END IF;IF to_regclass('public.workout_feedback') IS NOT NULL THEN RAISE EXCEPTION 'Feedback module exists; inspect before replay';END IF;END $$;
ALTER TABLE public.trainer_videos ADD COLUMN intensity text NOT NULL DEFAULT '' CHECK(intensity IN ('','gentle','moderate','challenging'));
ALTER TABLE public.trainer_videos ADD COLUMN modification_notes text NOT NULL DEFAULT '' CHECK(length(modification_notes)<=2000);
ALTER TABLE public.live_sessions ADD COLUMN intensity text NOT NULL DEFAULT '' CHECK(intensity IN ('','gentle','moderate','challenging'));
-- PostgreSQL requires existing view columns to retain their original order when adding columns.
DO $$ DECLARE columns text; BEGIN
 SELECT string_agg(CASE WHEN attname='discovery_focus_tags' THEN 'public.discovery_focus(v.discovery_tags,v.category||'' ''||v.level||'' ''||coalesce(split_part(v.equipment,''|'',2),'''')||'' ''||coalesce(split_part(v.equipment,''|'',3),'''')||CASE WHEN v.pregnancy_safe THEN '' prenatal'' ELSE '''' END) AS discovery_focus_tags' ELSE format('v.%I',attname) END,',' ORDER BY attnum) INTO columns FROM pg_attribute WHERE attrelid='public.public_workout_catalog'::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE 'CREATE OR REPLACE VIEW public.public_workout_catalog WITH (security_barrier=true) AS SELECT '||columns||',v.intensity,v.modification_notes FROM public.trainer_videos v WHERE v.review_status=''approved'' AND (v.access_scope=''public'' OR public.creator_video_public(v.id)) AND v.category !~* ''youth|homeschool|nutrition''';
 SELECT string_agg(CASE WHEN attname='discovery_focus_tags' THEN 'public.discovery_focus(l.discovery_tags,l.category||'' ''||l.level) AS discovery_focus_tags' ELSE format('l.%I',attname) END,',' ORDER BY attnum) INTO columns FROM pg_attribute WHERE attrelid='public.discoverable_lives'::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE 'CREATE OR REPLACE VIEW public.discoverable_lives WITH (security_barrier=true) AS SELECT '||columns||',l.intensity FROM public.live_sessions l WHERE l.status IN (''scheduled'',''live'') AND public.trainer_is_eligible(l.trainer_id,true) AND l.category !~* ''youth|homeschool|nutrition''';
END $$;
GRANT SELECT ON public.public_workout_catalog TO anon,authenticated,service_role;
CREATE TABLE public.workout_feedback_config(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),min_members integer NOT NULL DEFAULT 10 CHECK(min_members BETWEEN 10 AND 100000),agreement_bps integer NOT NULL DEFAULT 7000 CHECK(agreement_bps BETWEEN 7000 AND 10000));
INSERT INTO public.workout_feedback_config(singleton) VALUES(true);
CREATE TABLE public.workout_feedback(video_id uuid NOT NULL REFERENCES public.trainer_videos(id),user_id uuid NOT NULL REFERENCES auth.users(id),tags text[] NOT NULL CHECK(cardinality(tags) BETWEEN 1 AND 8),excluded boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(video_id,user_id));
CREATE INDEX workout_feedback_member ON public.workout_feedback(user_id,updated_at);
CREATE TABLE public.workout_feedback_blocks(video_id uuid REFERENCES public.trainer_videos(id),user_id uuid REFERENCES auth.users(id),PRIMARY KEY(video_id,user_id));
CREATE TABLE public.workout_feedback_totals(video_id uuid PRIMARY KEY REFERENCES public.trainer_videos(id),respondents integer NOT NULL DEFAULT 0 CHECK(respondents>=0),counts jsonb NOT NULL DEFAULT '{}');
CREATE FUNCTION public.feedback_can_access(p_user uuid,p_video uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM trainer_videos v WHERE v.id=p_video AND v.review_status='approved' AND v.category !~* 'youth|homeschool|nutrition' AND (v.access_scope='public' OR creator_video_public(v.id) OR EXISTS(SELECT 1 FROM creator_video_access a WHERE a.video_id=v.id AND creator_has_access(p_user,a.trainer_id)) OR EXISTS(SELECT 1 FROM program_edition_videos x JOIN program_editions e ON e.id=x.edition_id JOIN trainer_programs p ON p.id=e.program_id JOIN program_enrollments n ON n.edition_id=e.id WHERE x.video_id=v.id AND n.user_id=p_user AND n.state='active' AND (n.expires_at IS NULL OR n.expires_at>now()) AND e.review_status='approved' AND NOT p.blocked AND account_can_act(p_user,false))))
$$;
-- Counters update transactionally with every insert/update/delete; browsing never scans individual votes.
CREATE FUNCTION public.update_feedback_totals() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE vid uuid:=CASE WHEN TG_OP='DELETE' THEN OLD.video_id ELSE NEW.video_id END;tag text;
BEGIN
 INSERT INTO workout_feedback_totals(video_id) VALUES(vid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM workout_feedback_totals WHERE video_id=vid FOR UPDATE;
 IF TG_OP<>'INSERT' AND NOT OLD.excluded THEN
  UPDATE workout_feedback_totals SET respondents=respondents-1 WHERE video_id=vid;
  FOREACH tag IN ARRAY OLD.tags LOOP UPDATE workout_feedback_totals SET counts=jsonb_set(counts,ARRAY[tag],to_jsonb(coalesce((counts->>tag)::integer,0)-1)) WHERE video_id=vid;END LOOP;
 END IF;
 IF TG_OP<>'DELETE' AND NOT NEW.excluded THEN
  UPDATE workout_feedback_totals SET respondents=respondents+1 WHERE video_id=vid;
  FOREACH tag IN ARRAY NEW.tags LOOP UPDATE workout_feedback_totals SET counts=jsonb_set(counts,ARRAY[tag],to_jsonb(coalesce((counts->>tag)::integer,0)+1)) WHERE video_id=vid;END LOOP;
 END IF;RETURN NULL;
END $$;
CREATE TRIGGER feedback_totals AFTER INSERT OR UPDATE OR DELETE ON public.workout_feedback FOR EACH ROW EXECUTE FUNCTION public.update_feedback_totals();
CREATE FUNCTION public.save_workout_feedback(p_video uuid,p_tags text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT account_can_act(auth.uid(),false) OR NOT feedback_can_access(auth.uid(),p_video) OR EXISTS(SELECT 1 FROM trainer_videos WHERE id=p_video AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Feedback requires authenticated access to an approved workout from another creator';END IF;
 IF p_tags IS NULL OR cardinality(p_tags)>8 OR EXISTS(SELECT 1 FROM unnest(p_tags) t WHERE t IS NULL OR t NOT IN ('challenging','fun','sweaty','relaxing','beginner_friendly','great_instructions','low_impact_feeling','would_repeat')) OR (SELECT count(DISTINCT t) FROM unnest(p_tags) t)<>cardinality(p_tags) THEN RAISE EXCEPTION 'Choose distinct supported subjective feedback tags';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('feedback-member:'||auth.uid()));
 IF cardinality(p_tags)=0 THEN DELETE FROM workout_feedback WHERE video_id=p_video AND user_id=auth.uid();RETURN;END IF;
 IF EXISTS(SELECT 1 FROM workout_feedback_blocks WHERE video_id=p_video AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Feedback is under moderation review'; END IF;
 IF NOT EXISTS(SELECT 1 FROM workout_feedback WHERE video_id=p_video AND user_id=auth.uid()) AND (SELECT count(*) FROM workout_feedback WHERE user_id=auth.uid() AND created_at>now()-interval '1 day')>=30 THEN RAISE EXCEPTION 'Feedback daily limit reached';END IF;
 INSERT INTO workout_feedback(video_id,user_id,tags) VALUES(p_video,auth.uid(),p_tags) ON CONFLICT(video_id,user_id) DO UPDATE SET tags=excluded.tags,updated_at=now();
END $$;
-- Removal remains possible even after a purchase expires or a workout is withdrawn.
CREATE FUNCTION public.remove_workout_feedback(p_video uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN DELETE FROM workout_feedback WHERE user_id=auth.uid() AND video_id=p_video;END $$;
CREATE FUNCTION public.workout_community_tags(p_ids uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_object_agg(video_id,jsonb_build_object('tags',tags,'respondents',respondents)),'{}') FROM (
 SELECT s.video_id,s.respondents,ARRAY(SELECT key FROM jsonb_each_text(s.counts) WHERE value::integer::bigint*10000>=s.respondents::bigint*c.agreement_bps ORDER BY key) tags FROM workout_feedback_totals s CROSS JOIN workout_feedback_config c WHERE cardinality(p_ids)<=250 AND s.video_id=ANY(p_ids) AND s.respondents>=c.min_members AND feedback_can_access(auth.uid(),s.video_id)) qualified WHERE cardinality(tags)>0
$$;
CREATE FUNCTION public.moderate_workout_feedback(p_video uuid,p_user uuid,p_excluded boolean,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NOT has_role(auth.uid(),'admin') OR length(trim(p_reason)) NOT BETWEEN 3 AND 1000 OR p_excluded IS NULL THEN RAISE EXCEPTION 'Administrator moderation with a reason required'; END IF;IF p_excluded THEN INSERT INTO workout_feedback_blocks(video_id,user_id) VALUES(p_video,p_user) ON CONFLICT DO NOTHING;ELSE DELETE FROM workout_feedback_blocks WHERE video_id=p_video AND user_id=p_user;END IF;UPDATE workout_feedback SET excluded=p_excluded WHERE video_id=p_video AND user_id=p_user;INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'feedback',p_video::text,'feedback_excluded:'||p_excluded,p_user::text||':'||p_reason);END $$;
CREATE FUNCTION public.configure_workout_feedback(p_min integer,p_bps integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrators only';END IF;UPDATE workout_feedback_config SET min_members=p_min,agreement_bps=p_bps WHERE singleton;INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'feedback','thresholds','thresholds_updated',p_min||':'||p_bps);END $$;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['workout_feedback','workout_feedback_totals','workout_feedback_config','workout_feedback_blocks'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;END $$;
GRANT SELECT ON public.workout_feedback TO authenticated;
CREATE POLICY feedback_private ON public.workout_feedback FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.workout_feedback_config TO authenticated;
CREATE POLICY feedback_config_admin ON public.workout_feedback_config FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
REVOKE ALL ON FUNCTION public.feedback_can_access(uuid,uuid),public.update_feedback_totals(),public.save_workout_feedback(uuid,text[]),public.remove_workout_feedback(uuid),public.workout_community_tags(uuid[]),public.moderate_workout_feedback(uuid,uuid,boolean,text),public.configure_workout_feedback(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_workout_feedback(uuid,text[]),public.remove_workout_feedback(uuid),public.moderate_workout_feedback(uuid,uuid,boolean,text),public.configure_workout_feedback(integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workout_community_tags(uuid[]) TO anon,authenticated,service_role;
-- Server filtering precedes the result cap, including legacy equipment parsing; no private/purchased library is queried.
CREATE FUNCTION public.pick_workout_catalog(p_minutes integer,p_equipment text[],p_style text DEFAULT 'any',p_level text DEFAULT 'any',p_focus text[] DEFAULT '{}',p_intensity text DEFAULT 'any',p_approximate boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_minutes NOT BETWEEN 1 AND 180 OR p_equipment IS NULL OR cardinality(p_equipment)>30 OR NOT valid_discovery_tags(p_focus) OR p_level NOT IN ('any','Beginner','Intermediate','Advanced') OR p_intensity NOT IN ('any','gentle','moderate','challenging') OR length(p_style)>80 THEN RAISE EXCEPTION 'Invalid discovery choices';END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'minutes',w.minutes,'category',w.category,'level',w.level,'equipment',w.equipment,'required_equipment',w.gear,'discovery_tags',w.discovery_focus_tags,'pregnancy_safe',w.pregnancy_safe,'intensity',w.intensity,'review_status','approved') ORDER BY w.approximate,w.distance,w.id),'[]') FROM (SELECT * FROM (
 SELECT v.*,coalesce(v.required_equipment,ARRAY(SELECT trim(g) FROM unnest(string_to_array(split_part(v.equipment,'|',1),',')) g WHERE trim(g)<>'' AND trim(g)<>'No equipment')) gear,(v.minutes>p_minutes) approximate,abs(v.minutes-p_minutes) distance FROM public_workout_catalog v WHERE v.minutes>0 AND v.minutes<=p_minutes+CASE WHEN p_approximate THEN 5 ELSE 0 END AND v.discovery_focus_tags @> p_focus AND (NOT ('prenatal'=ANY(p_focus)) OR v.pregnancy_safe) AND (p_style='any' OR lower(v.category)=lower(p_style)) AND (p_intensity='any' OR v.intensity=p_intensity) AND (p_level='any' OR v.level='All levels' OR array_position(ARRAY['Beginner','Intermediate','Advanced'],v.level)<=array_position(ARRAY['Beginner','Intermediate','Advanced'],p_level))
 ) w WHERE array_remove(w.gear,'No equipment') <@ p_equipment ORDER BY w.approximate,w.distance,w.id LIMIT 250) w);
END $$;
REVOKE ALL ON FUNCTION public.pick_workout_catalog(integer,text[],text,text,text[],text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pick_workout_catalog(integer,text[],text,text,text[],text,boolean) TO anon,authenticated,service_role;
COMMIT;
