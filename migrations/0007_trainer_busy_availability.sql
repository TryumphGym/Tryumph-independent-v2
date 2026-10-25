CREATE TABLE public.trainer_busy (
  trainer_id text NOT NULL,
  day date NOT NULL,
  time text NOT NULL DEFAULT 'ALL',
  source text NOT NULL DEFAULT 'personal',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (trainer_id, day, time)
);

GRANT SELECT ON public.trainer_busy TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trainer_busy TO authenticated;
GRANT ALL ON public.trainer_busy TO service_role;

ALTER TABLE public.trainer_busy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "busy public read" ON public.trainer_busy
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "owner manage own busy" ON public.trainer_busy
  FOR ALL TO authenticated
  USING (trainer_id = auth.uid()::text)
  WITH CHECK (trainer_id = auth.uid()::text);

CREATE INDEX trainer_busy_day_idx ON public.trainer_busy (day);