---
tipo: bug-tracker
ultimo-aggiornamento: 2026-04-26
---

# Backlog dei Bug

> 🟢 **0 bug critici aperti.** BUG-042..044 + audit Codex 28 apr (schema.sql allineato, README/SECURITY riallineati) chiusi nella sessione 2026-04-28 (Opus). Restano solo 4 tech-debt non bloccanti.
>
> 📚 Storia completa di BUG-001 → BUG-025 (con cause, fix, motivazioni di chiusura) è in [[Bug-Risolti-Storico]] (in `_archive`).

---

## 🔴 Bug aperti

*(nessuno)*

---

## 🆕 Bug risolti in questa sessione (28 Apr, Opus)

### BUG-042 — Promote waitlist su evento passato
- **Sintomo**: l'admin promuoveva un utente della lista d'attesa su un evento passato/archiviato → booking creato come `pending` impossibile da confermare (bloccato dai check `event_past` su `/api/book` e nel webhook) → restava "in attesa" all'infinito.
- **Causa**: `promote_next_waitlist(uuid, uuid)` non verificava lo stato dell'evento.
- **Fix DB** (migration 20): pre-check `events.active = true AND events.date >= current_date` all'inizio della funzione. Cleanup idempotente che cancella i bookings pending residui creati da promote su eventi non più validi.
- **Fix API** `app/api/admin/waitlist/[id]/promote/route.js`: defense-in-depth, errore esplicito 400 `event_past_or_archived` se l'admin prova a promuovere su un evento non valido.
- **Stato**: ✅ RISOLTO

### BUG-043 — Profilo: bottone "Richiedi cancellazione" attivo su eventi passati
- **Sintomo**: utente vedeva il bottone "Richiedi cancellazione" su prenotazioni di mercati già conclusi.
- **Fix UI** `app/profilo/page.js`: la `classify` ora valuta lo stato dell'evento PRIMA del booking status. Eventi passati → badge "Passata" (no bottone). Eventi rimossi/RLS-nascosti → badge "Evento rimosso" (no bottone).
- **Fix DB** (migration 21): `request_booking_cancellation` rifiuta lato server se l'evento è passato (defense in depth contro chiamate dirette all'RPC).
- **Stato**: ✅ RISOLTO

### BUG-044 — Profilo: "Evento" senza nome/data per prenotazioni promosse su eventi archiviati
- **Sintomo**: dopo BUG-042, un booking pending residuo aveva `events` null nel join (RLS nasconde events inactive ai non-admin) → UI mostrava placeholder "Evento" 0€ senza data.
- **Causa root**: BUG-042 (promote su evento passato).
- **Fix UI**: gestione gracefully — `classify` ritorna `'unknown'` con label "Evento rimosso", titolo fallback "Evento rimosso", data "—". Niente bottone cancellazione su prenotazioni con evento mancante.
- **Cleanup runtime**: migration 20 ha già messo i bookings pending orfani in `cancelled`.
- **Stato**: ✅ RISOLTO (sintomo eliminato dal fix BUG-042)

---

## 🩺 Audit Codex 28 Apr — chiusura P1

### `supabase/schema.sql` allineato alle migrations 13-21
- Aggiunti `bookings.from_waitlist` + `bookings.waitlist_promoted_at` + `waitlist.stall_id` + funzioni `archive_past_events`, `promote_next_waitlist`, `release_expired_waitlist_promotions` nel dump consolidato.
- Bootstrap su nuovo Supabase project ora coerente: schema.sql + le 7 migration in `supabase/migrations/` (13 → 21).

### `README.md` riallineato
- Sezione "Funzionalità implementate" con checklist `[x]` reale: auth, Stripe, cancellazioni, waitlist, mappa satellitare, GDPR, Sentry, staging.
- Sezione "Roadmap aperta" ridotta a 3 voci reali (Resend, dominio, notifica admin).
- Aggiunta sezione "Bootstrap database" con sequenza schema.sql + migrations + Supabase Auth config.

---

## 🆕 Bug risolti in sessione (27 Apr, Opus)

### BUG-038 — Admin mostrava prenotazioni di mercati passati con bottone "Annulla"
- **Sintomo**: dashboard admin elencava bookings di eventi conclusi e permetteva di annullarle (distorcendo storico/statistiche).
- **Fix**:
  - `app/admin/page.js`: query bookings filtrata `events.date >= today` (inner join). Le prenotazioni passate restano nel DB (e nel profilo utente con badge "Passata") ma non appaiono nella dashboard "operativa".
  - `components/AdminBookingRow.jsx`: per le prenotazioni di eventi passati (caso edge: se il filtro non basta) il bottone "Annulla" è sostituito da label "Storico".
- **Stato**: ✅ RISOLTO

### BUG-039 — Mercati passati restavano "Attivi" nell'admin
- **Sintomo**: gli eventi conclusi continuavano a essere `active=true`, mescolati ai mercati futuri nella dashboard.
- **Fix**:
  - **DB**: migration `19_auto_archive_past_events_and_waitlist_promote` aggiunge funzione `archive_past_events()` SECURITY DEFINER + cron `pg_cron` ogni notte alle 03:15 → setta `active=false` per eventi con `date < current_date`. Eseguito subito un primo run: 2 eventi passati archiviati su staging.
  - **UI**: dashboard admin separa **Eventi attivi** (sezione principale) e **Archivio** (sezione collassabile `<details>` con tutti gli eventi passati o disattivati). Lo storico è sempre accessibile in 1 click.
