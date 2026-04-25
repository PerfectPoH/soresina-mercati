-- ============================================================
-- FEATURES MIGRATION: blocco manuale stalls + waitlist
-- ============================================================
-- Esegui nell'SQL Editor di Supabase DOPO auth-migration.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. BLOCCO MANUALE DELLE BANCARELLE
-- ------------------------------------------------------------
-- Un posteggio puo' essere bloccato dall'admin (es. danneggiato,
-- riservato per organizzatori) anche senza una prenotazione vera.
alter table stalls
  add column if not exists blocked        boolean not null default false,
  add column if not exists blocked_reason text;

create index if not exists stalls_blocked_idx on stalls(blocked);

-- Ricrea la view includendo lo stato "blocked" (priorita' su busy/free)
drop view if exists stalls_with_status;
create or replace view stalls_with_status as
select
  s.*,
  e.title        as event_title,
  e.date         as event_date,
  e.price_per_stall as default_price,
  b.id           as booking_id,
  b.vendor_name,
  b.vendor_phone,
  b.goods_type,
  b.status       as booking_status,
  case
    when s.blocked = true                              then 'blocked'
    when b.id is not null and b.status = 'confirmed'   then 'busy'
    else 'free'
  end            as stall_status
from stalls s
join events e on e.id = s.event_id
left join bookings b on b.stall_id = s.id and b.status = 'confirmed';

-- ------------------------------------------------------------
-- 2. LISTA D'ATTESA
-- ------------------------------------------------------------
-- Quando un evento e' pieno, i venditori si possono mettere in
-- coda. Posizione = ordine di created_at.
create table if not exists waitlist (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id)    on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  vendor_name  text not null,
  vendor_phone text,
  vendor_email text,
  goods_type   text not null,
  notes        text,
  created_at   timestamptz default now(),
  unique (event_id, user_id)
);

create index if not exists waitlist_event_idx on waitlist(event_id, created_at);

alter table waitlist enable row level security;

drop policy if exists "waitlist_self_read"   on waitlist;
drop policy if exists "waitlist_self_insert" on waitlist;
drop policy if exists "waitlist_self_delete" on waitlist;
drop policy if exists "waitlist_admin_all"   on waitlist;

create policy "waitlist_self_read" on waitlist
  for select using (user_id = auth.uid() or public.is_admin());

create policy "waitlist_self_insert" on waitlist
  for insert with check (user_id = auth.uid());

create policy "waitlist_self_delete" on waitlist
  for delete using (user_id = auth.uid() or public.is_admin());

grant select, insert, delete on waitlist to authenticated;
