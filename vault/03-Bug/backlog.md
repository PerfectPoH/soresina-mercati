---
tipo: bug-tracker
ultimo-aggiornamento: 2026-04-26
---

# Backlog dei Bug

> 🟢 **0 bug critici aperti.** BUG-034..037 chiusi nella sessione 2026-04-26 notte tarda (Opus). Restano solo 4 tech-debt non bloccanti.
>
> 📚 Storia completa di BUG-001 → BUG-025 (con cause, fix, motivazioni di chiusura) è in [[Bug-Risolti-Storico]] (in `_archive`).

---

## 🔴 Bug aperti

*(nessuno)*

---

## 🆕 Bug risolti in questa sessione (26 Apr notte tarda, Opus)

### BUG-034 — Eventi creabili con date passate
- **Sintomo**: l'admin poteva creare un evento con `date < today`.
- **Fix**: validazione `date >= todayIso` su `POST /api/events` e `PATCH /api/events/[id]`. Permette `today` per eventi serali creati nel pomeriggio. Errore 400 esplicito.

### BUG-035 — Prenotazione gratuita resta "in attesa di conferma"
- **Sintomo**: utente prenota posteggio gratuito → vede pagina conferma → torna in mappa → posteggio giallo "in attesa".
- **Causa**: il flusso 0 EUR usava `createSupabaseServerClient` (cookie utente) per fare `UPDATE bookings SET status='confirmed'`. La policy RLS `bookings_admin_update` richiede `is_admin()` → l'update veniva scartato silenziosamente → booking restava `pending`.
- **Fix**: il flusso 0 EUR ora usa `createSupabaseAdminClient` (service role bypass RLS), come già fa il webhook Stripe. Coerente con la stessa logica `pending → confirmed` server-to-server.

### BUG-036 — Iscrizione a lista d'attesa con max prenotazioni già raggiunto
- **Sintomo**: utente con 2 confirmed/pending poteva comunque iscriversi alla waitlist.
- **Fix**: in `POST /api/waitlist`, dopo il check vendor profilo, count delle prenotazioni `confirmed+pending` per quell'evento. Se ≥ 2 → 400 "Hai già il numero massimo di prenotazioni per questo evento. La lista d'attesa serve a chi non ha ancora prenotato."

### BUG-037 — Eventi passati restano visibili e prenotabili
- **Sintomo**: gli eventi con `date < today` apparivano in homepage, e gli utenti potevano cliccarli e prenotare.
- **Fix in più livelli**:
  - **Home `/`**: query filtra `date >= today` (gli eventi passati spariscono dalla lista pubblica)
  - **Pagina evento `/evento/[id]`**: se `isPast`, banner "Mercato concluso" + `BookingForm` non mostrato (passato `isPast` a `StallMapTabs` → `StallMap`, che disabilita le celle e blocca `handleSelect`)
  - **API `/api/book`**: server-side check `event_date < today` → 400 `event_past` (difesa contro bypass via curl)
  - **API `/api/waitlist`**: stesso check → 400 `event_past`
  - **Profilo utente**: gli eventi passati restano visibili nelle prenotazioni dell'utente con badge "Passata" (UX corretta: lo storico personale è importante)
- **Stato**: ✅ RISOLTO

---

## 🆕 Bug risolti in questa sessione (26 Apr notte, Opus)

### BUG-029 — Incasso stimato hardcoded a 35€/booking
- **Sintomo**: dashboard admin mostrava "70€" per 2 prenotazioni da 3€ ciascuna.
- **Causa**: `app/admin/page.js` riga 79: `bookings.length * 35` (hardcoded, prezzo fisso).
- **Fix**: nuova funzione `calcolaIncasso(bookings)` che somma `stalls.price ?? events.price_per_stall` per ogni booking. Query estesa con `stalls(label, price), events(title, date, price_per_stall)`.
- **Stato**: ✅ RISOLTO

