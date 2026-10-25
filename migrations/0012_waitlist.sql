CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'parent' CHECK (role IN ('parent','coach')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.waitlist_entries TO anon, authenticated;
GRANT SELECT ON public.waitlist_entries TO authenticated;
GRANT ALL ON public.waitlist_entries TO service_role;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can join" ON public.waitlist_entries FOR INSERT TO anon, authenticated
  WITH CHECK (length(email) BETWEEN 5 AND 254 AND email LIKE '%_@_%._%');
CREATE POLICY "admin read" ON public.waitlist_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));