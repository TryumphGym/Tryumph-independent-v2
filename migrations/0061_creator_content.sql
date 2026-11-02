-- Subscriber content and scheduled releases reuse approved protected Bunny assets.
BEGIN;
DO $$ BEGIN IF to_regclass('public.creator_receipts') IS NULL THEN RAISE EXCEPTION 'Apply creator membership foundation first'; END IF;IF to_regclass('public.creator_video_access') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.posts'::regclass AND attname='audience' AND NOT attisdropped) THEN RAISE EXCEPTION 'Creator content already exists; inspect before replay'; END IF;END $$;
ALTER TABLE public.posts ADD COLUMN audience text NOT NULL DEFAULT 'community' CHECK(audience IN ('community','public','subscribers','both'));
CREATE TABLE public.creator_video_access(video_id uuid PRIMARY KEY REFERENCES public.trainer_videos(id),trainer_id uuid NOT NULL REFERENCES auth.users(id),audience text NOT NULL CHECK(audience IN ('subscribers','early','public')),public_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),CHECK(audience<>'early' OR public_at IS NOT NULL));
CREATE TABLE public.creator_release_events(video_id uuid REFERENCES public.trainer_videos(id),public_at timestamptz NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(video_id,public_at));
CREATE FUNCTION public.creator_video_public(p_video uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM creator_video_access a JOIN trainer_videos v ON v.id=a.video_id WHERE a.video_id=p_video AND v.review_status='approved' AND (a.audience='public' OR (a.audience='early' AND a.public_at<=now())) AND (trainer_is_eligible(a.trainer_id,false) OR EXISTS(SELECT 1 FROM creator_release_events e WHERE e.video_id=a.video_id AND e.public_at=coalesce(a.public_at,a.updated_at))) AND NOT EXISTS(SELECT 1 FROM account_restrictions r WHERE r.user_id=v.user_id AND r.active))
$$;
CREATE FUNCTION public.set_creator_video_audience(p_video uuid,p_audience text,p_public_at timestamptz DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_audience NOT IN ('subscribers','early','public') OR NOT creator_can_sell(auth.uid()) OR NOT EXISTS(SELECT 1 FROM trainer_videos WHERE id=p_video AND user_id=auth.uid() AND access_scope='program' AND review_status IN ('pending','approved')) OR (p_audience='early' AND (p_public_at IS NULL OR p_public_at<=clock_timestamp())) THEN RAISE EXCEPTION 'Approved protected media, current verification, payout eligibility and a valid release time required'; END IF;
 INSERT INTO creator_video_access(video_id,trainer_id,audience,public_at) VALUES(p_video,auth.uid(),p_audience,CASE WHEN p_audience='early' THEN p_public_at WHEN p_audience='public' THEN clock_timestamp() ELSE NULL END) ON CONFLICT(video_id) DO UPDATE SET audience=excluded.audience,public_at=excluded.public_at,updated_at=now();
 INSERT INTO creator_release_events(video_id,public_at) SELECT a.video_id,a.public_at FROM creator_video_access a JOIN trainer_videos v ON v.id=a.video_id WHERE a.video_id=p_video AND a.audience='public' AND v.review_status='approved' ON CONFLICT DO NOTHING;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'video',p_video::text,'audience:'||p_audience,coalesce(p_public_at::text,''));
