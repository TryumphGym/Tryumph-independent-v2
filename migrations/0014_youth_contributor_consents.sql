CREATE TABLE public.youth_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  contributor_name text NOT NULL,
  contributor_age integer NOT NULL,
  guardian_name text NOT NULL,
  guardian_email text NOT NULL,
  guardian_signature text NOT NULL,
  release_agreed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youth_consents TO authenticated;
GRANT ALL ON public.youth_consents TO service_role;
ALTER TABLE public.youth_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read" ON public.youth_consents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own insert pending" ON public.youth_consents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND release_agreed AND contributor_age BETWEEN 8 AND 17);
CREATE POLICY "own delete" ON public.youth_consents FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin update" ON public.youth_consents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));