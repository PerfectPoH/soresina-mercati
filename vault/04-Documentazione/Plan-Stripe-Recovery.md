---
tipo: implementation-plan
agente-proponente: Claude Opus 4.7
data: 2026-04-25
stato: in-attesa-doppia-approvazione
priorità: critica
tags: [stripe, recovery, supabase, schema, webhook, plan]
---

# Implementation Plan: Stripe Checkout Recovery + Schema Reconciliation

> **Status**: in attesa di (a) approvazione umana esplicita di Salandra, (b) review preventiva di Antigravity in [[Code-Review-Opus-vs-Antigravity]]. Non eseguire senza entrambe.

## Obiettivo

Sanare i 3 bug critici introdotti dalle modifiche di Antigravity nella sessione 2026-04-25, completare il setup Stripe in modo che il flusso di pagamento funzioni end-to-end, e riallineare lo schema DB consolidato alla realtà di prod/staging.

## Pre-condizioni

- Working tree con modifiche di Antigravity non committate ancora presenti.
- Branch corrente: `main`. HEAD: `5989389` (Sentry activate).
- Accessi attivi: Vercel CLI (token utente, da revocare a fine sessione), Supabase MCP (prod `ddqwutxocznggfmrzzkw` + staging `yctfshlwgouhppadptgy`), Sentry MCP, Stripe MCP.
- Antigravity non sta lavorando in parallelo (verificare con utente prima di procedere).

## Strategia in alto

Tre fasi sequenziali. Ognuna ha gate di verifica prima di passare alla successiva. Se una fase fallisce, rollback isolato senza toccare le altre.

```
Fase 1 — Fix sintassi e webhook  (≈25 min)
  └─ gate: build locale verde + lint pulito
Fase 2 — Schema riallineamento     (≈30 min)
  └─ gate: pg_dump diff vs DB reale = 0 righe diverse
Fase 3 — Stripe end-to-end         (≈40 min)
  └─ gate: smoke test checkout su staging con webhook che porta a 'confirmed'
```

---

## Fase 1 — Fix codice (sintassi + webhook RLS)

### 1.1 Riparare `app/api/book/route.js`
- Rimuovere il blocco orfano alle righe 16-19 (import duplicato)
- Spostare `const stripe = new Stripe(...)` sotto agli import, **dopo** validazione env
- Aggiungere guard fail-fast su `STRIPE_SECRET_KEY` mancante
- Pinare `apiVersion` (`'2024-06-20'`) per evitare drift

### 1.2 Creare `lib/supabase-admin.js`
- Singleton client con `SUPABASE_SERVICE_ROLE_KEY`
- `auth: { persistSession: false, autoRefreshToken: false }`
- Throw esplicito se la env manca (server-only)
- Aggiungere a `.env.example` con commento di security

### 1.3 Aggiornare `app/api/webhooks/stripe/route.js`
- Sostituire `createSupabaseServerClient` → `createSupabaseAdminClient`
- Aggiungere `export const runtime = 'nodejs'` (richiesto da Stripe SDK Node)
- Rimuovere `console.log` (vedi [[Memoria-AI]] §scrubbing log) e usare `safeLogError`
- Idempotency: usare `stripe-signature` header ID + tabella `stripe_events_seen` per evitare double-update se Stripe rinvia il webhook
- Gestire ulteriori eventi rilevanti: `checkout.session.expired` → release del posteggio (status `cancelled`)

### 1.4 Verifica fase 1
- `npm run build` localmente → 0 errori
- `npm run lint` → 0 warning nuovi
- `npx tsc --noEmit` (se `tsconfig.json` è strict) → 0
- Test manuale: avviare `npm run dev`, aprire `/evento/<id>`, cliccare "Prenota" → vedere redirect a Stripe (che fallirà perché manca `STRIPE_SECRET_KEY`, ma il request handler non deve crashare)

---

## Fase 2 — Schema riallineamento

