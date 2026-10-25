CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  trainer_name text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Strength',
  level text NOT NULL DEFAULT 'Beginner',
  starts_at timestamptz NOT NULL,
  minutes int NOT NULL DEFAULT 45,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads live sessions" ON public.live_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "coach inserts own" ON public.live_sessions FOR INSERT TO authenticated WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "coach updates own" ON public.live_sessions FOR UPDATE TO authenticated USING (trainer_id = auth.uid());
CREATE POLICY "coach deletes own" ON public.live_sessions FOR DELETE TO authenticated USING (trainer_id = auth.uid());