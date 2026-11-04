BEGIN;
CREATE TABLE public.discovery_privacy(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),salt text NOT NULL DEFAULT gen_random_uuid()::text);
INSERT INTO public.discovery_privacy(singleton) VALUES(true);
CREATE TABLE public.discovery_demand(member_key text NOT NULL,day date NOT NULL DEFAULT current_date,source text NOT NULL CHECK(source IN ('workouts','programs','live')),topic jsonb NOT NULL,supply integer NOT NULL CHECK(supply>=0),PRIMARY KEY(member_key,day,source,topic));
CREATE INDEX discovery_demand_period ON public.discovery_demand(day,source);
ALTER TABLE public.discovery_demand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_privacy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discovery_demand,public.discovery_privacy FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.discovery_demand,public.discovery_privacy TO service_role;
CREATE FUNCTION public.record_discovery_demand(p_source text,p_query text DEFAULT '',p_tags text[] DEFAULT '{}',p_category text DEFAULT '',p_equipment text[] DEFAULT '{}',p_length integer DEFAULT 0,p_difficulty text DEFAULT '',p_min_length integer DEFAULT 0,p_exact boolean DEFAULT false,p_categories text[] DEFAULT '{}') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_topic jsonb;cats text[];tags text[];v_equipment text[];term text;key text;supply integer;
BEGIN
 IF length(coalesce(p_query,''))>160 OR cardinality(p_tags)>24 OR cardinality(p_equipment)>20 OR cardinality(p_categories)>7 OR auth.uid() IS NULL OR NOT account_can_act(auth.uid(),false) OR p_source NOT IN ('workouts','programs','live') THEN RETURN;END IF;
 -- Allowlisted fitness terms only. Unrecognized/sensitive free text is discarded completely.
 term=lower(trim(regexp_replace(coalesce(p_query,''),'[[:space:]]+',' ','g')));
 IF term<>'' AND term NOT IN ('strength','cardio','hiit','core','yoga','pilates','mobility','running','flexibility','endurance','functional fitness','general wellness','weight loss') THEN RETURN;END IF;
 SELECT coalesce(array_agg(DISTINCT t ORDER BY t),'{}') INTO tags FROM unnest(p_tags) t WHERE t IN ('weight_loss','strength','core','flexibility','endurance','functional','running','wellness');
 -- Never retain sensitive needs, diagnoses, life stages, original free text or profile preferences.
 SELECT coalesce(array_agg(DISTINCT t ORDER BY t),'{}') INTO v_equipment FROM unnest(p_equipment) t WHERE t IN ('No equipment','Dumbbells','Kettlebell','Resistance bands','Mini loop bands','Yoga ball','Yoga blocks','Mat','Sliders','Step / sturdy chair','Pull-up bar','Jump rope','Foam roller','Medicine ball');
 IF cardinality(tags)<>cardinality(p_tags) OR cardinality(v_equipment)<>cardinality(p_equipment) OR cardinality(tags)>4 OR cardinality(v_equipment)>4 THEN RETURN;END IF;
 SELECT coalesce(array_agg(DISTINCT t ORDER BY t),'{}') INTO cats FROM unnest(p_categories||CASE WHEN p_category='' THEN '{}'::text[] ELSE ARRAY[p_category] END) t;
 IF cardinality(cats)>7 OR NOT cats <@ ARRAY['Strength','Cardio','HIIT','Core','Yoga','Pilates','Mobility'] OR p_min_length NOT IN (0,15,31,46) OR p_min_length>p_length OR p_exact IS NULL THEN RETURN;END IF;
 IF p_category NOT IN ('','Strength','Cardio','HIIT','Core','Yoga','Pilates','Mobility') OR p_length NOT IN (0,5,10,14,15,20,30,45,60,999) OR p_difficulty NOT IN ('','Beginner','Intermediate','Advanced','All levels') THEN RETURN;END IF;
 IF (p_source='programs' AND p_length<>0) OR (p_source='live' AND cardinality(v_equipment)>0) THEN RETURN;END IF;
 IF term='' AND cardinality(tags)=0 AND cardinality(v_equipment)=0 AND cardinality(cats)=0 AND p_length=0 AND p_difficulty='' THEN RETURN;END IF;
 SELECT encode(sha256(convert_to(salt||auth.uid()::text,'UTF8')),'hex') INTO key FROM discovery_privacy WHERE singleton;
 PERFORM pg_advisory_xact_lock(hashtext('demand:'||key));
 IF (SELECT count(*) FROM discovery_demand WHERE member_key=key AND day=current_date)>=20 THEN RETURN;END IF;
 v_topic=jsonb_build_object('term',term,'tags',tags,'categories',cats,'minMinutes',p_min_length,'exact',p_exact,'equipment',v_equipment,'minutes',p_length,'difficulty',p_difficulty);
 IF EXISTS(SELECT 1 FROM discovery_demand WHERE member_key=key AND day=current_date AND source=p_source AND discovery_demand.topic=v_topic) THEN RETURN;END IF;
 IF p_source='workouts' THEN
 SELECT count(*) INTO supply FROM public_workout_catalog v WHERE (term='' OR v.title ILIKE '%'||term||'%' OR v.category ILIKE '%'||term||'%') AND v.discovery_focus_tags @> tags AND (cardinality(cats)=0 OR v.category=ANY(cats)) AND (p_length=0 OR v.minutes<=p_length) AND v.minutes>=p_min_length AND (NOT p_exact OR v.minutes=p_length) AND (p_difficulty='' OR v.level IN (p_difficulty,'All levels')) AND (cardinality(v_equipment)=0 OR coalesce(v.required_equipment,'{}') <@ v_equipment OR coalesce(v.required_equipment,'{}') <@ ARRAY['No equipment']);
 ELSIF p_source='programs' THEN
 SELECT count(*) INTO supply FROM discoverable_programs p WHERE p.published AND p.builder_version=2 AND (term='' OR p.title ILIKE '%'||term||'%') AND p.discovery_focus_tags @> tags AND (cardinality(cats)=0 OR p.summary->>'category'=ANY(cats)) AND (p_difficulty='' OR p.summary->>'difficulty' IN (p_difficulty,'All levels')) AND (cardinality(v_equipment)=0 OR ARRAY(SELECT jsonb_array_elements_text(coalesce(p.summary->'equipment','[]'))) <@ v_equipment) AND p_length=0;
 ELSE
 SELECT count(*) INTO supply FROM discoverable_lives l WHERE l.status IN ('scheduled','live') AND l.starts_at+l.minutes*interval '1 minute'>now() AND trainer_is_eligible(l.trainer_id,true) AND (term='' OR l.title ILIKE '%'||term||'%') AND l.discovery_focus_tags @> tags AND (cardinality(cats)=0 OR l.category=ANY(cats)) AND (p_length=0 OR l.minutes<=p_length) AND l.minutes>=p_min_length AND (NOT p_exact OR l.minutes=p_length) AND (p_difficulty='' OR l.level IN (p_difficulty,'All levels')) AND cardinality(v_equipment)=0;
 END IF;
 INSERT INTO discovery_demand(member_key,source,topic,supply) VALUES(key,p_source,v_topic,supply) ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION public.creator_demand_insights(p_days integer DEFAULT 30,p_audience boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE result jsonb;BEGIN
 IF NOT trainer_is_eligible(auth.uid(),false) OR p_days NOT IN (7,30,90) THEN RAISE EXCEPTION 'Verified trainer and supported reporting period required';END IF;
 -- Fixed complete-day windows reduce repeated-query differencing. Ten distinct members per topic,
 -- twenty in the selected cohort. No member keys, dates, raw events or suppressed counts returned.
 WITH cohort AS (SELECT DISTINCT encode(sha256(convert_to(s.salt||p.id::text,'UTF8')),'hex') AS key FROM profiles p CROSS JOIN discovery_privacy s WHERE (coalesce(p.extra->'followed','[]') ? auth.uid()::text OR EXISTS(SELECT 1 FROM creator_playbacks v WHERE v.user_id=p.id AND v.trainer_id=auth.uid() AND v.created_at>=current_date-90))),
 events AS (SELECT * FROM discovery_demand d WHERE d.day>=current_date-p_days AND d.day<current_date AND (NOT p_audience OR d.member_key IN (SELECT key FROM cohort))),
 totals AS (SELECT count(DISTINCT member_key) n FROM events),
 topics AS (SELECT source,topic,count(DISTINCT member_key) members,count(DISTINCT member_key) FILTER(WHERE supply=0) zero_members,count(DISTINCT member_key) FILTER(WHERE supply<=3) low_members,round(avg(supply)) available FROM events GROUP BY source,topic HAVING count(DISTINCT member_key)>=10)
 SELECT jsonb_build_object('sufficient',(SELECT n>=20 FROM totals),'rows',CASE WHEN (SELECT n>=20 FROM totals) THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('source',source,'topic',topic,'members',members,'zeroResults',CASE WHEN zero_members>=10 THEN zero_members ELSE NULL END,'lowResults',CASE WHEN low_members>=10 THEN low_members ELSE NULL END,'averageSupply',available) ORDER BY members DESC,source,topic::text),'[]') FROM (SELECT * FROM topics ORDER BY members DESC,source,topic::text LIMIT 30) limited) ELSE '[]'::jsonb END) INTO result;RETURN result;
END $$;
CREATE FUNCTION public.purge_discovery_demand() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE n bigint;BEGIN DELETE FROM discovery_demand WHERE day<current_date-90;GET DIAGNOSTICS n=ROW_COUNT;RETURN n;END $$;
REVOKE ALL ON FUNCTION public.record_discovery_demand(text,text,text[],text,text[],integer,text,integer,boolean,text[]),public.creator_demand_insights(integer,boolean),public.purge_discovery_demand() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_discovery_demand(text,text,text[],text,text[],integer,text,integer,boolean,text[]),public.creator_demand_insights(integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_discovery_demand() TO service_role;
COMMIT;
