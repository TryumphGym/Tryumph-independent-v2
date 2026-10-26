-- Apply in the SQL phase after confirming public.live_sessions exists.
-- Metadata only: do not publish recordings until the trainer submits a video for review.
create table if not exists public.live_recordings (
  egress_id text primary key,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  trainer_id uuid not null references auth.users(id),
  status text not null check (status in ('processing','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_recordings_trainer_idx on public.live_recordings(trainer_id);
alter table public.live_recordings enable row level security;
revoke all on public.live_recordings from anon, authenticated;
DROP POLICY IF EXISTS "trainer can read own recording metadata" ON public.live_recordings;
create policy "trainer can read own recording metadata" on public.live_recordings
  for select to authenticated using (trainer_id = auth.uid());
