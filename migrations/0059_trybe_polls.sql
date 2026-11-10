-- One-time additive module. Apply only after reconciling the inspected hosted schema.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.account_can_act(uuid,boolean)') IS NULL OR to_regprocedure('public.can_see_trybe(text)') IS NULL OR to_regprocedure('public.notify_account(uuid,text,text,text,text)') IS NULL THEN RAISE EXCEPTION 'Reconcile the launch foundation first'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY['trybe_polls','trybe_poll_options','trybe_poll_ballots','trybe_poll_choices','trybe_poll_notice_jobs'])) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY(ARRAY['poll_owner','poll_member','poll_view','read_trybe_polls','save_trybe_poll','vote_trybe_poll','close_trybe_poll','poll_owned_trybes','deliver_trybe_poll_notices','guard_poll_post'])) OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.notification_preferences'::regclass AND attname='poll_updates' AND NOT attisdropped) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.trybe_memberships'::regclass AND polname='trybe_poll_registered_member_join') OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.posts'::regclass AND tgname='trybe_poll_post_guard') THEN RAISE EXCEPTION 'Poll module objects already exist; inspect instead of replaying'; END IF;
 IF EXISTS(SELECT 1 FROM public.posts WHERE lower(kind)='poll') THEN RAISE EXCEPTION 'Existing Poll post kinds require explicit reconciliation'; END IF;
 -- The inspected hosted database already has this registry. Preserve it unchanged.
 IF to_regclass('public.trybes') IS NULL THEN
  CREATE TABLE public.trybes(id text PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 150),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,kind text NOT NULL DEFAULT 'member' CHECK(kind IN ('member','trainer')),created_at timestamptz NOT NULL DEFAULT now());
  ALTER TABLE public.trybes ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.trybes FROM PUBLIC,anon,authenticated;
  GRANT SELECT ON public.trybes TO anon,authenticated;GRANT ALL ON public.trybes TO service_role;
  CREATE POLICY poll_registry_discovery ON public.trybes FOR SELECT TO anon,authenticated USING(true);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.trybes'::regclass AND attname='id' AND atttypid='text'::regtype AND NOT attisdropped) OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.trybes'::regclass AND attname='owner_id' AND atttypid='uuid'::regtype AND NOT attisdropped) OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.trybes'::regclass AND attname='kind' AND atttypid='text'::regtype AND NOT attisdropped) THEN RAISE EXCEPTION 'Inspect the existing Trybe registry contract'; END IF;
END $$;
ALTER TABLE public.notification_preferences ADD COLUMN poll_updates boolean NOT NULL DEFAULT false;
-- Broaden only the existing category check, preserving all previously valid categories.
DO $$ DECLARE c record;n integer; BEGIN
 SELECT count(*) INTO n FROM pg_constraint WHERE conrelid='public.account_notifications'::regclass AND contype='c' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.account_notifications'::regclass AND attname='category')]::smallint[];
 IF n<>1 THEN RAISE EXCEPTION 'Inspect notification category constraints before applying polls'; END IF;
 SELECT conname,pg_get_expr(conbin,conrelid) AS expression INTO c FROM pg_constraint WHERE conrelid='public.account_notifications'::regclass AND contype='c' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.account_notifications'::regclass AND attname='category')]::smallint[];
 EXECUTE format('ALTER TABLE public.account_notifications DROP CONSTRAINT %I',c.conname);
 EXECUTE format('ALTER TABLE public.account_notifications ADD CONSTRAINT %I CHECK ((%s) OR category=''poll'')',c.conname,c.expression);
