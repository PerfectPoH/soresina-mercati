-- ============================================================
-- FIX: policy SELECT mancante su tabella stalls
-- ============================================================
-- PROBLEMA:
--   Dopo security-migration.sql la tabella `stalls` aveva solo le
--   policy INSERT/UPDATE/DELETE per admin, ma mancava la policy
--   SELECT. Con RLS attiva e zero policy SELECT, nessuno puo'
--   leggere direttamente da `stalls` (la mappa pubblica funzionava
--   solo perche' usa la view `stalls_with_status` in SECURITY DEFINER).
--
--   Sintomo: l'API /api/stalls/[id] (blocca/sblocca posteggio) prima
--   fa un SELECT di verifica che riceve 0 righe, e restituisce
--   "Posteggio non trovato" anche per posteggi esistenti.
--
-- FIX: ricrea la policy SELECT pubblica sulla tabella stalls.
-- ============================================================

drop policy if exists "stalls_public_read" on stalls;

create policy "stalls_public_read" on stalls
  for select using (true);

-- Verifica: adesso pg_policies su stalls deve avere 4 righe
-- (DELETE, INSERT, SELECT, UPDATE).
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'stalls'
order by cmd;
