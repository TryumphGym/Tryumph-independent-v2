-- Owner admin: grant on signup for the owner email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  IF lower(NEW.email) = 'mackenzie@tryumphgym.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- Rest/water break markers on uploaded videos (seconds)
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.trainer_videos ADD COLUMN IF NOT EXISTS breaks integer[] NOT NULL DEFAULT '{}';

-- Trainer payout accounts (Stripe Connect)
CREATE TABLE public.trainer_accounts (
  user_id uuid PRIMARY KEY,
  slug text UNIQUE,
  stripe_account_id text,
  payouts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trainer_accounts TO authenticated;
GRANT ALL ON public.trainer_accounts TO service_role;
ALTER TABLE public.trainer_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read" ON public.trainer_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Earnings ledger: every amount is after processing fees
CREATE TABLE public.trainer_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_slug text NOT NULL,
  source text NOT NULL CHECK (source IN ('oneonone','live','ads')),
  ref text NOT NULL UNIQUE,
  gross_cents integer NOT NULL,
  fee_cents integer NOT NULL,
  net_cents integer NOT NULL,
  share_pct integer NOT NULL,
  payout_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  transfer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trainer_earnings TO authenticated;
GRANT ALL ON public.trainer_earnings TO service_role;
ALTER TABLE public.trainer_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read" ON public.trainer_earnings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.trainer_accounts a WHERE a.user_id = auth.uid() AND (a.slug = trainer_earnings.trainer_slug OR a.user_id::text = trainer_earnings.trainer_slug)));

-- Push subscriptions + scheduled reminders
CREATE TABLE public.push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.push_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  live_id text NOT NULL,
  body text NOT NULL,
  fire_at timestamptz NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, live_id, fire_at)
);
GRANT SELECT, INSERT, DELETE ON public.push_reminders TO authenticated;
GRANT ALL ON public.push_reminders TO service_role;
ALTER TABLE public.push_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders" ON public.push_reminders FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX push_reminders_due ON public.push_reminders (fire_at) WHERE NOT sent;

-- Private cron token (no API grants), read only by the scheduler and server
CREATE TABLE public.cron_tokens (name text PRIMARY KEY, token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'));
REVOKE ALL ON public.cron_tokens FROM anon, authenticated;
GRANT ALL ON public.cron_tokens TO service_role;
ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.cron_tokens (name) VALUES ('push') ON CONFLICT DO NOTHING;