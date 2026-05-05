-- ============================================================
-- SCHEMA UNIFICATO — Mercati Soresina
-- ============================================================
-- Source of truth: stato reale del DB di produzione (project
-- ddqwutxocznggfmrzzkw, region eu-north-1) al 2026-04-25.
--
-- Questo file e' idempotente: ogni statement usa `if not exists`
-- o `or replace`. Eseguibile da zero su un nuovo DB Supabase
-- per ricreare l'intero schema applicativo.
--
-- Storia delle migrazioni applicate (in supabase/migrations-archive/):
--   01 schema iniziale (events, stalls, bookings, view base)
--   02 RLS base
--   03 fix RLS view (security definer functions)
--   04 vendors + auth + is_admin()
--   05 features (blocked stalls + waitlist)
--   06 security tightening + audit log
--   07 fix stalls public read policy
--   08 GDPR (delete_my_account, anonymize, purge audit)
--   09 realtime publication
--   10 events.image_url
--   11 stalls/events geo coords + view con LATERAL join
--   12 harden function search_path
--   13 stripe_events_seen (idempotency webhook)         [supabase/migrations/]
--   14 pg_cron GC pending bookings                        [supabase/migrations/]
--
-- Vedi anche: docs/OPERATIONS.md per backup/restore.
-- ============================================================

-- Necessario per gen_random_uuid() su DB nuovi.
create extension if not exists pgcrypto;

-- ============================================================
-- 1. TABELLE
-- ============================================================

-- 1.1 vendors — profilo utente (estende auth.users)
create table if not exists vendors (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  email              text not null,
  name               text not null,
  phone              text not null,
  primary_goods_type text not null,
  vat_number         text,
  role               text not null default 'vendor' check (role in ('vendor','admin')),
  consent_at         timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists vendors_role_idx on vendors(role);

-- 1.2 events — singolo mercato/sagra
create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  date            date not null,
  location        text not null default 'Piazza Garibaldi, Soresina',
  rows            int  not null default 5,
  cols            int  not null default 8,
  price_per_stall numeric(6,2) not null default 35.00,
  active          boolean not null default true,
  image_url       text,
  map_lat         numeric(9,6) default 45.2872,
  map_lng         numeric(9,6) default 9.8572,
  map_zoom        int          default 19,
  created_at      timestamptz default now()
);

-- 1.3 stalls — singolo posteggio
create table if not exists stalls (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid references events(id) on delete cascade,
  label          text not null,
  row_idx        int  not null,
  col_idx        int  not null,
  price          numeric(6,2),
  notes          text,
  blocked        boolean not null default false,
  blocked_reason text,
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  created_at     timestamptz default now(),
  unique (event_id, label)
);

create index if not exists stalls_event_id_idx on stalls(event_id);
create index if not exists stalls_blocked_idx  on stalls(blocked);

