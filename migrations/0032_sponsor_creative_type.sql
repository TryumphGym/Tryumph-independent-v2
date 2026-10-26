-- Paid direct-sponsor campaigns may show a hosted image or short video at a marked water break.
ALTER TABLE public.water_break_campaigns ADD COLUMN IF NOT EXISTS creative_type text NOT NULL DEFAULT 'image'
 CHECK(creative_type IN ('image','video'));
-- The public RLS policy from 0019 is retained for active campaign discovery;
-- event writes are server-only as defined in 0024.
