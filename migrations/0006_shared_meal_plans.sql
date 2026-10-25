CREATE TABLE public.meal_plans (
  user_id uuid PRIMARY KEY,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  target jsonb NOT NULL DEFAULT '{"kcal":2000,"protein":110}'::jsonb,
  approved_by text,
  approved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.menu_shares (
  client_id uuid NOT NULL,
  nutritionist_id uuid NOT NULL,
  client_name text NOT NULL DEFAULT 'Client',
  nutritionist_name text NOT NULL DEFAULT 'Nutritionist',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, nutritionist_id)
);
GRANT SELECT, INSERT, UPDATE ON public.meal_plans TO authenticated;
GRANT ALL ON public.meal_plans TO service_role;
GRANT SELECT, DELETE ON public.menu_shares TO authenticated;
GRANT ALL ON public.menu_shares TO service_role;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_menu(_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _client = auth.uid() OR EXISTS (SELECT 1 FROM public.menu_shares WHERE client_id = _client AND nutritionist_id = auth.uid())
$$;

CREATE POLICY "menu read" ON public.meal_plans FOR SELECT TO authenticated USING (public.can_edit_menu(user_id));
CREATE POLICY "menu insert" ON public.meal_plans FOR INSERT TO authenticated WITH CHECK (public.can_edit_menu(user_id));
CREATE POLICY "menu update" ON public.meal_plans FOR UPDATE TO authenticated USING (public.can_edit_menu(user_id)) WITH CHECK (public.can_edit_menu(user_id));

CREATE POLICY "share read" ON public.menu_shares FOR SELECT TO authenticated USING (client_id = auth.uid() OR nutritionist_id = auth.uid());
CREATE POLICY "share delete" ON public.menu_shares FOR DELETE TO authenticated USING (client_id = auth.uid() OR nutritionist_id = auth.uid());

-- Client shares their menu using the nutritionist's 8-character code.
CREATE OR REPLACE FUNCTION public.share_menu(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n record; me record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF length(trim(_code)) < 8 THEN RAISE EXCEPTION 'Code not found'; END IF;
  SELECT id, name INTO n FROM public.profiles WHERE role = 'trainer' AND lower(left(id::text, 8)) = lower(trim(_code)) LIMIT 1;
  IF n.id IS NULL THEN RAISE EXCEPTION 'Code not found'; END IF;
  IF n.id = auth.uid() THEN RAISE EXCEPTION 'That is your own code'; END IF;
  SELECT name INTO me FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.menu_shares (client_id, nutritionist_id, client_name, nutritionist_name)
  VALUES (auth.uid(), n.id, COALESCE(me.name, 'Client'), n.name) ON CONFLICT DO NOTHING;
  INSERT INTO public.meal_plans (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  RETURN n.name;
END $$;
REVOKE ALL ON FUNCTION public.share_menu(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.share_menu(text) TO authenticated;