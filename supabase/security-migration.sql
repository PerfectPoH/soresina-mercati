-- ============================================================
-- SECURITY MIGRATION
-- ============================================================
-- Esegui nell'SQL Editor di Supabase DOPO le migrazioni precedenti.
-- Rafforza vincoli, RLS e aggiunge audit log.
-- ============================================================

-- ------------------------------------------------------------
-- 1. UNIQUE CONSTRAINT su bookings "confermate"
-- ------------------------------------------------------------
-- Garantisce che lo stesso posteggio non possa avere due prenotazioni
-- confermate contemporaneamente, anche sotto race condition.
-- L'indice e' PARZIALE: si applica solo a status='confirmed',
-- cosi' una prenotazione annullata non blocca una nuova.
create unique index if not exists bookings_one_confirmed_per_stall
  on bookings(stall_id)
  where status = 'confirmed';

-- ------------------------------------------------------------
-- 2. RLS TIGHTENING: events/stalls solo admin scrivono
-- ------------------------------------------------------------
-- Le vecchie policy permettevano a "qualsiasi authenticated" di
-- scrivere. Ora richiediamo il ruolo admin.

-- Events: chiunque puo' leggere attivi, solo admin modifica
drop policy if exists "events_admin_all"       on events;
drop policy if exists "events_admin_insert"    on events;
drop policy if exists "events_admin_update"    on events;
drop policy if exists "events_admin_delete"    on events;
drop policy if exists "events_authenticated_read" on events;

-- Gli admin vedono anche gli archiviati (active=false)
create policy "events_authenticated_read" on events
  for select using (active = true or public.is_admin());

create policy "events_admin_insert" on events
  for insert with check (public.is_admin());

create policy "events_admin_update" on events
  for update using (public.is_admin());

create policy "events_admin_delete" on events
  for delete using (public.is_admin());

-- Stalls: lettura pubblica, scrittura solo admin
drop policy if exists "stalls_admin_all"    on stalls;
drop policy if exists "stalls_admin_insert" on stalls;
drop policy if exists "stalls_admin_update" on stalls;
drop policy if exists "stalls_admin_delete" on stalls;

create policy "stalls_admin_insert" on stalls
  for insert with check (public.is_admin());

create policy "stalls_admin_update" on stalls
  for update using (public.is_admin());

create policy "stalls_admin_delete" on stalls
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 3. AUDIT LOG
-- ------------------------------------------------------------
-- Registra chi ha fatto cosa su events / stalls / bookings.
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  row_id      uuid,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  user_id     uuid,                    -- auth.uid() al momento dell'azione
  user_email  text,                    -- comodita' per la UI
  changes     jsonb,                   -- diff del record (vecchio -> nuovo)
  created_at  timestamptz default now()
);

create index if not exists audit_log_table_idx   on audit_log(table_name, created_at desc);
create index if not exists audit_log_user_idx    on audit_log(user_id, created_at desc);

-- RLS: solo admin puo' leggere il log. Nessuno puo' inserire/modificare
-- a mano, solo il trigger.
alter table audit_log enable row level security;

drop policy if exists "audit_log_admin_read" on audit_log;
create policy "audit_log_admin_read" on audit_log
  for select using (public.is_admin());

-- Niente insert/update/delete manuali: il trigger scrive in modo implicito
-- perche' e' SECURITY DEFINER (definito sotto), bypassando RLS.

-- Funzione trigger
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
  -- auth.uid() puo' essere null se l'azione arriva dal DB (seed)
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

-- Applica il trigger a events / stalls / bookings
drop trigger if exists events_audit   on events;
drop trigger if exists stalls_audit   on stalls;
drop trigger if exists bookings_audit on bookings;

create trigger events_audit
  after insert or update or delete on events
  for each row execute function public.audit_trigger();

create trigger stalls_audit
  after insert or update or delete on stalls
  for each row execute function public.audit_trigger();

create trigger bookings_audit
  after insert or update or delete on bookings
  for each row execute function public.audit_trigger();

-- ------------------------------------------------------------
-- 4. Verifica RLS abilitato ovunque
-- ------------------------------------------------------------
alter table events    enable row level security;
alter table stalls    enable row level security;
alter table bookings  enable row level security;
alter table vendors   enable row level security;
alter table waitlist  enable row level security;
alter table audit_log enable row level security;
