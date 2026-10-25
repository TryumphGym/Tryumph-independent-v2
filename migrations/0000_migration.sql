CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Member',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','trainer')),
  tokens integer NOT NULL DEFAULT 2,
  height numeric, weight numeric, goal text, level text, prefs text,
  postpartum boolean NOT NULL DEFAULT false,
  dr_gap text, weeks_postpartum text,
  active_days jsonb NOT NULL DEFAULT '[]',
  reservations jsonb NOT NULL DEFAULT '[]',
  joined jsonb NOT NULL DEFAULT '[]',
  watch_later jsonb NOT NULL DEFAULT '[]',
  history jsonb NOT NULL DEFAULT '[]',
  partners jsonb NOT NULL DEFAULT '[]',
  ledger jsonb NOT NULL DEFAULT '[]',
  bookings jsonb NOT NULL DEFAULT '[]',
  weigh_ins jsonb NOT NULL DEFAULT '[]',
  scheduled jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();