### 2.1 Dump dello schema reale da prod
Approccio più sicuro: usare il Supabase MCP `execute_sql` per estrarre `pg_dump` equivalente via query a `pg_catalog`. Alternativa: `supabase db dump` da CLI se autenticato.

Estraggo dai cataloghi:
- Tutte le tabelle public (CREATE TABLE)
- Tutti gli indici, constraint, foreign key
- Tutte le funzioni (definizione completa)
- Tutti i trigger
- Tutte le view (con definizione corretta)
- Tutte le RLS policies
- Realtime publication membership

### 2.2 Riscrittura `supabase/schema.sql`
Output: un singolo file, idempotente (ogni statement con `if not exists` / `or replace`), con sezioni commentate:

```
1. Tabelle (vendors, events, stalls, bookings, waitlist, audit_log)
   1.1 stalls.lat, stalls.lng                ← MANCAVANO
   1.2 events.image_url, map_lat/lng/zoom    ← MANCAVANO
   1.3 stripe_events_seen (NUOVA, vedi 1.3)
2. Funzioni
   2.1 is_admin()
   2.2 stall_status_of()                     ← MANCAVA, RIPRISTINARE
   2.3 stall_vendor_name()                   ← MANCAVA, RIPRISTINARE
   2.4 vendors_touch()
   2.5 enforce_booking_limit()
   2.6 audit_trigger()
   2.7 delete_my_account(), anonymize_old_bookings(), purge_old_audit_log()
   2.8 generate_stalls()
   2.9 release_expired_pending_bookings()    ← NUOVA per Stripe GC
3. Trigger
4. Viste
   4.1 stalls_with_status                    ← USA stall_status_of() (RLS-safe)
                                             ← GESTISCE blocked + pending + busy + free
5. RLS policies (con search_path pinned su tutte le funzioni SECURITY DEFINER)
6. Realtime publication
7. (No seed nel file consolidato — i dati di esempio vanno in seed.sql separato)
```

### 2.3 Migrazioni storiche → archivio
- Recuperare le 8 migrazioni dal git history (`git show HEAD:supabase/auth-migration.sql > ...`)
- Spostarle in `supabase/migrations-archive/` con README che spiega "questo è lo storico, lo schema vivo è schema.sql"
- Aggiungere `supabase/migrations-archive/` a un README che lista ordine cronologico applicato

### 2.4 Verifica fase 2
- `pg_dump --schema-only` da staging vs `schema.sql` → diff rumoroso ma equivalente semanticamente
- Eseguire `schema.sql` su un DB Supabase di test (branch creato apposta), poi `pg_dump` di quel DB → confronto byte-per-byte con il dump da prod (escludendo nomi di sequenze interne ecc.)
- Query smoke: `SELECT * FROM stalls_with_status WHERE event_id = '<test>'` come anonimo → risultato corretto (busy/free/blocked/pending)

---

## Fase 3 — Stripe end-to-end

### 3.1 Stripe MCP: creare prodotti/prezzi (opzionale)
Per ora il codice usa `price_data` inline nella checkout session, niente da creare lato Stripe.

Se vogliamo passare a price predefiniti (più pulito per fatture e dashboard Stripe), creare un `Product` "Posteggio mercato" con tier dinamico via metadata. Lo lascio fuori da questo plan.

### 3.2 Configurare env vars Vercel
Via Vercel API (`team_GaQ3Nceoq5BW756O4qKUgpWf` / `prj_Y1VZZvz8RnJSOEaWnCBA2Uq26oQu`):

