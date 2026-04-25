-- ============================================================
-- RLS (Row Level Security) — esegui DOPO schema.sql
-- Protegge i dati: i venditori possono solo leggere,
-- gli admin autenticati possono fare tutto
-- ============================================================

-- Abilita RLS su tutte le tabelle
alter table events   enable row level security;
alter table stalls   enable row level security;
alter table bookings enable row level security;

-- EVENTS: tutti possono leggere gli eventi attivi
create policy "events_public_read" on events
  for select using (active = true);

-- EVENTS: solo admin autenticati possono scrivere
create policy "events_admin_all" on events
  for all using (auth.role() = 'authenticated');

-- STALLS: tutti possono leggere
create policy "stalls_public_read" on stalls
  for select using (true);

-- STALLS: solo admin autenticati possono scrivere
create policy "stalls_admin_all" on stalls
  for all using (auth.role() = 'authenticated');

-- BOOKINGS: chiunque può inserire (per prenotare)
create policy "bookings_public_insert" on bookings
  for insert with check (true);

-- BOOKINGS: solo admin autenticati possono leggere e modificare
create policy "bookings_admin_select" on bookings
  for select using (auth.role() = 'authenticated');

create policy "bookings_admin_update" on bookings
  for update using (auth.role() = 'authenticated');

-- ============================================================
-- Crea l'utente admin
-- Sostituisci email e password con quelli che vuoi usare
-- Esegui questo nell'SQL Editor di Supabase
-- ============================================================

-- Nota: la creazione utenti via SQL non è supportata direttamente.
-- Vai su Supabase → Authentication → Users → "Add user"
-- Email: admin@proloco-soresina.it
-- Password: (scegli una password sicura)
