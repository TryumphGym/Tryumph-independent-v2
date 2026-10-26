-- Idempotency/audit trail for signed network settlements (never expose write to clients).
create table if not exists public.ad_settlement_events (
  id uuid primary key default gen_random_uuid(),
  network text not null,
  network_event_id text not null,
  video_id uuid not null,
  trainer_id uuid not null references auth.users(id),
  break_second integer not null check (break_second >= 0),
  gross_cents integer not null check (gross_cents >= 0),
  fee_cents integer not null check (fee_cents >= 0 and fee_cents <= gross_cents),
  created_at timestamptz not null default now(),
  unique(network, network_event_id)
);
alter table public.ad_settlement_events enable row level security;
revoke all on public.ad_settlement_events from anon, authenticated;
