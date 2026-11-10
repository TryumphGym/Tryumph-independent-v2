-- Private photo staging and feed-ad policy; provider integrations remain disabled by default.
BEGIN;
DO $$ BEGIN IF to_regclass('public.workout_feedback') IS NULL THEN RAISE EXCEPTION 'Apply 0063 first';END IF;IF to_regclass('public.post_photos') IS NOT NULL THEN RAISE EXCEPTION 'Community media module exists; inspect before replay';END IF;END $$;
CREATE TABLE public.community_media_config(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,max_photos integer NOT NULL DEFAULT 4 CHECK(max_photos BETWEEN 1 AND 4),max_bytes integer NOT NULL DEFAULT 8388608 CHECK(max_bytes BETWEEN 1024 AND 8388608));
INSERT INTO public.community_media_config(singleton) VALUES(true);
ALTER TABLE public.posts ADD COLUMN media_revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.posts ADD COLUMN ad_safe boolean NOT NULL DEFAULT false;
CREATE TABLE public.post_photos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid NOT NULL REFERENCES public.posts(id),user_id uuid NOT NULL REFERENCES auth.users(id),alt text NOT NULL CHECK(length(trim(alt)) BETWEEN 1 AND 300),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','review','approved','rejected','specialist')),specialist_cleared boolean NOT NULL DEFAULT false,original_path text NOT NULL UNIQUE,display_path text,thumbnail_path text,review_revision integer,processing_until timestamptz,processing_attempts integer NOT NULL DEFAULT 0,removed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),reviewed_by uuid REFERENCES auth.users(id),reviewed_at timestamptz);
CREATE INDEX post_photos_parent ON public.post_photos(post_id) WHERE removed_at IS NULL;
CREATE INDEX post_photos_queue ON public.post_photos(status,created_at) WHERE removed_at IS NULL;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('community-photo-uploads','community-photo-uploads',false,8388608,ARRAY['image/jpeg','image/png','image/webp']),('community-photos','community-photos',false,8388608,ARRAY['image/webp']);
CREATE FUNCTION public.post_photos_ready(p_post uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT NOT EXISTS(SELECT 1 FROM post_photos WHERE post_id=p_post AND removed_at IS NULL AND status<>'approved') $$;
CREATE POLICY community_photo_post_guard ON public.posts AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(public.post_photos_ready(id) OR author_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.begin_post_photo(p_post uuid,p_alt text,p_ext text) RETURNS SETOF public.post_photos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p posts%ROWTYPE;a post_photos%ROWTYPE;c community_media_config%ROWTYPE;
BEGIN
 SELECT * INTO c FROM community_media_config WHERE singleton;IF NOT c.enabled THEN RAISE EXCEPTION 'Photo publishing awaits verified processing and moderation setup';END IF;
 SELECT * INTO p FROM posts WHERE id=p_post FOR UPDATE;
 IF p.author_id IS DISTINCT FROM auth.uid() OR NOT account_can_act(auth.uid(),false) OR NOT poll_member(p.trybe) OR p.is_hidden OR p.kind='Poll' OR length(trim(p_alt)) NOT BETWEEN 1 AND 300 OR p_ext NOT IN ('jpg','png','webp') THEN RAISE EXCEPTION 'Authorized post ownership and accessible image description required'; END IF;
 IF (SELECT count(*) FROM post_photos WHERE post_id=p_post AND removed_at IS NULL)>=c.max_photos OR (SELECT count(*) FROM post_photos WHERE user_id=auth.uid() AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Photo limit reached'; END IF;
 UPDATE posts SET ad_safe=false WHERE id=p_post;
 INSERT INTO post_photos(post_id,user_id,alt,original_path) VALUES(p_post,auth.uid(),trim(p_alt),auth.uid()::text||'/'||gen_random_uuid()::text||'.'||p_ext) RETURNING * INTO a;RETURN NEXT a;
END $$;
CREATE FUNCTION public.remove_post_photo(p_photo uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN UPDATE post_photos SET removed_at=coalesce(removed_at,now()) WHERE id=p_photo AND user_id=auth.uid();IF NOT FOUND THEN RAISE EXCEPTION 'Not your photo';END IF;END $$;
CREATE FUNCTION public.claim_post_photo_processing(p_user uuid,p_photo uuid) RETURNS SETOF public.post_photos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN RETURN QUERY UPDATE post_photos SET processing_until=now()+interval '1 minute',processing_attempts=processing_attempts+1 WHERE id=p_photo AND user_id=p_user AND status='pending' AND removed_at IS NULL AND processing_attempts<5 AND (processing_until IS NULL OR processing_until<=now()) AND account_can_act(p_user,false) AND EXISTS(SELECT 1 FROM posts WHERE id=post_id AND NOT is_hidden) RETURNING *;END $$;
CREATE FUNCTION public.review_post_photo(p_photo uuid,p_status text,p_revision integer,p_display text,p_thumb text,p_specialist boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a post_photos%ROWTYPE;
BEGIN
 SELECT * INTO a FROM post_photos WHERE id=p_photo AND removed_at IS NULL FOR UPDATE;
 IF a.id IS NULL OR p_status NOT IN ('approved','review','rejected','specialist') OR NOT EXISTS(SELECT 1 FROM posts WHERE id=a.post_id AND media_revision=p_revision) OR (p_status IN ('approved','review') AND (NOT p_specialist OR p_display NOT LIKE a.user_id::text||'/%' OR p_thumb NOT LIKE a.user_id::text||'/%')) THEN RAISE EXCEPTION 'Current safe processing and specialist clearance required';END IF;
 UPDATE post_photos SET status=p_status,specialist_cleared=p_specialist,display_path=CASE WHEN p_status IN ('approved','review') THEN p_display ELSE NULL END,thumbnail_path=CASE WHEN p_status IN ('approved','review') THEN p_thumb ELSE NULL END,review_revision=p_revision,reviewed_at=now() WHERE id=a.id;
END $$;
CREATE FUNCTION public.admin_review_post_photo(p_photo uuid,p_approve boolean,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR length(trim(p_reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Administrator review and reason required'; END IF;
 UPDATE post_photos SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=p_photo AND removed_at IS NULL AND status IN ('review','approved') AND specialist_cleared AND review_revision=(SELECT media_revision FROM posts WHERE id=post_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Only specialist-cleared current review images can enter ordinary review';END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'post_photo',p_photo::text,'human_review:'||p_approve,p_reason);
END $$;
CREATE FUNCTION public.delete_community_post(p_post uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NOT EXISTS(SELECT 1 FROM posts WHERE id=p_post AND author_id=auth.uid()) THEN RAISE EXCEPTION 'Not your post';END IF;UPDATE posts SET is_hidden=true WHERE id=p_post;UPDATE post_photos SET removed_at=coalesce(removed_at,now()) WHERE post_id=p_post;INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'post',p_post::text,'author_removed');END $$;
CREATE FUNCTION public.guard_post_ad_classification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NEW.ad_safe AND NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can classify neutral advertising placements';END IF;RETURN NEW;END $$;
CREATE TRIGGER post_ad_classification BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_post_ad_classification();
CREATE FUNCTION public.guard_post_media_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.ad_safe AND NEW.ad_safe IS DISTINCT FROM OLD.ad_safe AND NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can classify neutral advertising placements';END IF;
 IF NEW.text IS DISTINCT FROM OLD.text THEN NEW.ad_safe=false;NEW.media_revision=OLD.media_revision+1;UPDATE post_photos SET status='pending',specialist_cleared=false,display_path=NULL,thumbnail_path=NULL WHERE post_id=OLD.id AND removed_at IS NULL AND status<>'specialist';ELSE NEW.media_revision=OLD.media_revision;END IF;RETURN NEW;
END $$;
CREATE TRIGGER post_media_edit BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_post_media_revision();
CREATE FUNCTION public.read_post_photos(p_posts uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'postId',a.post_id,'alt',a.alt,'status',a.status) ORDER BY a.created_at),'[]') FROM post_photos a WHERE cardinality(p_posts)<=30 AND a.post_id=ANY(p_posts) AND a.removed_at IS NULL AND (a.user_id=auth.uid() OR (a.status='approved' AND post_photos_ready(a.post_id) AND creator_can_read_post(auth.uid(),a.post_id)))
$$;
CREATE FUNCTION public.post_photo_access(p_user uuid,p_photo uuid,p_review boolean DEFAULT false) RETURNS TABLE(path text,thumbnail text,alt text,deadline timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT a.display_path,a.thumbnail_path,a.alt,CASE WHEN p.audience='subscribers' AND p_user<>a.user_id AND NOT has_role(p_user,'admin') THEN (SELECT max(r.period_end) FROM creator_receipts r WHERE r.trainer_id=p.author_id AND r.user_id=p_user AND r.fulfillable AND NOT r.refund_pending AND r.refunded_cents=0 AND r.period_start<=now() AND r.period_end>now() AND NOT EXISTS(SELECT 1 FROM creator_disputes d WHERE d.order_id=r.id AND d.status IN ('open','lost'))) ELSE NULL END FROM post_photos a JOIN posts p ON p.id=a.post_id WHERE a.id=p_photo AND a.removed_at IS NULL AND a.specialist_cleared AND a.review_revision=(SELECT media_revision FROM posts WHERE id=a.post_id) AND ((p_review AND has_role(p_user,'admin') AND a.status IN ('approved','review')) OR (NOT p_review AND a.status='approved' AND post_photos_ready(a.post_id) AND creator_can_read_post(p_user,a.post_id)))
$$;
CREATE FUNCTION public.public_post_photo_access(p_photo uuid) RETURNS TABLE(path text,thumbnail text,alt text,deadline timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT * FROM public.post_photo_access(NULL::uuid,p_photo,false) $$;
REVOKE ALL ON FUNCTION public.public_post_photo_access(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.public_post_photo_access(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.creator_can_read_post(p_user uuid,p_post uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM posts p WHERE p.id=p_post AND (p.author_id=p_user OR has_role(p_user,'admin') OR (NOT p.is_hidden AND post_photos_ready(p.id) AND (CASE WHEN p.audience='subscribers' THEN creator_has_access(p_user,p.author_id) ELSE p.visibility='public' OR EXISTS(SELECT 1 FROM trybe_memberships WHERE user_id=p_user AND trybe_id=p.trybe) END))))
$$;
-- No raw image reads for clients, including owners/admins. Re-encoded derivatives only via authorized server access.
CREATE POLICY community_original_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='community-photo-uploads' AND EXISTS(SELECT 1 FROM public.post_photos a WHERE a.original_path=name AND a.user_id=auth.uid() AND a.status='pending' AND a.removed_at IS NULL));
CREATE POLICY community_original_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(bucket_id NOT IN ('community-photo-uploads','community-photos') OR (bucket_id='community-photo-uploads' AND EXISTS(SELECT 1 FROM public.post_photos a WHERE a.original_path=name AND a.user_id=auth.uid() AND a.status='pending' AND a.removed_at IS NULL)));
CREATE POLICY community_image_private ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(bucket_id NOT IN ('community-photo-uploads','community-photos'));
CREATE POLICY community_image_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(bucket_id NOT IN ('community-photo-uploads','community-photos')) WITH CHECK(bucket_id NOT IN ('community-photo-uploads','community-photos'));
CREATE POLICY community_image_retained ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(bucket_id NOT IN ('community-photo-uploads','community-photos'));
-- Only private own metadata is available to upload-policy evaluation; never storage locations of other members.
ALTER TABLE public.post_photos ENABLE ROW LEVEL SECURITY;REVOKE ALL ON public.post_photos FROM PUBLIC,anon,authenticated;GRANT SELECT ON public.post_photos TO authenticated;GRANT ALL ON public.post_photos TO service_role;
CREATE POLICY photo_metadata_owner ON public.post_photos FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.community_ad_config(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,first_after integer NOT NULL DEFAULT 6 CHECK(first_after>=6),spacing integer NOT NULL DEFAULT 8 CHECK(spacing>=8));
INSERT INTO public.community_ad_config(singleton) VALUES(true);
CREATE TABLE public.community_ad_placements(trybe_id text PRIMARY KEY,enabled boolean NOT NULL DEFAULT false,sensitive boolean NOT NULL DEFAULT true);
CREATE TABLE public.community_ad_sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),organic_count integer NOT NULL DEFAULT 0,last_ad_at integer NOT NULL DEFAULT 0,expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour');
CREATE TABLE public.community_ad_seen(session_id uuid REFERENCES public.community_ad_sessions(id) ON DELETE CASCADE,post_id uuid REFERENCES public.posts(id),PRIMARY KEY(session_id,post_id));
CREATE TABLE public.community_ad_receipts(provider_event text PRIMARY KEY,provider text NOT NULL,gross_cents integer NOT NULL CHECK(gross_cents>=0),fee_cents integer NOT NULL CHECK(fee_cents BETWEEN 0 AND gross_cents),platform_net_cents integer GENERATED ALWAYS AS(gross_cents-fee_cents) STORED,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.community_ad_creatives(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),body text NOT NULL CHECK(length(body)<=600),external_url text NOT NULL CHECK(external_url ~ '^https://'),enabled boolean NOT NULL DEFAULT false);
CREATE TABLE public.community_ad_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),creative_id uuid NOT NULL REFERENCES public.community_ad_creatives(id),user_id uuid NOT NULL REFERENCES auth.users(id),reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 1000),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(creative_id,user_id));
ALTER TABLE public.community_ad_creatives ENABLE ROW LEVEL SECURITY;ALTER TABLE public.community_ad_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_ad_creatives,public.community_ad_reports FROM PUBLIC,anon,authenticated;GRANT ALL ON public.community_ad_creatives,public.community_ad_reports TO service_role;
GRANT INSERT,SELECT ON public.community_ad_reports TO authenticated;
CREATE POLICY community_ad_report_owner ON public.community_ad_reports FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY community_ad_report_insert ON public.community_ad_reports FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.account_can_act(auth.uid(),false));
CREATE FUNCTION public.community_ad_slot(p_session uuid,p_user uuid,p_posts uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c community_ad_config%ROWTYPE;s community_ad_sessions%ROWTYPE;p posts%ROWTYPE;chosen uuid;inserted integer;
BEGIN
 SELECT * INTO c FROM community_ad_config WHERE singleton;IF NOT c.enabled OR cardinality(p_posts)>30 OR p_user IS NULL OR NOT account_can_act(p_user,false) THEN RETURN NULL;END IF;
 INSERT INTO community_ad_sessions(id,user_id) VALUES(p_session,p_user) ON CONFLICT DO NOTHING;SELECT * INTO s FROM community_ad_sessions WHERE id=p_session AND user_id=p_user AND expires_at>now() FOR UPDATE;IF NOT FOUND THEN RETURN NULL;END IF;
 FOR p IN SELECT x.* FROM unnest(p_posts) WITH ORDINALITY ids(id,n) JOIN posts x ON x.id=ids.id ORDER BY ids.n LOOP
  -- Conservative initial scope: only explicitly configured neutral communities and non-sensitive text.
  IF NOT p.ad_safe OR p.kind='Sponsored' OR p.is_hidden OR NOT creator_can_read_post(p_user,p.id) OR NOT post_photos_ready(p.id) OR NOT EXISTS(SELECT 1 FROM community_ad_placements WHERE trybe_id=p.trybe AND enabled AND NOT sensitive) OR p.text ~* '(pregnan|postpartum|postnatal|breastfeed|diagnos|depress|anxiety|pelvic|medical|cancer|arthritis|surgery|trauma|injur|medicat)' THEN CONTINUE;END IF;
  INSERT INTO community_ad_seen(session_id,post_id) VALUES(s.id,p.id) ON CONFLICT DO NOTHING;GET DIAGNOSTICS inserted=ROW_COUNT;IF inserted=0 THEN CONTINUE;END IF;
  s.organic_count=s.organic_count+1;
  IF chosen IS NULL AND s.organic_count>=c.first_after AND (s.last_ad_at=0 OR s.organic_count-s.last_ad_at>=c.spacing) THEN chosen=p.id;s.last_ad_at=s.organic_count;END IF;
 END LOOP;
 UPDATE community_ad_sessions SET organic_count=s.organic_count,last_ad_at=s.last_ad_at WHERE id=s.id;RETURN chosen;
END $$;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['community_media_config','community_ad_config','community_ad_placements','community_ad_sessions','community_ad_seen','community_ad_receipts'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;END $$;
REVOKE ALL ON FUNCTION public.claim_post_photo_processing(uuid,uuid),public.delete_community_post(uuid),public.guard_post_ad_classification(),public.post_photos_ready(uuid),public.begin_post_photo(uuid,text,text),public.remove_post_photo(uuid),public.review_post_photo(uuid,text,integer,text,text,boolean),public.admin_review_post_photo(uuid,boolean,text),public.guard_post_media_revision(),public.read_post_photos(uuid[]),public.post_photo_access(uuid,uuid,boolean),public.community_ad_slot(uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.post_photos_ready(uuid),public.read_post_photos(uuid[]) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_community_post(uuid),public.begin_post_photo(uuid,text,text),public.remove_post_photo(uuid),public.admin_review_post_photo(uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_post_photo_processing(uuid,uuid),public.review_post_photo(uuid,text,integer,text,text,boolean),public.post_photo_access(uuid,uuid,boolean),public.community_ad_slot(uuid,uuid,uuid[]) TO service_role;
COMMIT;
