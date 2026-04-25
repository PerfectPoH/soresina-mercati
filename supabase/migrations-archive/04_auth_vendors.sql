-- ============================================================
-- AUTH MIGRATION: registrazione venditori + limite posteggi
-- ============================================================
-- Questa migrazione introduce:
--   1. Tabella `vendors` con profilo completo collegata a auth.users
--   2. Colonna `user_id` su `bookings` (chi ha effettuato la prenotazione)
--   3. Trigger: massimo 2 prenotazioni 'confirmed' per venditore per evento
--   4. Funzione helper is_admin() per le policy
--   5. RLS aggiornata: solo venditori autenticati possono prenotare,
--      gli admin possono continuare a gestire tutto
--
-- Esegui nell'SQL Editor di Supabase DOPO schema.sql, rls.sql e fix-rls.sql
-- ============================================================

-- 1. Tabella vendors: profilo completo, collegato a auth.users
create table if not exists vendors (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  email              text not null,
  name               text not null,
  phone              text not null,
  primary_goods_type text not null,
  vat_number         text,                               -- partita IVA, opzionale
  role               text not null default 'vendor'
                     check (role in ('vendor', 'admin')),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists vendors_role_idx on vendors(role);

-- Aggiorna updated_at automaticamente
create or replace function public.vendors_touch()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists vendors_touch_trigger on vendors;
create trigger vendors_touch_trigger
  before update on vendors
  for each row execute function public.vendors_touch();

-- 2. Funzione helper: l'utente corrente e' admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from vendors
    where user_id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- 3. Aggiungi user_id alla tabella bookings (nullable per compatibilita'
--    con le prenotazioni anonime gia' esistenti)
alter table bookings
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists bookings_user_id_idx on bookings(user_id);

-- 4. Trigger: massimo 2 prenotazioni confirmed per venditore per evento
create or replace function public.enforce_booking_limit()
returns trigger language plpgsql as $$
declare
  current_count int;
begin
  -- Applica il limite solo a prenotazioni confirmed con user_id valorizzato.
  -- Gli admin possono prenotare per conto di chiunque: saltano il limite.
  if NEW.status = 'confirmed' and NEW.user_id is not null and not public.is_admin() then
    select count(*) into current_count
      from bookings
      where user_id = NEW.user_id
        and event_id = NEW.event_id
        and status = 'confirmed'
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

-- 5. Aggiorna le RLS policy di bookings
--    Rimuovi le vecchie permissive per riscriverle
drop policy if exists "bookings_public_insert"   on bookings;
drop policy if exists "bookings_admin_select"    on bookings;
drop policy if exists "bookings_admin_update"    on bookings;
drop policy if exists "bookings_vendor_insert"   on bookings;
drop policy if exists "bookings_vendor_select"   on bookings;
drop policy if exists "bookings_admin_all"       on bookings;

-- Solo venditori autenticati possono inserire prenotazioni con il proprio user_id.
-- Oppure gli admin possono inserire qualsiasi prenotazione.
create policy "bookings_vendor_insert" on bookings
  for insert with check (
    (auth.uid() is not null and user_id = auth.uid())
    or public.is_admin()
  );

-- Venditori vedono solo le proprie prenotazioni. Admin vede tutto.
create policy "bookings_vendor_select" on bookings
  for select using (
    user_id = auth.uid() or public.is_admin()
  );

-- Solo admin puo' aggiornare/cancellare
create policy "bookings_admin_update" on bookings
  for update using (public.is_admin());

create policy "bookings_admin_delete" on bookings
  for delete using (public.is_admin());

-- 6. RLS sulla tabella vendors
alter table vendors enable row level security;

drop policy if exists "vendors_self_read"   on vendors;
drop policy if exists "vendors_self_insert" on vendors;
drop policy if exists "vendors_self_update" on vendors;
drop policy if exists "vendors_admin_all"   on vendors;

-- Ogni utente autenticato puo' leggere/aggiornare il proprio profilo
create policy "vendors_self_read" on vendors
  for select using (user_id = auth.uid() or public.is_admin());

create policy "vendors_self_insert" on vendors
  for insert with check (user_id = auth.uid());

create policy "vendors_self_update" on vendors
  for update using (user_id = auth.uid() or public.is_admin());

-- Solo admin puo' cancellare profili
create policy "vendors_admin_delete" on vendors
  for delete using (public.is_admin());

-- Permessi grant
grant select, insert, update on vendors to authenticated;

-- ============================================================
-- ONE-TIME: assegna ruolo admin all'utente amministratore esistente
-- ============================================================
-- Sostituisci l'email con quella del tuo admin (quella creata in
-- Supabase -> Authentication -> Users). Esegui UNA sola volta.
-- ============================================================
-- insert into vendors (user_id, email, name, phone, primary_goods_type, role)
-- select id, email, 'Amministratore Pro Loco', '000', 'Altro', 'admin'
-- from auth.users
-- where email = 'admin@proloco-soresina.it'
-- on conflict (user_id) do update set role = 'admin';