-- 1.4 bookings — prenotazioni
create table if not exists bookings (
  id           uuid primary key default gen_random_uuid(),
  stall_id     uuid references stalls(id) on delete cascade,
  event_id     uuid references events(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  vendor_name  text not null,
  vendor_phone text,
  vendor_email text,
  goods_type   text not null,
  status       text not null default 'confirmed'
    check (status in ('confirmed','cancelled','pending')),
  notes        text,
  -- Stripe (BUG-033 + smoke test)
  stripe_session_id          text,
  stripe_payment_intent_id   text,
  -- Cancellation request flow (BUG-033)
  cancellation_requested_at  timestamptz,
  cancellation_reason        text,
  -- Waitlist promotion flow (BUG-041): se true, il booking nasce da una
  -- promozione della lista d'attesa e ha 24h per essere confermato (pagato).
  -- Scaduto, il cron release_expired_waitlist_promotions lo cancella e
  -- promuove il successivo dalla lista.
  from_waitlist              boolean not null default false,
  waitlist_promoted_at       timestamptz,
  -- Admin force-cancel flow (BUG-045): motivo + se rimborsato + quando.
  -- Distinto da cancellation_reason (che e' invece il motivo passato
  -- dall'utente quando RICHIEDE la cancellazione).
  admin_cancel_reason        text,
  admin_refunded             boolean,
  admin_cancelled_at         timestamptz,
  -- BUG-047: snapshot del prezzo al momento della prenotazione, immutabile.
  -- Una volta creato il booking, paid_price NON cambia anche se l'admin
  -- modifica events.price_per_stall o stalls.price in seguito. Dashboard
  -- "incasso stimato" e ogni UI di lettura usano questa colonna come
  -- fonte di verita' invece di ricalcolare live.
  paid_price                 numeric(10,2),
  created_at                 timestamptz default now()
);

create index if not exists bookings_stall_id_idx on bookings(stall_id);
create index if not exists bookings_event_id_idx on bookings(event_id);
create index if not exists bookings_user_id_idx  on bookings(user_id);

-- Vincolo: una sola booking 'confirmed' per stall (rete di sicurezza
-- contro race condition nel flusso di prenotazione).
create unique index if not exists bookings_one_confirmed_per_stall
  on bookings(stall_id) where status = 'confirmed';

-- 1.5 waitlist — lista d'attesa
-- stall_id (BUG-041): NULL = lista generale dell'evento, valorizzato = lista
-- specifica per quel posto. La promozione (`promote_next_waitlist`) da'
-- priorita' a chi ha targetato lo specifico posto, poi alla lista generale.
create table if not exists waitlist (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  stall_id     uuid     references stalls(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  vendor_name  text not null,
  vendor_phone text,
  vendor_email text,
  goods_type   text not null,
  notes        text,
  created_at   timestamptz default now(),
  unique (event_id, user_id)
);

create index if not exists waitlist_event_idx on waitlist(event_id, created_at);
create index if not exists waitlist_stall_idx on waitlist(stall_id) where stall_id is not null;

-- 1.6 audit_log — chi ha fatto cosa
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  row_id      uuid,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  user_id     uuid,
  user_email  text,
  changes     jsonb,
  created_at  timestamptz default now()
);

create index if not exists audit_log_table_idx on audit_log(table_name, created_at desc);
create index if not exists audit_log_user_idx  on audit_log(user_id, created_at desc);

-- 1.7 stripe_events_seen — idempotency webhook Stripe
create table if not exists stripe_events_seen (
  id           text primary key,
  type         text,
  processed_at timestamptz not null default now()
);

create index if not exists stripe_events_seen_processed_at_idx
  on stripe_events_seen(processed_at desc);

-- ============================================================
-- 2. FUNZIONI E TRIGGER
-- ============================================================

-- 2.1 is_admin() — usata in tutte le RLS policy
create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from vendors
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- 2.2 stall_status_of() / stall_vendor_name() — security definer helpers.
-- Storicamente usate dalla view per bypassare RLS in sicurezza. Oggi la
-- view usa LATERAL join (vedi §3) ma le funzioni restano disponibili
-- come API server-side (sono chiamate da alcune API route).
create or replace function public.stall_status_of(p_stall_id uuid)
returns text
language sql
stable security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from bookings
      where stall_id = p_stall_id and status = 'confirmed'
    ) then 'busy'
    else 'free'
  end;
$$;

create or replace function public.stall_vendor_name(p_stall_id uuid)
returns text
language sql
stable security definer
set search_path = public
as $$
  select vendor_name from bookings
  where stall_id = p_stall_id and status = 'confirmed'
  limit 1;
$$;

grant execute on function public.stall_status_of(uuid)   to anon, authenticated;
grant execute on function public.stall_vendor_name(uuid) to anon, authenticated;

-- 2.3 vendors_touch — updated_at su vendors
create or replace function public.vendors_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists vendors_touch_trigger on vendors;
create trigger vendors_touch_trigger
  before update on vendors
  for each row execute function public.vendors_touch();

-- 2.4 enforce_booking_limit — max 2 bookings (confirmed+pending) per evento.
-- Conta anche pending per evitare bypass via Stripe (BUG-030):
-- senza, l'utente faceva 2 confirmed + 1 pending → pagava → webhook
-- bloccato dal trigger su pending→confirmed → silent failure + addebito.
-- Gli admin sono esenti.
create or replace function public.enforce_booking_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  current_count int;
begin
  if NEW.status in ('confirmed','pending') and NEW.user_id is not null and not public.is_admin() then
    select count(*) into current_count
      from bookings
      where user_id  = NEW.user_id
        and event_id = NEW.event_id
        and status in ('confirmed','pending')
        and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    if current_count >= 2 then
      raise exception 'Hai raggiunto il limite di 2 posteggi per questo evento'
        using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists bookings_limit_trigger on bookings;
create trigger bookings_limit_trigger
  before insert or update on bookings
  for each row execute function public.enforce_booking_limit();

-- 2.5 audit_trigger — registra ogni modifica su events/stalls/bookings
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid;
  v_user_email text;
  v_row_id     uuid;
  v_changes    jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is not null then
    select email into v_user_email from auth.users where id = v_user_id;
  end if;

  if TG_OP = 'DELETE' then
    v_row_id  := OLD.id;
    v_changes := jsonb_build_object('old', to_jsonb(OLD));
  elsif TG_OP = 'UPDATE' then
    v_row_id  := NEW.id;
    v_changes := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  else
    v_row_id  := NEW.id;
    v_changes := jsonb_build_object('new', to_jsonb(NEW));
  end if;

  insert into audit_log (table_name, row_id, action, user_id, user_email, changes)
  values (TG_TABLE_NAME, v_row_id, TG_OP, v_user_id, v_user_email, v_changes);

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists events_audit   on events;
drop trigger if exists stalls_audit   on stalls;
drop trigger if exists bookings_audit on bookings;
create trigger events_audit   after insert or update or delete on events   for each row execute function public.audit_trigger();
create trigger stalls_audit   after insert or update or delete on stalls   for each row execute function public.audit_trigger();
create trigger bookings_audit after insert or update or delete on bookings for each row execute function public.audit_trigger();

-- 2.6 GDPR helpers
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from waitlist where user_id = v_uid;
  delete from bookings where user_id = v_uid;
  delete from vendors  where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

create or replace function public.anonymize_old_bookings(older_than interval default '2 years')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update bookings b
     set user_id      = null,
         vendor_name  = 'Anonimizzato',
         vendor_phone = null,
         vendor_email = null,
         notes        = null
    from events e
   where b.event_id = e.id
     and e.date < (now() - older_than)::date
     and b.vendor_name <> 'Anonimizzato';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.purge_old_audit_log()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from audit_log where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 2.7 generate_stalls — popola la griglia di stall per un evento
create or replace function public.generate_stalls(p_event_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  ev record;
  r int; c int;
  row_letter text;
  v_label text;
begin
  select rows, cols into ev from events where id = p_event_id;
  for r in 0..(ev.rows - 1) loop
    row_letter := chr(65 + r);  -- A, B, C, ...
    for c in 1..ev.cols loop
      v_label := row_letter || lpad(c::text, 2, '0');
      insert into stalls (event_id, label, row_idx, col_idx)
      values (p_event_id, v_label, r, c - 1)
      on conflict (event_id, label) do nothing;
    end loop;
  end loop;
end;
$$;

-- 2.8 release_expired_pending_bookings — GC cron Stripe (vedi 14_)
-- BUG-051 (Codex audit 2026-05-04): esclude `from_waitlist=true` perche'
-- i pending nati da promote_next_waitlist hanno TTL di 24h gestito dal
-- cron dedicato `release_expired_waitlist_promotions` (migration 19).
create or replace function public.release_expired_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update bookings
    set status = 'cancelled'
    where status = 'pending'
      and created_at < now() - interval '15 minutes'
      and coalesce(from_waitlist, false) = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 2.9 archive_past_events — auto-archive (BUG-039, vedi 19_)
-- Cron pg_cron alle 03:15 setta active=false per gli eventi passati.
create or replace function public.archive_past_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update events set active = false where active = true and date < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 2.10 promote_next_waitlist — promozione flow (BUG-041, BUG-047 follow-up)
-- Quando un posto si libera, promuove il primo della lista d'attesa
-- (priorita' a chi e' iscritto a quel posto specifico, poi lista generale,
-- FIFO per created_at). Crea booking pending con waitlist_promoted_at=now()
-- e paid_price snapshottato al momento della promozione.
-- Se l'utente e' al limite (P0001), salta e prova il successivo (ricorsione).
create or replace function public.promote_next_waitlist(p_event_id uuid, p_stall_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_booking_id uuid;
  v_event_ok boolean;
  v_price numeric(10,2);
begin
  select (active = true and date >= current_date)
    into v_event_ok
    from events
   where id = p_event_id;

  if not coalesce(v_event_ok, false) then return null; end if;

  select coalesce(s.price, e.price_per_stall, 0)
    into v_price
    from stalls s, events e
   where s.id = p_stall_id
     and e.id = p_event_id;

  select * into v_entry from waitlist
    where event_id = p_event_id and (stall_id = p_stall_id or stall_id is null)
    order by (case when stall_id = p_stall_id then 0 else 1 end), created_at
    limit 1;
  if v_entry.id is null then return null; end if;
  begin
    insert into bookings (
      stall_id, event_id, user_id, vendor_name, vendor_phone, vendor_email,
      goods_type, status, notes, from_waitlist, waitlist_promoted_at, paid_price
    ) values (
      p_stall_id, p_event_id, v_entry.user_id, v_entry.vendor_name, v_entry.vendor_phone, v_entry.vendor_email,
      v_entry.goods_type, 'pending', v_entry.notes, true, now(), v_price
    )
    returning id into v_booking_id;
  exception
    when sqlstate 'P0001' then
      -- Utente al limite booking, rimuovi entry e prova successivo
      delete from waitlist where id = v_entry.id;
      return public.promote_next_waitlist(p_event_id, p_stall_id);
    when unique_violation then
      -- Stall e' di nuovo occupato (race), abort
      return null;
  end;
  delete from waitlist where id = v_entry.id;
  return v_booking_id;
end;
$$;

-- 2.11 release_expired_waitlist_promotions — GC waitlist (vedi 19_)
-- Cron orario: cancella i pending da waitlist scaduti (>24h dalla
-- promozione) e auto-promuove il successivo. Distinto dal GC pending
-- Stripe (15 min): chi viene promosso ha 24h per pagare perche' la
-- notifica via email (Resend, futuro) richiede piu' grace period.
create or replace function public.release_expired_waitlist_promotions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer := 0; r record; promoted uuid;
begin
  for r in select id, event_id, stall_id from bookings
    where status = 'pending' and from_waitlist = true
      and waitlist_promoted_at < now() - interval '24 hours'
  loop
    update bookings set status = 'cancelled' where id = r.id;
    v_count := v_count + 1;
    promoted := public.promote_next_waitlist(r.event_id, r.stall_id);
  end loop;
  return v_count;
end;
$$;

grant execute on function public.archive_past_events()                  to authenticated;
grant execute on function public.promote_next_waitlist(uuid, uuid)      to authenticated;
grant execute on function public.release_expired_waitlist_promotions()  to authenticated;

-- ============================================================
-- 3. VISTE
-- ============================================================
-- stalls_with_status: aggrega stato del posteggio (free/pending/booked/blocked).
-- Usa LATERAL join: la view per default e' SECURITY DEFINER (proprieta' del
-- view owner) e bypassa RLS sulle bookings, esponendo solo dati non sensibili
-- (stato, vendor_name, goods_type, user_id del confirmed).
-- Espone anche le coordinate geo (latitude/longitude) per la mappa satellite.

drop view if exists stalls_with_status;
create view stalls_with_status as
select
  s.id,
  s.event_id,
  s.label,
  s.row_idx,
  s.col_idx,
  s.price,
  s.notes,
  s.blocked,
  s.blocked_reason,
  s.latitude,
  s.longitude,
  s.created_at,
  -- Aggiunti dalla migration 15: serve a /api/book per calcolare amountToPay
  -- e per popolare il line item Stripe Checkout. Senza, PostgREST tornava
  -- errore silenzioso e l'app cadeva sul fallback 35 EUR (BUG-026).
  e.title           as event_title,
  e.date            as event_date,
  e.price_per_stall as default_price,
  case
    when s.blocked then 'blocked'
    when b_confirmed.id is not null then 'booked'
    when b_pending.id   is not null then 'pending'
    else 'free'
  end as stall_status,
  b_confirmed.id          as booking_id,
  b_confirmed.vendor_name,
  b_confirmed.goods_type,
  b_confirmed.user_id     as booked_by_user
from stalls s
  join events e on e.id = s.event_id
  left join lateral (
    select id, vendor_name, goods_type, user_id
    from bookings
    where stall_id = s.id and status = 'confirmed'
    limit 1
  ) b_confirmed on true
  left join lateral (
    select id
    from bookings
    where stall_id = s.id and status = 'pending'
    limit 1
  ) b_pending on true;

grant select on stalls_with_status to anon, authenticated;

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
alter table vendors            enable row level security;
alter table events             enable row level security;
alter table stalls             enable row level security;
alter table bookings           enable row level security;
alter table waitlist           enable row level security;
alter table audit_log          enable row level security;
alter table stripe_events_seen enable row level security;

-- vendors
drop policy if exists "vendors_self_read"   on vendors;
drop policy if exists "vendors_self_insert" on vendors;
drop policy if exists "vendors_self_update" on vendors;
drop policy if exists "vendors_admin_delete" on vendors;
create policy "vendors_self_read"    on vendors for select using (user_id = auth.uid() or public.is_admin());
create policy "vendors_self_insert"  on vendors for insert with check (user_id = auth.uid());
create policy "vendors_self_update"  on vendors for update using (user_id = auth.uid() or public.is_admin());
create policy "vendors_admin_delete" on vendors for delete using (public.is_admin());

-- events: chiunque legge gli attivi, admin scrive
drop policy if exists "events_authenticated_read" on events;
drop policy if exists "events_admin_insert"       on events;
drop policy if exists "events_admin_update"       on events;
drop policy if exists "events_admin_delete"       on events;
create policy "events_authenticated_read" on events for select using (active = true or public.is_admin());
create policy "events_admin_insert"       on events for insert with check (public.is_admin());
create policy "events_admin_update"       on events for update using (public.is_admin());
create policy "events_admin_delete"       on events for delete using (public.is_admin());

-- stalls: lettura pubblica, scrittura admin
drop policy if exists "stalls_public_read"  on stalls;
drop policy if exists "stalls_admin_insert" on stalls;
drop policy if exists "stalls_admin_update" on stalls;
drop policy if exists "stalls_admin_delete" on stalls;
create policy "stalls_public_read"  on stalls for select using (true);
create policy "stalls_admin_insert" on stalls for insert with check (public.is_admin());
create policy "stalls_admin_update" on stalls for update using (public.is_admin());
create policy "stalls_admin_delete" on stalls for delete using (public.is_admin());

-- bookings: vendor vede/inserisce le proprie, admin tutto
drop policy if exists "bookings_vendor_select" on bookings;
drop policy if exists "bookings_vendor_insert" on bookings;
drop policy if exists "bookings_admin_update"  on bookings;
drop policy if exists "bookings_admin_delete"  on bookings;
create policy "bookings_vendor_select" on bookings for select using (user_id = auth.uid() or public.is_admin());
create policy "bookings_vendor_insert" on bookings for insert with check ((auth.uid() is not null and user_id = auth.uid()) or public.is_admin());
create policy "bookings_admin_update"  on bookings for update using (public.is_admin());
create policy "bookings_admin_delete"  on bookings for delete using (public.is_admin());

-- waitlist: vendor sulle proprie, admin tutto
drop policy if exists "waitlist_self_read"   on waitlist;
drop policy if exists "waitlist_self_insert" on waitlist;
drop policy if exists "waitlist_self_delete" on waitlist;
create policy "waitlist_self_read"   on waitlist for select using (user_id = auth.uid() or public.is_admin());
create policy "waitlist_self_insert" on waitlist for insert with check (user_id = auth.uid());
create policy "waitlist_self_delete" on waitlist for delete using (user_id = auth.uid() or public.is_admin());

-- audit_log: solo admin in lettura. Nessuna policy di scrittura: il trigger
-- inserisce in modo implicito perche' SECURITY DEFINER bypassa RLS.
drop policy if exists "audit_log_admin_read" on audit_log;
create policy "audit_log_admin_read" on audit_log for select using (public.is_admin());

-- stripe_events_seen: solo admin in lettura, scrittura via service role
drop policy if exists "stripe_events_seen_admin_read" on stripe_events_seen;
create policy "stripe_events_seen_admin_read" on stripe_events_seen for select using (public.is_admin());

-- ============================================================
-- 5. REALTIME PUBLICATION
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'bookings'
  ) then
    execute 'alter publication supabase_realtime add table public.bookings';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'stalls'
  ) then
    execute 'alter publication supabase_realtime add table public.stalls';
  end if;
end $$;

alter table public.bookings replica identity full;
alter table public.stalls   replica identity full;

-- ============================================================
-- FINE schema.sql
-- ============================================================
-- Per applicare le migrations 13/14 (Stripe events + cron GC),
-- esegui i file in supabase/migrations/.
-- Lo storico delle migrazioni precedenti e' in supabase/migrations-archive/
-- come riferimento (NON eseguire: lo schema sopra le include gia').
