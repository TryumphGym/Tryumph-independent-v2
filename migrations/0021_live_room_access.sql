-- Run later in Supabase, after verifying live_sessions schema and booking/payment integration.
create table if not exists public.live_room_access (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text,
  status text not null default 'pending' check (status in ('pending','paid','refunded','cancelled')),
  created_at timestamptz not null default now(),
  unique(session_id,user_id)
);
create unique index if not exists live_room_access_checkout_unique
  on public.live_room_access(stripe_checkout_session_id) where stripe_checkout_session_id is not null;
alter table public.live_room_access enable row level security;
revoke all on public.live_room_access from anon, authenticated;
create policy "Members can see own room access" on public.live_room_access for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.live_room_access to authenticated;
-- Only a verified server-side payment handler (service role) may mark status paid.
