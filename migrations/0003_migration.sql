create type public.app_role as enum ('admin','moderator','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role public.app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  trainer_name text not null default '',
  name text not null,
  credential_id text not null default '',
  expires text not null default '',
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  note text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.certifications to authenticated; grant update on public.certifications to authenticated; grant all on public.certifications to service_role;
alter table public.certifications enable row level security;
create policy "own or admin read" on public.certifications for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own insert pending" on public.certifications for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "own delete" on public.certifications for delete to authenticated using (user_id = auth.uid());
create policy "admin update" on public.certifications for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.trainer_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  category text not null default '',
  level text not null default '',
  path text not null,
  created_at timestamptz not null default now()
);
grant select on public.trainer_videos to anon; grant select, insert, delete on public.trainer_videos to authenticated; grant all on public.trainer_videos to service_role;
alter table public.trainer_videos enable row level security;
create policy "public read" on public.trainer_videos for select to anon, authenticated using (true);
create policy "own insert" on public.trainer_videos for insert to authenticated with check (user_id = auth.uid());
create policy "own delete" on public.trainer_videos for delete to authenticated using (user_id = auth.uid());