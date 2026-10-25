ALTER TABLE public.profiles ALTER COLUMN tokens SET DEFAULT 0;
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS equipment text NOT NULL DEFAULT 'none';
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS pregnancy_safe boolean NOT NULL DEFAULT false;
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS playlist text NOT NULL DEFAULT '';
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS break_seconds integer NOT NULL DEFAULT 15;