### BUG-030 — Limite 2 prenotazioni bypassabile via Stripe
- **Sintomo**: utente con 2 prenotazioni confirmed iniziava un terzo checkout, **pagava** su Stripe, ma il booking restava `pending` per sempre (webhook silenziosamente bloccato).
- **Causa**: trigger `enforce_booking_limit` contava solo `confirmed`. Insert di nuovo booking come `pending` passava → Stripe addebitava → webhook UPDATE pending→confirmed bloccato dal trigger (count=3) → silent failure → utente paga senza ricevere prenotazione.
- **Fix**: migration `16_booking_limit_includes_pending`. Il trigger ora conta `confirmed + pending` escludendo l'id corrente. L'INSERT del 3° booking viene bloccato PRIMA del checkout Stripe → utente vede errore "Hai raggiunto il limite di 2 posteggi" senza nessun addebito.
- **Stato**: ✅ RISOLTO su prod e staging.

### BUG-031 — Numero slot evento non modificabile dopo creazione
- **Sintomo**: campi righe/colonne disabilitati in modifica.
- **Fix**: 
  - `EventForm.jsx`: rimosso `disabled={isEdit}`, rows/cols editabili
  - `app/api/events/[id]/route.js` PATCH: accetta `rows`/`cols`, valida solo aumento (diminuzione → 400 esplicito), chiama `generate_stalls()` per creare i nuovi posteggi (ON CONFLICT DO NOTHING preserva i vecchi)
  - Dopo generate: chiama `copy_stall_positions_from_template()` per ereditare le coordinate dei nuovi posteggi dall'ultimo evento alla stessa location
  - Pagina modifica: aggiornata nota di guidance
- **Stato**: ✅ RISOLTO

### BUG-032 — Profilo utente mostra solo conteggio prenotazioni
- **Sintomo**: la pagina `/profilo` mostrava solo "Totali: N, Confermate: N" senza dettagli.
- **Fix**: query estesa con `events(title, date, price_per_stall), stalls(label, price)`. UI nuova: lista ordinata per data, per ogni booking mostra evento + data + posteggio + prezzo + badge stato (Attiva / In attesa / Passata / Annullata). Click sulla prenotazione → pagina conferma `/prenotato/[id]`. Bottone "Richiedi cancellazione" per le attive/pending.
- **Stato**: ✅ RISOLTO

### BUG-033 — Cancellazione utente con flusso admin + rimborso Stripe
- **Sintomo**: l'utente non aveva modo di richiedere annullamento; l'admin poteva cancellare ma senza rimborso.
- **Fix**: flusso completo
  - **DB**: migration `18_booking_cancellation_request` aggiunge colonne `cancellation_requested_at`, `cancellation_reason`, `stripe_session_id`, `stripe_payment_intent_id` su `bookings`. Funzione `request_booking_cancellation(uuid, text)` SECURITY DEFINER per check ownership + stato.
  - **Webhook Stripe**: in `handleCheckoutCompleted` salva `stripe_session_id` e `stripe_payment_intent_id` quando conferma il booking.
  - **API utente**: `POST /api/bookings/[id]/cancellation-request` con body `{ reason }` (opzionale, max 500 char). Rate limit per IP + per utente.
  - **API admin**: `POST /api/admin/bookings/[id]/cancel` con body `{ refund: true|false }`. Se refund=true e c'è payment_intent → `stripe.refunds.create()`. Aggiorna status=cancelled. `DELETE` stesso path → rifiuta richiesta (clear `cancellation_requested_at`).
  - **UI utente**: componente `RequestBookingCancellation` con form motivo + invio.
  - **UI admin**: pagina `/admin/cancellazioni` con lista richieste pending + bottoni "Annulla + rimborsa" / "Annulla senza rimborso" / "Rifiuta richiesta". Badge contatore nel link dashboard.
- **Stato**: ✅ RISOLTO. Da testare end-to-end su staging dopo prossima prenotazione + richiesta.

---

## 🛠️ Feature aggiunta: Template posizioni stalls satellitari