END $$;
CREATE TABLE public.trybe_polls(post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,question text NOT NULL CHECK(length(trim(question)) BETWEEN 1 AND 500),description text NOT NULL DEFAULT '' CHECK(length(description)<=1400),max_selections integer NOT NULL DEFAULT 1 CHECK(max_selections BETWEEN 1 AND 6),expires_at timestamptz,closed_at timestamptz,revision integer NOT NULL DEFAULT 1 CHECK(revision>0));
CREATE TABLE public.trybe_poll_options(poll_id uuid NOT NULL REFERENCES public.trybe_polls(post_id) ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),position integer NOT NULL CHECK(position BETWEEN 0 AND 5),label text NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 200),PRIMARY KEY(poll_id,id),UNIQUE(poll_id,position));
CREATE UNIQUE INDEX trybe_poll_unique_label ON public.trybe_poll_options(poll_id,lower(trim(label)));
CREATE TABLE public.trybe_poll_ballots(poll_id uuid NOT NULL REFERENCES public.trybe_polls(post_id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(poll_id,user_id));
CREATE TABLE public.trybe_poll_choices(poll_id uuid NOT NULL,user_id uuid NOT NULL,option_id uuid NOT NULL,PRIMARY KEY(poll_id,user_id,option_id),FOREIGN KEY(poll_id,user_id) REFERENCES public.trybe_poll_ballots(poll_id,user_id) ON DELETE CASCADE,FOREIGN KEY(poll_id,option_id) REFERENCES public.trybe_poll_options(poll_id,id) ON DELETE CASCADE);
CREATE INDEX trybe_poll_aggregate ON public.trybe_poll_choices(poll_id,option_id);
CREATE TABLE public.trybe_poll_notice_jobs(poll_id uuid PRIMARY KEY REFERENCES public.trybe_polls(post_id) ON DELETE CASCADE,cursor_id uuid,finished_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX trybe_poll_pending_notices ON public.trybe_poll_notice_jobs(created_at) WHERE finished_at IS NULL;
CREATE POLICY trybe_poll_registered_member_join ON public.trybe_memberships FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.account_can_act(auth.uid(),false) AND trybe_id NOT LIKE 'coach-%' AND trybe_id NOT IN ('all','discover','official','announcements','g-postpartum','g-lowimpact','g-beginner','g-parents') AND EXISTS(SELECT 1 FROM public.trybes WHERE id=trybe_id AND kind='member'));
CREATE INDEX trybe_poll_member_fanout ON public.trybe_memberships(trybe_id,user_id);
CREATE INDEX trybe_poll_feed ON public.posts(trybe,created_at DESC,id DESC);

CREATE FUNCTION public.poll_owner(p_trybe text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND account_can_act(auth.uid(),false) AND (
 (p_trybe='coach-'||auth.uid()::text AND trainer_is_eligible(auth.uid(),false)) OR
 (p_trybe NOT LIKE 'coach-%' AND p_trybe NOT IN ('all','discover','official','announcements','g-postpartum','g-lowimpact','g-beginner','g-parents') AND EXISTS(SELECT 1 FROM trybes WHERE id=p_trybe AND owner_id=auth.uid() AND kind='member') AND NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer' AND NOT trainer_is_eligible(auth.uid(),false))))
$$;
CREATE FUNCTION public.poll_member(p_trybe text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND (EXISTS(SELECT 1 FROM trybe_memberships WHERE trybe_id=p_trybe AND user_id=auth.uid()) OR (p_trybe='coach-'||auth.uid()::text AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer')) OR (p_trybe NOT LIKE 'coach-%' AND EXISTS(SELECT 1 FROM trybes WHERE id=p_trybe AND owner_id=auth.uid() AND kind='member')))
$$;
CREATE FUNCTION public.poll_owned_trybes() RETURNS TABLE(id text,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT 'coach-'||p.id::text,p.name||'''s Trybe' FROM profiles p WHERE p.id=auth.uid() AND poll_owner('coach-'||p.id::text)
 UNION ALL SELECT t.id,t.name FROM trybes t WHERE t.owner_id=auth.uid() AND poll_owner(t.id)
$$;
CREATE FUNCTION public.poll_view(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p posts%ROWTYPE;q trybe_polls%ROWTYPE;n integer;closed boolean;results boolean;mine uuid[];creator boolean;admin boolean;
BEGIN
 SELECT * INTO p FROM posts WHERE id=p_id;SELECT * INTO q FROM trybe_polls WHERE post_id=p_id;IF q.post_id IS NULL THEN RETURN NULL; END IF;
 creator=coalesce(p.author_id=auth.uid(),false);admin=coalesce(has_role(auth.uid(),'admin'),false);
 IF NOT (creator OR admin OR (NOT p.is_hidden AND (p.visibility='public' OR can_see_trybe(p.trybe)))) THEN RETURN NULL; END IF;
 closed=q.closed_at IS NOT NULL OR (q.expires_at IS NOT NULL AND q.expires_at<=clock_timestamp());SELECT count(*) INTO n FROM trybe_poll_ballots WHERE poll_id=p_id;
 SELECT coalesce(array_agg(option_id),'{}') INTO mine FROM trybe_poll_choices WHERE poll_id=p_id AND user_id=auth.uid();
 results=creator OR admin OR (poll_member(p.trybe) AND (closed OR cardinality(mine)>0));
 RETURN jsonb_build_object('id',p_id,'trybe',p.trybe,'question',q.question,'description',q.description,'maxSelections',q.max_selections,'revision',q.revision,'expiresAt',q.expires_at,'closed',closed,'createdAt',p.created_at,'creatorName',p.author_name,'creatorAvatar',(SELECT avatar_url FROM profiles WHERE id=p.author_id),'voters',n,'resultsVisible',results,'mine',to_jsonb(mine),'mayVote',NOT closed AND NOT p.is_hidden AND poll_member(p.trybe) AND account_can_act(auth.uid(),false),'mayEdit',creator AND poll_owner(p.trybe) AND n=0 AND NOT closed,'mayClose',(creator OR admin) AND NOT closed,'requiresCloseReason',admin AND NOT creator,'options',(SELECT jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'votes',CASE WHEN results THEN (SELECT count(*) FROM trybe_poll_choices c WHERE c.poll_id=p_id AND c.option_id=o.id) ELSE NULL END) ORDER BY o.position) FROM trybe_poll_options o WHERE o.poll_id=p_id));
END $$;
CREATE FUNCTION public.read_trybe_polls(p_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF cardinality(p_ids)>30 THEN RAISE EXCEPTION 'Request at most thirty polls'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(v),'[]') FROM (SELECT poll_view(id) AS v FROM (SELECT DISTINCT unnest(p_ids) id) ids) views WHERE v IS NOT NULL);
END $$;
CREATE FUNCTION public.save_trybe_poll(p_trybe text,p_question text,p_description text,p_options text[],p_max integer,p_expires timestamptz DEFAULT NULL,p_notify boolean DEFAULT false,p_public boolean DEFAULT false,p_id uuid DEFAULT NULL,p_revision integer DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid:=p_id;p posts%ROWTYPE;q trybe_polls%ROWTYPE;label text;i integer:=0;
BEGIN
 IF NOT poll_owner(p_trybe) THEN RAISE EXCEPTION 'Only the verified trainer or actual Trybe owner may create polls'; END IF;
 IF length(trim(coalesce(p_question,''))) NOT BETWEEN 1 AND 500 OR length(coalesce(p_description,''))>1400 OR cardinality(p_options) NOT BETWEEN 2 AND 6 OR p_max NOT BETWEEN 1 AND cardinality(p_options) OR p_max IS NULL OR p_options IS NULL OR array_ndims(p_options)<>1 OR EXISTS(SELECT 1 FROM unnest(p_options) v WHERE length(trim(coalesce(v,''))) NOT BETWEEN 1 AND 200) OR (SELECT count(DISTINCT lower(trim(v))) FROM unnest(p_options) v)<>cardinality(p_options) OR (p_expires IS NOT NULL AND p_expires<=clock_timestamp()) THEN RAISE EXCEPTION 'Invalid question, options, selection limit or expiration'; END IF;
 IF p_public AND p_trybe<>'coach-'||auth.uid()::text THEN RAISE EXCEPTION 'Only your trainer Trybe may publish public polls'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('poll-create:'||auth.uid()::text));
 IF result IS NULL THEN
  IF (SELECT count(*) FROM posts WHERE author_id=auth.uid() AND kind='Poll' AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Daily poll limit reached'; END IF;
  IF p_notify AND EXISTS(SELECT 1 FROM trybe_poll_notice_jobs j JOIN posts x ON x.id=j.poll_id WHERE x.trybe=p_trybe AND j.created_at>now()-interval '1 hour') THEN RAISE EXCEPTION 'Only one notified poll per Trybe per hour'; END IF;
  INSERT INTO trybe_memberships(user_id,trybe_id) VALUES(auth.uid(),p_trybe) ON CONFLICT DO NOTHING;
  INSERT INTO posts(author_id,author_name,trybe,kind,text,visibility) SELECT auth.uid(),name,p_trybe,'Poll',trim(p_question)||CASE WHEN coalesce(p_description,'')='' THEN '' ELSE E'\n'||p_description END,CASE WHEN p_public THEN 'public' ELSE 'private' END FROM profiles WHERE id=auth.uid() RETURNING id INTO result;
  INSERT INTO trybe_polls(post_id,question,description,max_selections,expires_at) VALUES(result,trim(p_question),coalesce(p_description,''),p_max,p_expires);
 ELSE
  SELECT * INTO p FROM posts WHERE id=result FOR UPDATE;SELECT * INTO q FROM trybe_polls WHERE post_id=result FOR UPDATE;
  IF p.author_id IS DISTINCT FROM auth.uid() OR p.trybe IS DISTINCT FROM p_trybe OR q.post_id IS NULL OR q.revision IS DISTINCT FROM p_revision OR q.closed_at IS NOT NULL OR (q.expires_at IS NOT NULL AND q.expires_at<=clock_timestamp()) OR EXISTS(SELECT 1 FROM trybe_poll_ballots WHERE poll_id=result) OR p.is_hidden THEN RAISE EXCEPTION 'Poll changed, has votes, is closed, or is not yours; refresh before editing'; END IF;
  UPDATE posts SET text=trim(p_question)||CASE WHEN coalesce(p_description,'')='' THEN '' ELSE E'\n'||p_description END WHERE id=result;
  UPDATE trybe_polls SET question=trim(p_question),description=coalesce(p_description,''),max_selections=p_max,expires_at=p_expires,revision=revision+1 WHERE post_id=result;
  DELETE FROM trybe_poll_options WHERE poll_id=result;
 END IF;
 FOREACH label IN ARRAY p_options LOOP
  INSERT INTO trybe_poll_options(poll_id,position,label) VALUES(result,i,trim(label));i=i+1;
 END LOOP;
 IF p_id IS NULL AND p_notify THEN INSERT INTO trybe_poll_notice_jobs(poll_id) VALUES(result); END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'post',result::text,CASE WHEN p_id IS NULL THEN 'poll_created' ELSE 'poll_edited_before_votes' END);
 RETURN result;
END $$;
CREATE FUNCTION public.vote_trybe_poll(p_id uuid,p_options uuid[],p_revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p posts%ROWTYPE;q trybe_polls%ROWTYPE;
BEGIN
 SELECT * INTO p FROM posts WHERE id=p_id FOR UPDATE;SELECT * INTO q FROM trybe_polls WHERE post_id=p_id FOR UPDATE;
 IF q.post_id IS NULL OR p.is_hidden OR NOT poll_member(p.trybe) OR NOT account_can_act(auth.uid(),false) THEN RAISE EXCEPTION 'Active Trybe membership required'; END IF;
 IF q.closed_at IS NOT NULL OR (q.expires_at IS NOT NULL AND q.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'Poll is closed'; END IF;
 IF q.revision IS DISTINCT FROM p_revision OR p_options IS NULL OR array_ndims(p_options)<>1 OR cardinality(p_options) NOT BETWEEN 1 AND q.max_selections OR (SELECT count(DISTINCT v) FROM unnest(p_options) v)<>cardinality(p_options) OR EXISTS(SELECT 1 FROM unnest(p_options) v WHERE NOT EXISTS(SELECT 1 FROM trybe_poll_options WHERE poll_id=p_id AND id=v)) THEN RAISE EXCEPTION 'Invalid selections or stale poll; refresh before voting'; END IF;
 INSERT INTO trybe_poll_ballots(poll_id,user_id) VALUES(p_id,auth.uid()) ON CONFLICT(poll_id,user_id) DO UPDATE SET updated_at=now();
 DELETE FROM trybe_poll_choices WHERE poll_id=p_id AND user_id=auth.uid();
 INSERT INTO trybe_poll_choices SELECT p_id,auth.uid(),v FROM unnest(p_options) v;
 RETURN poll_view(p_id);
END $$;
CREATE FUNCTION public.close_trybe_poll(p_id uuid,p_reason text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p posts%ROWTYPE;
BEGIN
 SELECT * INTO p FROM posts WHERE id=p_id FOR UPDATE;
 IF p.id IS NULL OR auth.uid() IS NULL OR NOT (coalesce(p.author_id=auth.uid(),false) OR has_role(auth.uid(),'admin')) OR NOT account_can_act(auth.uid(),false) THEN RAISE EXCEPTION 'Poll creator or admin required'; END IF;
 IF p.author_id<>auth.uid() AND length(trim(p_reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Admin moderation reason required'; END IF;
 UPDATE trybe_polls SET closed_at=clock_timestamp() WHERE post_id=p_id AND closed_at IS NULL;
 IF FOUND THEN INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'post',p_id::text,'poll_closed',left(p_reason,1000)); END IF;
 RETURN poll_view(p_id);
END $$;
CREATE FUNCTION public.deliver_trybe_poll_notices(p_limit integer DEFAULT 200) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j record;p posts%ROWTYPE;q trybe_polls%ROWTYPE;m record;scanned integer;total integer:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid notification batch size'; END IF;
 FOR j IN SELECT * FROM trybe_poll_notice_jobs WHERE finished_at IS NULL ORDER BY created_at,poll_id LIMIT 5 FOR UPDATE SKIP LOCKED LOOP
  SELECT * INTO p FROM posts WHERE id=j.poll_id;SELECT * INTO q FROM trybe_polls WHERE post_id=j.poll_id;
  IF p.id IS NULL OR p.is_hidden OR q.closed_at IS NOT NULL OR (q.expires_at IS NOT NULL AND q.expires_at<=clock_timestamp()) THEN UPDATE trybe_poll_notice_jobs SET finished_at=now() WHERE poll_id=j.poll_id;CONTINUE; END IF;
  scanned=0;
  FOR m IN SELECT user_id FROM trybe_memberships WHERE trybe_id=p.trybe AND joined_at<=p.created_at AND (j.cursor_id IS NULL OR user_id>j.cursor_id) ORDER BY user_id LIMIT p_limit-total LOOP
   scanned=scanned+1;total=total+1;
   IF m.user_id<>p.author_id AND account_can_act(m.user_id,false) AND EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=m.user_id AND poll_updates) THEN
    PERFORM notify_account(m.user_id,'trybe-poll:'||p.id,'poll',p.author_name||' posted a new poll: '||q.question,'/trybes?poll='||p.id);
   END IF;
   UPDATE trybe_poll_notice_jobs SET cursor_id=m.user_id WHERE poll_id=j.poll_id;
  END LOOP;
  IF scanned=0 OR NOT EXISTS(SELECT 1 FROM trybe_memberships WHERE trybe_id=p.trybe AND joined_at<=p.created_at AND user_id>(SELECT cursor_id FROM trybe_poll_notice_jobs WHERE poll_id=j.poll_id)) THEN UPDATE trybe_poll_notice_jobs SET finished_at=now() WHERE poll_id=j.poll_id; END IF;
  IF total>=p_limit THEN EXIT; END IF;
 END LOOP;RETURN total;
END $$;
-- No direct reads are granted on poll tables, including individual ballots to admins.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['trybe_polls','trybe_poll_options','trybe_poll_ballots','trybe_poll_choices','trybe_poll_notice_jobs'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
-- The reserved post kind prevents client updates without reading private tables.
CREATE FUNCTION public.guard_poll_post() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user IN ('anon','authenticated') AND (lower(NEW.kind)='poll' OR (TG_OP='UPDATE' AND lower(OLD.kind)='poll')) THEN RAISE EXCEPTION 'Use transactional poll actions; polls cannot move or change visibility'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER trybe_poll_post_guard BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_poll_post();
REVOKE ALL ON FUNCTION public.poll_owner(text),public.poll_member(text),public.poll_view(uuid),public.poll_owned_trybes(),public.read_trybe_polls(uuid[]),public.save_trybe_poll(text,text,text,text[],integer,timestamptz,boolean,boolean,uuid,integer),public.vote_trybe_poll(uuid,uuid[],integer),public.close_trybe_poll(uuid,text),public.deliver_trybe_poll_notices(integer),public.guard_poll_post() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.poll_owned_trybes(),public.save_trybe_poll(text,text,text,text[],integer,timestamptz,boolean,boolean,uuid,integer),public.vote_trybe_poll(uuid,uuid[],integer),public.close_trybe_poll(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_trybe_polls(uuid[]) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_trybe_poll_notices(integer) TO service_role;
COMMIT;
