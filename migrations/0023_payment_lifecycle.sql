-- Apply later after schema review. All functions are service-role only.
create table if not exists public.checkout_payment_state (
  checkout_id text primary key,
  kind text not null check (kind in ('tokens','booking','live')),
  user_id uuid not null references auth.users(id),
  gross_cents integer not null check (gross_cents >= 0),
  fee_cents integer not null check (fee_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  quantity integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.checkout_payment_state enable row level security;
revoke all on public.checkout_payment_state from anon, authenticated;

create or replace function public.apply_paid_token_checkout(p_checkout_id text,p_user_id uuid,p_tokens integer,p_gross_cents integer,p_fee_cents integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tokens not between 1 and 100 or p_gross_cents < 0 or p_fee_cents < 0 then raise exception 'Invalid checkout'; end if;
  insert into public.checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents,quantity)
  values(p_checkout_id,'tokens',p_user_id,p_gross_cents,p_fee_cents,p_tokens)
  on conflict do nothing;
  if not found then return; end if;
  update public.profiles set tokens=tokens+p_tokens,
    ledger=jsonb_build_array(jsonb_build_object('id',p_checkout_id,'label','Bought '||p_tokens||' tokens','tokens',p_tokens,'date',current_date,'netPerToken',(p_gross_cents-p_fee_cents)/p_tokens)) || ledger
  where id=p_user_id;
  if not found then raise exception 'Profile not found'; end if;
end $$;

create or replace function public.apply_paid_private_booking(p_checkout_id text,p_user_id uuid,p_trainer_id text,p_day text,p_time text,p_gross_cents integer,p_fee_cents integer,p_trainer_cents integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_day !~ '^\d{4}-\d{2}-\d{2}$' or p_time !~ '^\d{2}:\d{2}$' or p_gross_cents < p_fee_cents or p_trainer_cents < 0 then raise exception 'Invalid booking'; end if;
  insert into public.checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents)
  values(p_checkout_id,'booking',p_user_id,p_gross_cents,p_fee_cents)
  on conflict do nothing;
  if not found then return; end if;
  insert into public.trainer_busy(trainer_id,day,time,source)
  values(p_trainer_id,p_day::date,p_time,'booked');
  update public.profiles set bookings=jsonb_build_array(jsonb_build_object('id',p_checkout_id,'trainerId',p_trainer_id,'date',p_day,'time',p_time,'price',p_gross_cents/100.0,'paid',true)) || bookings
  where id=p_user_id;
  if not found then raise exception 'Profile not found'; end if;
  insert into public.trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
  values(p_trainer_id,'oneonone',p_checkout_id,p_gross_cents,p_fee_cents,p_gross_cents-p_fee_cents,90,p_trainer_cents)
  on conflict(ref) do nothing;
end $$;

create or replace function public.apply_paid_live_checkout(p_checkout_id text,p_user_id uuid,p_session_id uuid,p_gross_cents integer,p_fee_cents integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_trainer text;
begin
  if p_gross_cents < p_fee_cents then raise exception 'Invalid fees'; end if;
  select trainer_id::text into v_trainer from public.live_sessions where id=p_session_id;
  if v_trainer is null then raise exception 'Unknown session'; end if;
  insert into public.checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents)
  values(p_checkout_id,'live',p_user_id,p_gross_cents,p_fee_cents)
  on conflict do nothing;
  if not found then return; end if;
  insert into public.live_room_access(session_id,user_id,stripe_checkout_session_id,status)
  values(p_session_id,p_user_id,p_checkout_id,'paid')
  on conflict(session_id,user_id) do update set status='paid',stripe_checkout_session_id=excluded.stripe_checkout_session_id;
  insert into public.trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
  values(v_trainer,'live',p_checkout_id,p_gross_cents,p_fee_cents,p_gross_cents-p_fee_cents,50,(p_gross_cents-p_fee_cents)/2)
  on conflict(ref) do nothing;
end $$;

-- Refunds are cumulative per checkout. Full refunds revoke access and reverse untransferred earnings.
create or replace function public.apply_checkout_refund(p_checkout_id text,p_refund_cents integer,p_fully_refunded boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v public.checkout_payment_state%rowtype;
begin
  select * into v from public.checkout_payment_state where checkout_id=p_checkout_id for update;
  if not found then return; end if;
  if p_refund_cents <= v.refunded_cents then return; end if;
  update public.checkout_payment_state set refunded_cents=p_refund_cents where checkout_id=p_checkout_id;
  if p_fully_refunded then
    if v.kind='tokens' then
      update public.profiles set tokens=greatest(0,tokens-v.quantity) where id=v.user_id;
    elsif v.kind='booking' then
      delete from public.trainer_busy where source='booked' and (trainer_id,day,time) in
        (select b->>'trainerId',(b->>'date')::date,b->>'time' from public.profiles p,
          lateral jsonb_array_elements(p.bookings) b where p.id=v.user_id and b->>'id'=p_checkout_id);
      update public.profiles set bookings=(select coalesce(jsonb_agg(b),'[]'::jsonb) from jsonb_array_elements(bookings) b where b->>'id'<>p_checkout_id) where id=v.user_id;
    elsif v.kind='live' then
      update public.live_room_access set status='refunded' where stripe_checkout_session_id=p_checkout_id;
    end if;
    delete from public.trainer_earnings where ref=p_checkout_id and status='pending';
  end if;
end $$;

revoke all on function public.apply_paid_token_checkout(text,uuid,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.apply_paid_private_booking(text,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.apply_paid_live_checkout(text,uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.apply_checkout_refund(text,integer,boolean) from public,anon,authenticated;
grant execute on function public.apply_paid_token_checkout(text,uuid,integer,integer,integer) to service_role;
grant execute on function public.apply_paid_private_booking(text,uuid,text,text,text,integer,integer,integer) to service_role;
grant execute on function public.apply_paid_live_checkout(text,uuid,uuid,integer,integer) to service_role;
grant execute on function public.apply_checkout_refund(text,integer,boolean) to service_role;
