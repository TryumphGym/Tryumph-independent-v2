-- Apply after 0025. Cloudflare R2 file keys are private. Bunny imports go to pending review.
ALTER TABLE public.live_recordings ADD COLUMN IF NOT EXISTS object_key text;
ALTER TABLE public.live_recordings ADD COLUMN IF NOT EXISTS bunny_guid text;
ALTER TABLE public.live_recordings ADD COLUMN IF NOT EXISTS trainer_video_id uuid REFERENCES public.trainer_videos(id);
ALTER TABLE public.live_recordings ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'pending'
 CHECK(import_status IN ('pending','importing','ready','failed'));
CREATE INDEX IF NOT EXISTS live_recordings_session_idx ON public.live_recordings(session_id);