END $$;
CREATE FUNCTION public.creator_workouts(p_trainer uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'minutes',v.minutes,'category',v.category,'level',v.level,'equipment',v.equipment,'audience',a.audience,'publicAt',a.public_at,'isPublic',creator_video_public(v.id)) ORDER BY v.created_at DESC),'[]') FROM creator_video_access a JOIN trainer_videos v ON v.id=a.video_id WHERE a.trainer_id=p_trainer AND v.review_status='approved' AND (creator_video_public(v.id) OR creator_has_access(auth.uid(),p_trainer) OR auth.uid()=p_trainer OR has_role(auth.uid(),'admin'))
$$;
CREATE FUNCTION public.creator_video_token(p_user uuid,p_video uuid) RETURNS TABLE(path text,deadline timestamptz,is_public boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t uuid;public_access boolean;
BEGIN
 SELECT a.trainer_id INTO t FROM creator_video_access a JOIN trainer_videos v ON v.id=a.video_id WHERE a.video_id=p_video AND v.review_status='approved';public_access=creator_video_public(p_video);
 IF t IS NULL OR NOT (public_access OR creator_has_access(p_user,t) OR p_user=t OR has_role(p_user,'admin')) THEN RAISE EXCEPTION 'Subscriber video access denied'; END IF;
 IF public_access THEN INSERT INTO creator_release_events(video_id,public_at) SELECT video_id,coalesce(public_at,updated_at) FROM creator_video_access WHERE video_id=p_video AND audience IN ('early','public') ON CONFLICT DO NOTHING;END IF;
 RETURN QUERY SELECT v.path,CASE WHEN public_access OR p_user=t OR has_role(p_user,'admin') THEN NULL ELSE (SELECT max(period_end) FROM creator_receipts r WHERE r.user_id=p_user AND r.trainer_id=t AND r.fulfillable AND NOT r.refund_pending AND r.refunded_cents=0 AND r.period_start<=now() AND r.period_end>now() AND NOT EXISTS(SELECT 1 FROM creator_disputes d WHERE d.order_id=r.id AND d.status IN ('open','lost'))) END,public_access FROM trainer_videos v WHERE v.id=p_video;
END $$;
CREATE FUNCTION public.record_creator_releases() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN INSERT INTO creator_release_events(video_id,public_at) SELECT video_id,coalesce(public_at,updated_at) FROM creator_video_access WHERE (audience='public' OR (audience='early' AND public_at<=now())) AND creator_video_public(video_id) ON CONFLICT DO NOTHING;GET DIAGNOSTICS n=ROW_COUNT;RETURN n;END $$;
CREATE OR REPLACE VIEW public.public_workout_catalog WITH (security_barrier=true) AS SELECT v.id,v.user_id,v.title,v.category,v.level,v.path,v.created_at,v.minutes,v.equipment,v.pregnancy_safe,v.playlist,v.breaks,v.break_seconds,v.required_equipment,v.optional_equipment,v.description,v.spotify_url,v.review_status,v.access_scope FROM public.trainer_videos v WHERE v.review_status='approved' AND (v.access_scope='public' OR public.creator_video_public(v.id));
REVOKE ALL ON public.public_workout_catalog FROM PUBLIC,anon,authenticated;GRANT SELECT ON public.public_workout_catalog TO anon,authenticated,service_role;
-- Public releases are still served by signed delivery; unreleased premium rows remain private.
-- Keep the original restrictive premium-row policy. Released library rows are exposed only through the explicit public metadata view and signed endpoint.
CREATE FUNCTION public.creator_can_read_post(p_user uuid,p_post uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM posts p WHERE p.id=p_post AND (p.author_id=p_user OR has_role(p_user,'admin') OR (NOT p.is_hidden AND (CASE WHEN p.audience='subscribers' THEN creator_has_access(p_user,p.author_id) ELSE p.visibility='public' OR EXISTS(SELECT 1 FROM trybe_memberships WHERE user_id=p_user AND trybe_id=p.trybe) END))))
$$;
CREATE POLICY creator_post_access_guard ON public.posts AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(audience<>'subscribers' OR author_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_creator_subscriber(author_id));
CREATE POLICY creator_subscribed_post_read ON public.posts FOR SELECT TO authenticated USING(audience='subscribers' AND NOT is_hidden AND public.is_creator_subscriber(author_id));
CREATE FUNCTION public.save_creator_post(p_text text,p_audience text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF NOT trainer_is_eligible(auth.uid(),false) OR p_audience NOT IN ('public','subscribers','both') OR length(trim(p_text)) NOT BETWEEN 1 AND 2000 OR (p_audience IN ('subscribers','both') AND NOT creator_can_sell(auth.uid())) THEN RAISE EXCEPTION 'Verified trainer and valid audience required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('creator-post:'||auth.uid()));IF (SELECT count(*) FROM posts WHERE author_id=auth.uid() AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'Daily posting limit reached'; END IF;
 INSERT INTO posts(author_id,author_name,trybe,kind,text,visibility,audience) SELECT id,name,'coach-'||id::text,'Post',trim(p_text),CASE WHEN p_audience='subscribers' THEN 'private' ELSE 'public' END,p_audience FROM profiles WHERE id=auth.uid() RETURNING id INTO result;RETURN result;
END $$;
CREATE FUNCTION public.guard_creator_post() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF current_user IN ('anon','authenticated') AND ((TG_OP='INSERT' AND NEW.audience<>'community') OR (TG_OP='UPDATE' AND NEW.audience IS DISTINCT FROM OLD.audience)) THEN RAISE EXCEPTION 'Audience is server managed'; END IF;RETURN NEW;END $$;
CREATE TRIGGER creator_post_audience_guard BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_creator_post();
CREATE FUNCTION public.guard_creator_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE parent uuid;
BEGIN
 IF NEW.target_type='post' THEN parent=NEW.target_id;ELSIF NEW.target_type='comment' THEN SELECT post_id INTO parent FROM post_comments WHERE id=NEW.target_id;END IF;
 IF parent IS NOT NULL AND NOT creator_can_read_post(auth.uid(),parent) THEN RAISE EXCEPTION 'Cannot report inaccessible subscriber content'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER aa_creator_report_guard BEFORE INSERT ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.guard_creator_report();
-- Preserve existing poll behavior but apply the new audience boundary before its definer reads.
ALTER FUNCTION public.poll_view(uuid) RENAME TO poll_view_v59;
CREATE FUNCTION public.poll_view(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT CASE WHEN creator_can_read_post(auth.uid(),p_id) THEN poll_view_v59(p_id) ELSE NULL END $$;
CREATE OR REPLACE FUNCTION public.vote_trybe_poll(p_id uuid,p_options uuid[],p_revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p posts%ROWTYPE;q trybe_polls%ROWTYPE;
BEGIN
 SELECT * INTO p FROM posts WHERE id=p_id FOR UPDATE;SELECT * INTO q FROM trybe_polls WHERE post_id=p_id FOR UPDATE;
 IF q.post_id IS NULL OR NOT creator_can_read_post(auth.uid(),p_id) OR p.is_hidden OR NOT poll_member(p.trybe) OR NOT account_can_act(auth.uid(),false) THEN RAISE EXCEPTION 'Active Trybe membership required'; END IF;
 IF q.closed_at IS NOT NULL OR (q.expires_at IS NOT NULL AND q.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'Poll is closed'; END IF;
 IF q.revision IS DISTINCT FROM p_revision OR p_options IS NULL OR array_ndims(p_options)<>1 OR cardinality(p_options) NOT BETWEEN 1 AND q.max_selections OR (SELECT count(DISTINCT v) FROM unnest(p_options) v)<>cardinality(p_options) OR EXISTS(SELECT 1 FROM unnest(p_options) v WHERE NOT EXISTS(SELECT 1 FROM trybe_poll_options WHERE poll_id=p_id AND id=v)) THEN RAISE EXCEPTION 'Invalid selections or stale poll; refresh before voting'; END IF;
 INSERT INTO trybe_poll_ballots(poll_id,user_id) VALUES(p_id,auth.uid()) ON CONFLICT(poll_id,user_id) DO UPDATE SET updated_at=now();
 DELETE FROM trybe_poll_choices WHERE poll_id=p_id AND user_id=auth.uid();
 INSERT INTO trybe_poll_choices SELECT p_id,auth.uid(),v FROM unnest(p_options) v;
 RETURN poll_view(p_id);
END $$;
CREATE OR REPLACE FUNCTION public.read_trybe_polls(p_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF cardinality(p_ids)>30 THEN RAISE EXCEPTION 'Request at most thirty polls'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(v),'[]') FROM (SELECT poll_view(id) AS v FROM (SELECT DISTINCT unnest(p_ids) id) ids) views WHERE v IS NOT NULL);
END $$;

DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['creator_video_access','creator_release_events'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;END $$;
REVOKE ALL ON FUNCTION public.creator_video_public(uuid),public.set_creator_video_audience(uuid,text,timestamptz),public.creator_workouts(uuid),public.creator_video_token(uuid,uuid),public.record_creator_releases(),public.creator_can_read_post(uuid,uuid),public.save_creator_post(text,text),public.guard_creator_post(),public.guard_creator_report(),public.poll_view(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.creator_video_public(uuid),public.creator_workouts(uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_creator_video_audience(uuid,text,timestamptz),public.save_creator_post(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_video_token(uuid,uuid),public.record_creator_releases() TO service_role;
COMMIT;