Salandra ha richiesto: ogni volta che si crea un evento, le posizioni dei posteggi sulla mappa satellitare (lat/lng) vengono ereditate dall'ultimo evento alla stessa location, senza dover riposizionare manualmente.

**Implementazione**:
- **DB**: migration `17_copy_stall_positions_template`. Funzione `copy_stall_positions_from_template(p_event_id)` SECURITY DEFINER che cerca l'ultimo evento alla stessa location con stalls coordinate valorizzate, e copia per label match (A01, A02, ecc.). Non sovrascrive eventuali coordinate già impostate sul nuovo evento.
- **POST `/api/events`**: dopo `generate_stalls`, chiama `copy_stall_positions_from_template`. Best-effort: se fallisce, l'evento è creato comunque.
- **PATCH `/api/events/[id]`**: quando rows/cols aumentano, dopo `generate_stalls` chiama `copy_stall_positions_from_template` per i nuovi posteggi.

**Effetto**: l'admin posiziona i posteggi UNA volta sulla mappa per la prima edizione; tutte le edizioni successive li trovano già piazzati.

---

## 🆕 Bug risolti in questa sessione (26 Apr sera, Opus)

### BUG-026 — Regressione "Errore nel verificare il posteggio" su staging
- **Aperto da**: Antigravity (segnalazione Salandra 2026-04-26 14:20). Vedi [[BUG-026-regressione-prenotazione-staging]].
- **Vera causa** (diversa dall'ipotesi iniziale): la view `stalls_with_status` su entrambi i DB **non aveva `default_price` né `event_title`**. Il codice di `book/route.js` li selezionava da sempre, ma prima del fix BUG-020 il client Supabase mascherava silenziosamente l'errore PostgREST e cadeva sul fallback `35.00`. Il fix BUG-020 ha aggiunto il check `stallErr` e ha smascherato il bug pre-esistente nella view.
- **Fix applicato**: migration `15_view_add_event_title_default_price` su prod (`ddqwutxocznggfmrzzkw`) e staging (`yctfshlwgouhppadptgy`). La view ora include `e.title as event_title`, `e.date as event_date`, `e.price_per_stall as default_price` via `JOIN events`. Verificato runtime con `select id, label, event_id, event_title, default_price from stalls_with_status` → tutti i campi presenti.
- **Stato**: ✅ RISOLTO

### BUG-027 — `next build` fallisce su `/opengraph-image` con `Invalid URL`
- **Aperto da**: Codex 5.3. Vedi [[BUG-027-build-fail-opengraph-image]].
- **Causa**: bug noto di `@vercel/og` su Windows local build durante il **prerender statico** della metadata route OG image. `fileURLToPath(import.meta.url)` riceve un URL malformato.
- **Fix applicato**: in `app/opengraph-image.js` aggiunte `export const runtime = 'nodejs'` e `export const dynamic = 'force-dynamic'` per saltare il prerender al build. L'immagine viene generata on-request (comportamento identico in produzione su Vercel, dove il prerender funzionerebbe; ma local Windows fallisce). Rimossa contestualmente la `debugLog` instrumentation top-level di Codex (regressione di BUG-014, fix incoerente).
- **Stato**: ✅ RISOLTO

### BUG-028 — `npm run lint` apre wizard interattivo
- **Aperto da**: Codex 5.3.
- **Causa**: nessun `.eslintrc*` nel repo → `next lint` chiede setup interattivo. Su CI/agent non funziona.
- **Fix applicato**: creato `.eslintrc.json` con `extends: ["next/core-web-vitals"]`, ignore patterns per `vault/`, `supabase/migrations-archive/`, `.next/`.
- **Stato**: ✅ RISOLTO

---

## 🟡 Tech debt (non bloccante)

### TECH-DEBT-001 — `Roadmap-Master.md` allineamento periodico
- **Status**: ✅ riallineata in sessione 2026-04-25 (Antigravity).
- **Manutenzione**: rivedi ad ogni milestone (consegna Pro Loco, dominio personalizzato, Stripe live, ecc.).

### TECH-DEBT-002 — Componenti monolitici
- `components/StallMapSatellite.jsx` (~20KB)
- `components/BookingForm.jsx` (~10KB)
- **Priorità**: bassa, post-consegna Pro Loco.
- **Fix**: estrarre sub-componenti (`StallTooltip`, `BookingFormFields`, `BookingFormSubmit`).

### TECH-DEBT-003 — Mancano test automatizzati
- 0 test E2E (Playwright)
- 0 unit test (Vitest)
- **Priorità**: media. Pre-consegna almeno smoke test sui 3 flussi critici (signup, prenotazione end-to-end Stripe, admin block/unblock).

### TECH-DEBT-004 — Rate limiting in-memory
- `lib/rate-limit.js` usa `Map` in memoria. Su Vercel serverless è frammentato per istanza.
- Per il volume target (Pro Loco, ~50 prenotazioni/anno) accettabile.
- **Migrare a Vercel KV / Upstash** se in futuro si va multi-tenant o si scala.

---

## ✅ Riassunto bug risolti per categoria

### Sicurezza (7 bug)
- **BUG-007** — secret leak vault (`.gitignore` profilattico)
- **BUG-008** — middleware HTTPS solo su `/admin` (esteso a tutto il sito)
- **BUG-013** — Vercel Auth Protection bloccava webhook Stripe (disabilitata)
- **BUG-018** — `/prenotato/[id]` accessibile da chiunque (check ownership esplicito)
- **BUG-021** — Password Policy solo lato client (configurata server-side su Supabase Auth, prod+staging)
- **BUG-024** — waitlist no rate limit per-utente (aggiunto)
- **BUG-014** — debugLog instrumentation hardcoded (gateato dietro env)

### Schema / Database (4 bug)
- **BUG-002** — `schema.sql` consolidato non riflette il DB reale (riscritto da `pg_dump` semantico)
- **BUG-005** — webhook usa tabella `stripe_events_seen` mancante (creata su prod+staging)
- **BUG-006** — bookings pending orfani (rollback + GC `pg_cron`)
- **BUG-017** — `map_lat/map_lng` aggiornabili separatamente (validazione di coppia)

### Stripe (5 bug)
- **BUG-001** — sintassi rotta in `book/route.js` (corretta)
- **BUG-003** — webhook usa client cookie-based, RLS blocca UPDATE (creato `lib/supabase-admin.js`)
- **BUG-004** — env Stripe non configurate su Vercel (configurate per Preview, in attesa di onboarding live per Production)
- **BUG-012** — SENTRY_AUTH_TOKEN mancante (configurato)
- **BUG-015** — prezzo 0 considerato falsy (`??` + flusso eventi gratuiti)

### API / UX (5 bug)
- **BUG-009** — import a metà file (`rate-limit.js`, spostato in cima)
- **BUG-010** — magic link punta a `localhost` su staging (SITE_URL Supabase staging configurato)
- **BUG-011** — `supabase/.temp/` non gitignored (aggiunto)
- **BUG-016** — DELETE/PATCH silent fail (aggiunto check rows + 404)
- **BUG-020** — `stallData` null + fallback 35€ silenzioso (filter `event_id` + 404 esplicito)
- **BUG-023** — `GOODS_TYPES` duplicato FE/BE (centralizzato in `lib/validate.js`)
- **BUG-025** — copy "riceverai email" promessa non mantenuta (testo aggiornato)

### Chiusi NOT-A-BUG (con razionale)
- **BUG-019** — singleton `supabase-admin` (false positive: `persistSession: false` è sufficiente)
- **BUG-022** — `revalidatePath` pre-Stripe (è il lock di inventario, intenzionale)

---

*Per i dettagli completi (cause, fix, evidenze, contro-verifiche) vedi [[Bug-Risolti-Storico]] in `03-Bug/_archive/`.*
