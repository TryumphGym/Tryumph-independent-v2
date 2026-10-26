-- Missing contract from the historical source snapshot. Run before 0019.
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS issuing_organization text;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS document_path text;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id);
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
 CHECK(review_status IN ('pending','approved','rejected'));
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT '';
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS required_equipment text[];
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS optional_equipment text[];
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS spotify_url text;
GRANT UPDATE ON public.trainer_videos TO authenticated;
CREATE OR REPLACE FUNCTION public.review_trainer_video(p_video_id uuid,p_status text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid review'; END IF;
 IF EXISTS(SELECT 1 FROM public.trainer_videos WHERE id=p_video_id AND user_id=auth.uid())
 THEN RAISE EXCEPTION 'Self approval is prohibited'; END IF;
 UPDATE public.trainer_videos SET review_status=p_status,review_note=left(p_note,2000),
 reviewed_at=now(),reviewed_by=auth.uid() WHERE id=p_video_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Video not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_trainer_video(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_trainer_video(uuid,text,text) TO authenticated;
