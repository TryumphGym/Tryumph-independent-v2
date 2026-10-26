-- Validate creator metadata even on direct REST requests.
CREATE OR REPLACE FUNCTION public.guard_workout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b integer; previous integer := -300;
BEGIN
 IF length(trim(NEW.title)) NOT BETWEEN 1 AND 180 OR length(NEW.description)>4000
 OR NEW.break_seconds NOT IN (0,15,30) THEN RAISE EXCEPTION 'Invalid workout metadata'; END IF;
 IF NEW.spotify_url IS NOT NULL AND NEW.spotify_url !~ '^https://open[.]spotify[.]com/playlist/[A-Za-z0-9]+([?].*)?$' THEN RAISE EXCEPTION 'Invalid Spotify playlist'; END IF;
 IF NEW.minutes<1 OR NEW.minutes>300 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 FOR b IN SELECT unnest(NEW.breaks) ORDER BY 1 LOOP
  IF b<180 OR b>NEW.minutes*60-120 OR b-previous<300 THEN RAISE EXCEPTION 'Invalid water break'; END IF;
  previous=b;
 END LOOP;
 IF current_setting('role',true)='authenticated' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.review_status<>'pending' OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL
    OR NEW.review_note<>'' OR NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Videos require review'; END IF;
   IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer') THEN RAISE EXCEPTION 'Trainer account required'; END IF;
   IF NEW.path LIKE 'bunny:%' THEN
    IF NOT EXISTS(SELECT 1 FROM video_uploads WHERE guid::text=split_part(NEW.path,':',3)
      AND library_id=split_part(NEW.path,':',2) AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Unknown upload ownership'; END IF;
   ELSIF split_part(NEW.path,'/',1)<>auth.uid()::text THEN RAISE EXCEPTION 'Invalid video owner'; END IF;
  ELSE
   IF NEW.user_id<>OLD.user_id OR NEW.path<>OLD.path THEN RAISE EXCEPTION 'Cannot reassign media'; END IF;
   IF NOT public.has_role(auth.uid(),'admin') THEN
    IF (NEW.review_status,NEW.reviewed_at,NEW.reviewed_by,NEW.review_note) IS DISTINCT FROM
      (OLD.review_status,OLD.reviewed_at,OLD.reviewed_by,OLD.review_note) THEN RAISE EXCEPTION 'Admins review videos'; END IF;
    NEW.review_status='pending'; NEW.reviewed_at=NULL; NEW.reviewed_by=NULL; NEW.review_note='';
   ELSIF OLD.user_id=auth.uid() THEN RAISE EXCEPTION 'Cannot review own video'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
