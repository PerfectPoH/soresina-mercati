-- ============================================================
-- FIX: prenotazioni duplicate per utenti non autenticati (v2)
-- ============================================================
-- PROBLEMA:
--   La policy "bookings_admin_select" permette la SELECT su bookings
--   solo agli admin autenticati. La view stalls_with_status fa
--   LEFT JOIN con bookings, quindi per un utente anonimo il join
--   restituisce sempre NULL -> tutti i posteggi appaiono "free"
--   e si possono riprenotare creando record duplicati.
--
-- SOLUZIONE (solo lato DB, il frontend non cambia):
--   1. Funzioni SECURITY DEFINER che leggono bookings bypassando RLS
--      ma restituendo solo dati NON sensibili (stato + nome venditore).
--   2. Ricrea la view stalls_with_status usando queste funzioni,
--      cosi' anche gli utenti anonimi vedono correttamente quali
--      posteggi sono occupati.
--   3. Indice UNIQUE parziale su bookings(stall_id) WHERE status='confirmed':
--      rete di sicurezza contro duplicati (race condition o bug client).
--
-- ATTENZIONE: se nel DB esistono gia' prenotazioni confirmed duplicate
-- per lo stesso stall (residui del bug), l'indice UNIQUE fallira' con
-- errore 23505. In quel caso esegui prima la query di pulizia in fondo.
--
-- Esegui questo file nell'SQL Editor di Supabase DOPO schema.sql e rls.sql
-- ============================================================

-- 1. Funzione per lo stato (free/busy) del posteggio
create or replace function public.stall_status_of(p_stall_id uuid)
returns text
language sql
security definer
stable
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

-- 2. Funzione per il nome del venditore (dato NON sensibile, per il tooltip)
create or replace function public.stall_vendor_name(p_stall_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select vendor_name from bookings
  where stall_id = p_stall_id and status = 'confirmed'
  limit 1;
$$;

-- 3. Permessi: tutti possono chiamare queste funzioni (non espongono
--    telefono/email/note; solo lo stato e il nome pubblico del venditore).
grant execute on function public.stall_status_of(uuid)   to anon, authenticated;
grant execute on function public.stall_vendor_name(uuid) to anon, authenticated;

-- 4. Ricrea la view stalls_with_status usando le funzioni sopra.
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
  s.created_at,
  e.title             as event_title,
  e.date              as event_date,
  e.price_per_stall   as default_price,
  public.stall_vendor_name(s.id)  as vendor_name,
  public.stall_status_of(s.id)    as stall_status,
  case
    when public.stall_status_of(s.id) = 'busy' then 'confirmed'
    else null
  end                              as booking_status
from stalls s
join events e on e.id = s.event_id;

grant select on stalls_with_status to anon, authenticated;

-- 5. Indice UNIQUE parziale: massimo una prenotazione 'confirmed'
--    per ogni posteggio. Se esistono gia' duplicati, la creazione
--    fallira' — in quel caso esegui prima la query di pulizia sotto.
create unique index if not exists bookings_one_confirmed_per_stall
  on bookings (stall_id)
  where status = 'confirmed';


-- ============================================================
-- QUERY DIAGNOSTICHE (esegui singolarmente se serve)
-- ============================================================

-- A) Verifica: quanti duplicati confirmed esistono per stall?
-- select stall_id, count(*) as n
-- from bookings
-- where status = 'confirmed'
-- group by stall_id
-- having count(*) > 1
-- order by n desc;

-- B) Pulizia: mantiene solo la prenotazione piu' vecchia per ogni stall,
--    mette in 'cancelled' tutte le altre. Eseguila PRIMA di creare
--    l'indice UNIQUE se la query A restituisce righe.
-- with ranked as (
--   select id, stall_id,
--          row_number() over (partition by stall_id order by created_at) as rn
--   from bookings
--   where status = 'confirmed'
-- )
-- update bookings
-- set status = 'cancelled'
-- where id in (select id from ranked where rn > 1);

-- C) Verifica finale: controlla lo stato di uno specifico stall
-- select s.label, public.stall_status_of(s.id), public.stall_vendor_name(s.id)
-- from stalls s
-- where s.event_id = '<ID EVENTO>'
-- order by s.row_idx, s.col_idx;
