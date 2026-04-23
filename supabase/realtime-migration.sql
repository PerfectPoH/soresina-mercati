-- supabase/realtime-migration.sql
-- Abilita Supabase Realtime sulle tabelle `bookings` e `stalls` per
-- consentire a StallMap di aggiornarsi in live quando un altro utente
-- prenota o un admin blocca un posteggio.
--
-- Come funziona:
--   Supabase espone un publication Postgres chiamato `supabase_realtime`.
--   Le tabelle aggiunte a quel publication emettono eventi WAL che il
--   client riceve via websocket (canale `postgres_changes`).
--
-- Esegui questo script nel SQL Editor di Supabase.
-- Idempotente: si puo' rieseguire senza errori.
--
-- Verifica post-deploy (SQL Editor):
--   select schemaname, tablename
--     from pg_publication_tables
--    where pubname = 'supabase_realtime';
-- Dovresti vedere `public.bookings` e `public.stalls` in elenco.
-- ---------------------------------------------------------------------

-- 1. Aggiungi bookings al publication (se non gia' presente)
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname   = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'bookings'
  ) then
    execute 'alter publication supabase_realtime add table public.bookings';
  end if;
end $$;

-- 2. Aggiungi stalls al publication (per blocchi manuali admin)
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname   = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'stalls'
  ) then
    execute 'alter publication supabase_realtime add table public.stalls';
  end if;
end $$;

-- 3. REPLICA IDENTITY FULL: serve per ricevere la "old row" negli UPDATE
--    (cosi' il client puo' distinguere transizioni free -> busy).
--    Senza FULL, negli eventi UPDATE arriva solo la chiave primaria.
alter table public.bookings replica identity full;
alter table public.stalls   replica identity full;

-- Fatto. Ricarica la pagina dell'evento: la mappa ora si aggiorna sola
-- quando un altro utente prenota o un admin cambia stato a un posteggio.