- **Stato**: ✅ RISOLTO

### BUG-040 — Email post-cancellazione/rimborso non inviate
- **Sintomo**: quando admin annulla o approva richiesta cancellazione, l'utente non riceve nessuna notifica email.
- **Stato**: ⏳ PARCHEGGIATO (dipende da Resend onboarding). Quando si implementa la pipeline email transazionali, va aggiunto in:
  - Webhook Stripe (conferma prenotazione)
  - Cancellation API (notifica all'utente quando l'admin approva con/senza rimborso)
  - Promote waitlist API (notifica all'utente promosso che ha 24h per pagare)

### BUG-041 — Lista d'attesa solo passiva (admin poteva solo rimuovere)
- **Sintomo**: nessun flusso di assegnazione automatica/manuale quando un posto si libera.
- **Idea Salandra**: lista d'attesa **generale** (qualsiasi posto) o **specifica** per posto. Quando si libera, primo in lista riceve un booking pending con scadenza 24h.
- **Fix**:
  - **DB** (migration `19`): `waitlist.stall_id uuid` (nullable, NULL=lista generale, valorizzato=lista posto specifico) + `bookings.from_waitlist boolean` + `bookings.waitlist_promoted_at timestamptz`
  - **Funzione DB** `promote_next_waitlist(p_event_id, p_stall_id)`: priorità a chi ha targetato lo specifico posto, poi lista generale. Crea booking `pending` con `from_waitlist=true` + `waitlist_promoted_at=now()`. Se utente è al limite booking (P0001), salta e prova il successivo. Rimuove la entry dalla waitlist.
  - **Funzione DB** `release_expired_waitlist_promotions()`: cron orario, cancella i pending da waitlist scaduti (> 24h) e auto-promuove il successivo.
  - **API admin** `POST /api/admin/bookings/[id]/cancel`: dopo refund Stripe, chiama `promote_next_waitlist(event_id, stall_id)` per assegnare automaticamente il posto liberato.
  - **API admin** `POST /api/admin/waitlist/[id]/promote`: promozione manuale di un'iscrizione (per lista generale, sceglie il primo posto libero).
  - **UI admin** `components/AdminWaitlistRow.jsx`: bottone "Promuovi" oltre a "Rimuovi". Crea booking pending 24h.
- **Email/notifica al promosso**: parking BUG-040 (Resend).
- **Stato**: ✅ RISOLTO (logic + DB + UI). Email da implementare con Resend.

---

## 🩺 Audit Codex 2026-04-27 — punti chiusi

### [P1] BUG-027 reale fix — `npm run build` ora verde
- **Diagnosi Codex**: `dynamic = 'force-dynamic'` su `app/opengraph-image.js` (metadata file convention) NON salta il prerender al build → `@vercel/og` su Windows continuava a fallire con `TypeError: Invalid URL`.
- **Fix definitivo**: rimosso `app/opengraph-image.js`, creata route API `app/api/og/route.js` (che NON viene prerender al build). `app/layout.js` referenzia `metadata.openGraph.images = ['/api/og']` esplicitamente. Aggiunti header `Cache-Control` per evitare rigenerazione su ogni preview.
- **Stato**: ✅ RISOLTO definitivo.

### [P2] GOODS_TYPES residuo in WaitlistWidget — chiusura BUG-023
- **Fix**: rimossa l'ultima copia hardcoded di `GOODS_TYPES` in `components/WaitlistWidget.jsx`. Ora importa da `lib/validate`.
- **Stato**: ✅ RISOLTO definitivo.

### [P3] Accessibility: `aria-pressed` su `role="gridcell"`
- **Fix**: `components/StallMap.jsx` riga 390 cambiato da `aria-pressed` a `aria-selected` (compatibile con role gridcell).
- **Stato**: ✅ RISOLTO

### [P3] react-hooks/exhaustive-deps in StallMapSatellite
- **Fix**: `MapController` ora usa `centerKey` (stringa) come dep stabile invece di indici `center[0], center[1]`.
- **Stato**: ✅ RISOLTO

### Punti audit ancora aperti (non bloccanti)
- **Date helper UTC vs locale**: `toISOString().slice(0, 10)` usato in 9+ file. Per il volume Pro Loco (1 timezone, eventi giornalieri) rischio teorico (drift di 1-2h al confine notturno). Tech-debt da affrontare se diventiamo multi-region.
- **README.md / docs/SECURITY.md fuori sync**: aggiornati in questa sessione (vedi devlog).
- **EventForm.jsx commenti ambigui rows/cols**: aggiornati.
- **GDPR `consent_at` non valorizzato in bootstrap profilo**: tech-debt — quando un utente fa signup il consent va salvato esplicitamente. Da affrontare nella fase email Resend.

---

## 🆕 Bug risolti in sessione (26 Apr notte tarda, Opus)

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
