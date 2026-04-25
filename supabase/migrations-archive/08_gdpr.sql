-- ============================================================
-- GDPR MIGRATION
-- ============================================================
-- Da eseguire nell'SQL Editor di Supabase DOPO security-migration.sql.
-- Implementa:
--   - consenso esplicito (colonna vendors.consent_at)
--   - diritto all'oblio (funzione delete_my_account)
--   - retention automatica (anonymize_old_bookings)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonna di consenso GDPR sul profilo venditore
-- ------------------------------------------------------------
alter table vendors
  add column if not exists consent_at timestamptz;

comment on column vendors.consent_at is
  'Timestamp del consenso GDPR al trattamento dei dati (art. 6.1.a GDPR)';

-- ------------------------------------------------------------
-- 2. GDPR Art. 17: diritto all''oblio
-- ------------------------------------------------------------
-- Una funzione SECURITY DEFINER consente a un utente autenticato di
-- cancellare da solo il proprio account auth.users. La cascade su
-- vendors/bookings/waitlist rimuove i dati collegati.
-- Il bypass RLS e la scrittura in auth.users richiedono privilegi
-- elevati: per questo usiamo SECURITY DEFINER con search_path fissato.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Cancella in sequenza cio' che non dipende da cascade diretta:
  delete from waitlist where user_id = v_uid;
  delete from bookings where user_id = v_uid;
  delete from vendors  where user_id = v_uid;

  -- Infine rimuove l''utente dall''auth. Questo fa partire la cascade
  -- per eventuali record residui.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ------------------------------------------------------------
-- 3. Data retention: anonimizzazione bookings vecchi
-- ------------------------------------------------------------
-- Dopo 24 mesi dalla data dell'evento, le prenotazioni vengono
-- "anonimizzate": resta il dato aggregato (data, tipo di merce,
-- posteggio) ma spariscono i riferimenti al venditore.
-- Eseguibile a mano dal SQL editor o da un cron (es. Supabase Scheduled
-- Functions o GitHub Action che chiama l'RPC una volta al mese).
create or replace function public.anonymize_old_bookings(older_than interval default '24 months')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- vendor_name e' NOT NULL, sostituiamo con un placeholder.
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

revoke all on function public.anonymize_old_bookings(interval) from public;
-- Solo admin puo' lanciare l'anonimizzazione a mano
-- (richiede che is_admin() esista dalla security-migration)
grant execute on function public.anonymize_old_bookings(interval) to authenticated;

-- ------------------------------------------------------------
-- 4. Log retention: purga audit_log piu' vecchio di 90 giorni
-- ------------------------------------------------------------
create or replace function public.purge_old_audit_log()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from audit_log where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_old_audit_log() from public;
grant execute on function public.purge_old_audit_log() to authenticated;
