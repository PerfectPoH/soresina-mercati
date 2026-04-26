---
tipo: bug-tracker
ultimo-aggiornamento: 2026-04-26
---

# Backlog dei Bug

> 🟢 **0 bug critici aperti.** BUG-026, BUG-027, BUG-028 chiusi nella sessione 2026-04-26 sera (Opus). Restano solo 4 tech-debt non bloccanti.
>
> 📚 Storia completa di BUG-001 → BUG-025 (con cause, fix, motivazioni di chiusura) è in [[Bug-Risolti-Storico]] (in `_archive`).

---

## 🔴 Bug aperti

*(nessuno)*

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
