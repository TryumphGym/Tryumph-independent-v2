DROP POLICY IF EXISTS "own insert" ON public.trainer_videos;
CREATE POLICY "own insert" ON public.trainer_videos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.youth_consents y WHERE y.user_id = auth.uid() AND y.status <> 'approved'));