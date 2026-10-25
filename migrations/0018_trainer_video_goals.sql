ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS goals text[] NOT NULL DEFAULT ARRAY[]::text[];
