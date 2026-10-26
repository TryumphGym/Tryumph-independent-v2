-- Apply later in Supabase SQL editor, after reviewing against the production schema.
-- Trainer-owned external stores: Tryumph takes no commission.
create table if not exists public.trainer_store_items (
 id uuid primary key default gen_random_uuid(), trainer_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 160),
 description text not null default '', price_cents integer not null default 0 check (price_cents >= 0),
 image_url text, external_url text not null check (external_url ~ '^https://'),
 item_type text not null default 'product' check (item_type in ('product','affiliate','external_store')),
 published boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists trainer_store_items_owner_idx on public.trainer_store_items(trainer_id);
alter table public.trainer_store_items enable row level security;
DROP POLICY IF EXISTS "store public published" ON public.trainer_store_items;
create policy "store public published" on public.trainer_store_items for select to anon,authenticated using (published);
DROP POLICY IF EXISTS "store owner read" ON public.trainer_store_items;
create policy "store owner read" on public.trainer_store_items for select to authenticated using (trainer_id=auth.uid());
DROP POLICY IF EXISTS "store owner insert" ON public.trainer_store_items;
create policy "store owner insert" on public.trainer_store_items for insert to authenticated with check (trainer_id=auth.uid());
DROP POLICY IF EXISTS "store owner update" ON public.trainer_store_items;
create policy "store owner update" on public.trainer_store_items for update to authenticated using (trainer_id=auth.uid()) with check (trainer_id=auth.uid());
DROP POLICY IF EXISTS "store owner delete" ON public.trainer_store_items;
create policy "store owner delete" on public.trainer_store_items for delete to authenticated using (trainer_id=auth.uid());

-- Ordered programs are separate from loose playlist tags.
create table if not exists public.trainer_programs (
 id uuid primary key default gen_random_uuid(), trainer_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 160), description text not null default '',
 published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.trainer_program_workouts (
 program_id uuid not null references public.trainer_programs(id) on delete cascade,
 video_id uuid not null references public.trainer_videos(id) on delete cascade,
 position integer not null check (position >= 0), primary key(program_id,video_id),unique(program_id,position)
);
alter table public.trainer_programs enable row level security;
alter table public.trainer_program_workouts enable row level security;
DROP POLICY IF EXISTS "programs public" ON public.trainer_programs;
create policy "programs public" on public.trainer_programs for select to anon,authenticated using (published);
DROP POLICY IF EXISTS "programs owner read" ON public.trainer_programs;
create policy "programs owner read" on public.trainer_programs for select to authenticated using (trainer_id=auth.uid());
DROP POLICY IF EXISTS "programs owner insert" ON public.trainer_programs;
create policy "programs owner insert" on public.trainer_programs for insert to authenticated with check (trainer_id=auth.uid());
DROP POLICY IF EXISTS "programs owner update" ON public.trainer_programs;
create policy "programs owner update" on public.trainer_programs for update to authenticated using (trainer_id=auth.uid()) with check (trainer_id=auth.uid());
DROP POLICY IF EXISTS "programs owner delete" ON public.trainer_programs;
create policy "programs owner delete" on public.trainer_programs for delete to authenticated using (trainer_id=auth.uid());
DROP POLICY IF EXISTS "program workouts read" ON public.trainer_program_workouts;
create policy "program workouts read" on public.trainer_program_workouts for select to anon,authenticated using (exists (select 1 from public.trainer_programs p where p.id=program_id and (p.published or p.trainer_id=auth.uid())));
DROP POLICY IF EXISTS "program workouts insert" ON public.trainer_program_workouts;
create policy "program workouts insert" on public.trainer_program_workouts for insert to authenticated with check (exists(select 1 from public.trainer_programs p join public.trainer_videos v on v.id=video_id where p.id=program_id and p.trainer_id=auth.uid() and v.user_id=auth.uid()));
DROP POLICY IF EXISTS "program workouts delete" ON public.trainer_program_workouts;
create policy "program workouts delete" on public.trainer_program_workouts for delete to authenticated using (exists(select 1 from public.trainer_programs p where p.id=program_id and p.trainer_id=auth.uid()));
DROP POLICY IF EXISTS "program workouts update" ON public.trainer_program_workouts;
create policy "program workouts update" on public.trainer_program_workouts for update to authenticated using (exists(select 1 from public.trainer_programs p where p.id=program_id and p.trainer_id=auth.uid())) with check (exists(select 1 from public.trainer_programs p where p.id=program_id and p.trainer_id=auth.uid()));

-- Campaigns are enabled only after ad creatives and sponsorship agreements are approved.
create table if not exists public.water_break_campaigns (
 id uuid primary key default gen_random_uuid(), title text not null, creative_url text not null,
 destination_url text not null, active boolean not null default false,
 start_at timestamptz, end_at timestamptz, created_at timestamptz not null default now()
);
alter table public.water_break_campaigns enable row level security;
DROP POLICY IF EXISTS "active campaign public" ON public.water_break_campaigns;
create policy "active campaign public" on public.water_break_campaigns for select to anon,authenticated using (active and (start_at is null or start_at<=now()) and (end_at is null or end_at>=now()));
create table if not exists public.water_break_events (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.water_break_campaigns(id),
 video_id uuid not null references public.trainer_videos(id), viewer_id uuid references auth.users(id),
 break_second integer not null check (break_second>=180), event_type text not null check (event_type in ('start','complete','click')),
 created_at timestamptz not null default now()
);
alter table public.water_break_events enable row level security;
-- Event writes are handled by authenticated server routes, never client direct INSERT.

-- Live eligibility database enforcement is in the separate 0019_live_eligibility_guard.sql patch.