| Var | Production | Preview |
|---|---|---|
| `STRIPE_SECRET_KEY` | live key (sk_live_...) | test key (sk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | da endpoint live | da endpoint test |
| `NEXT_PUBLIC_APP_URL` | `https://soresina-mercati.vercel.app` | `https://...-git-staging-...vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | da Supabase prod | da Supabase staging |

**Nota**: STRIPE_SECRET_KEY e SUPABASE_SERVICE_ROLE_KEY sono **non** `NEXT_PUBLIC_`. Solo server-side. Mai esposte al client.

### 3.3 Configurare webhook su Stripe Dashboard
Due endpoint, uno per prod uno per test:
- Prod: `https://soresina-mercati.vercel.app/api/webhooks/stripe`
- Staging: `https://soresina-mercati-git-staging-...vercel.app/api/webhooks/stripe`

Eventi da sottoscrivere:
- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded` (per metodi pay-later)
- `checkout.session.async_payment_failed`

Copiare il Signing secret di ogni endpoint nelle rispettive env Vercel.

### 3.4 Cron release pending bookings
Su Supabase staging eseguire:
```sql
select cron.schedule(
  'release-pending-bookings',
  '*/5 * * * *',
  $$delete from bookings where status='pending' and created_at < now() - interval '15 minutes'$$
);
```

(Equivalente in prod dopo che lo staging passa lo smoke test.)

### 3.5 Smoke test su staging
1. Login come vendor su staging
2. Aprire `/evento/<id>` → click su un posteggio → submit form
3. Verificare redirect a Stripe Checkout
4. Pagare con `4242 4242 4242 4242`
5. Verificare redirect a `/prenotato/<id>?success=true`
6. Verificare in DB: `select status from bookings where id = '...'` → `'confirmed'`
7. Verificare in DB: `select * from audit_log order by created_at desc limit 5` → c'è la riga UPDATE

Se una di queste step fallisce, rollback fase 3 (rimozione env Stripe + revert webhook).

### 3.6 Verifica fase 3
- 3 test successivi end-to-end
- Stripe Dashboard → Logs → 200 sul webhook
- Sentry → nessun nuovo error nelle 24h post-deploy

---

## Cosa **non** è in scope per questo plan

- Refactor di `StallMapSatellite.jsx` / `BookingForm.jsx` (componenti monolitici) → bug separato in [[backlog]]
- Realtime sync della mappa → feature separata, non bloccante per Stripe
- Email Resend post-pagamento → feature separata
- Fatturazione automatica Stripe → richiede Partita IVA Pro Loco
- Test E2E Playwright → da pianificare in plan dedicato

## Aspetti che vorrei chiarire con Antigravity

1. C'è un motivo per cui hai scelto l'API version Stripe non specificata? (non hai pinnato — il default cambia)
2. Hai considerato l'idempotency del webhook? Stripe può rinviare lo stesso evento (deduplica via `event.id`).
3. Hai pensato all'evento `checkout.session.expired` o solo a `completed`?
4. L'env `NEXT_PUBLIC_APP_URL` non era ancora usata. È intenzionale come nuova convention o dovevamo riutilizzare `NEXT_PUBLIC_SITE_URL` che già esiste?

## Rollback plan se qualcosa esplode in prod

- Fase 1: `git revert <commit>` del fix sintassi
- Fase 2: `git revert <commit>` del nuovo schema.sql + ripristino dei migration files dall'archivio
- Fase 3: rimozione env Stripe da Vercel (lascia il codice ma lo disabilita), elimina endpoint webhook su Stripe Dashboard

DB rollback: NON tocchiamo dati di prod in nessuna fase. Lo schema.sql viene riallineato al DB, non viceversa.

---

## Approvazioni richieste

- [ ] **Salandra (umano)**: dare OK esplicito ("Ok procedi") in chat dopo aver letto questo plan
- [ ] **Antigravity**: rispondere in [[Code-Review-Opus-vs-Antigravity]] §"Risposta Antigravity" con accept/dissent puntuale sui 4 punti

Se entrambe arrivano, eseguo le 3 fasi in sequenza, scrivo `[[DevLog-Opus-Stripe-Recovery]]` man mano, e ad ogni gate aspetto OK.
