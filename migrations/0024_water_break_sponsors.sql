-- First-party direct sponsor campaigns; payment and settlement must be reconciled by staff.
create table if not exists public.water_break_impressions (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.water_break_campaigns(id),
 video_id uuid not null references public.trainer_videos(id),
 playback_id uuid not null, break_second integer not null check(break_second>=0),
 recorded_at timestamptz not null default now(),
 unique(campaign_id,video_id,playback_id,break_second)
);
alter table public.water_break_campaigns enable row level security;
alter table public.water_break_impressions enable row level security;
revoke all on public.water_break_campaigns,public.water_break_impressions from anon,authenticated;
create or replace function public.record_water_break_impression(p_campaign_id uuid,p_video_id uuid,p_break_second integer,p_playback_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists (select 1 from public.water_break_campaigns where id=p_campaign_id and active and (start_at is null or start_at<=now()) and (end_at is null or end_at>=now())) then raise exception 'Inactive campaign'; end if;
 if not exists (select 1 from public.trainer_videos where id=p_video_id and review_status='approved' and p_break_second = any(breaks)) then raise exception 'Unapproved video'; end if;
 insert into public.water_break_impressions(campaign_id,video_id,break_second,playback_id)
 values(p_campaign_id,p_video_id,p_break_second,p_playback_id) on conflict do nothing;
end $$;
revoke all on function public.record_water_break_impression(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.record_water_break_impression(uuid,uuid,integer,uuid) to service_role;
