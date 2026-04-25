---
tipo: bug-tracker
ultimo-aggiornamento: 2026-04-25
---

# Backlog dei Bug

Qui verranno segnalati automaticamente dagli agenti eventuali issue noti o debiti tecnici riscontrati durante lo sviluppo.

## Bug Aperti

### BUG-001 — `app/api/book/route.js` non compila (sintassi rotta)
- **Aperto da**: Claude Opus 4.7 (review 2026-04-25)
- **Severità**: 🔴 BLOCCANTE
- **Introdotto da**: Antigravity (sessione 2026-04-25, modifiche non committate)
- **Sintomo**: import statement spaccato a metà con `const stripe = new Stripe(...)` inserito in mezzo (righe 13-19). `next build` fallisce con parser error.
- **Causa**: edit accidentale (insert in punto sbagliato del file)
- **Fix proposto**: vedi [[Plan-Stripe-Recovery]] §1.1
- **Stato**: ✅ RISOLTO in commit `12521ed` (branch staging). Sintassi verificata con `node --check`.

### BUG-002 — `supabase/schema.sql` consolidato non riflette il DB reale
- **Aperto da**: Claude Opus 4.7 (review 2026-04-25)
- **Severità**: 🔴 CRITICA
- **Introdotto da**: Antigravity (sessione 2026-04-25, modifiche non committate)
- **Sintomi**:
  - Mancano colonne presenti nel DB: `stalls.lat`, `stalls.lng`, `events.image_url`, `events.map_lat/lng/zoom`
  - Mancano funzioni `stall_status_of()` e `stall_vendor_name()` (SECURITY DEFINER) — necessarie per la view RLS-safe
  - View `stalls_with_status` riscritta con LEFT JOIN diretto su `bookings` → reintroduce bug RLS leak (utenti anonimi vedono tutti i posteggi `free`) già fixato in `fix-rls.sql`
  - View non gestisce stato `pending` (necessario per Stripe)
  - 8 file di migrazione storica eliminati senza archivio
- **Fix proposto**: vedi [[Plan-Stripe-Recovery]] §2 (dump dal DB reale + archivio migrazioni)
- **Stato**: ✅ RISOLTO in commit `7cc6866` (branch staging). `schema.sql` ricostruito da `pg_get_viewdef` + `pg_get_functiondef` + `pg_policies` su prod. Include colonne reali (`stalls.latitude/longitude`, `events.image_url`, `map_lat/lng/zoom`), view LATERAL con stati (booked/pending/blocked/free), funzioni SECURITY DEFINER, RLS, realtime, stripe_events_seen. Le 8 migrazioni storiche spostate in `supabase/migrations-archive/` con README. Le migration vive (13, 14) in `supabase/migrations/`.

### BUG-003 — Webhook Stripe non aggiorna lo status del booking (RLS blocca UPDATE)
- **Aperto da**: Claude Opus 4.7 (review 2026-04-25)
- **Severità**: 🔴 CRITICA (silent failure)
- **Introdotto da**: Antigravity (sessione 2026-04-25, modifiche non committate)
- **Sintomo**: `app/api/webhooks/stripe/route.js` usa `createSupabaseServerClient()` che richiede cookie utente. Stripe chiama il webhook senza cookie → `auth.uid()` null → `bookings_admin_update` policy filtra → UPDATE non aggiorna nessuna riga → webhook ritorna 200 ma il booking resta `pending`.
- **Conseguenza utente**: l'espositore paga, Stripe conferma, ma il posteggio non è mai confermato sul nostro DB. Dopo 15 min un GC futuro lo libera. Pagamento perso.
- **Fix proposto**: vedi [[Plan-Stripe-Recovery]] §1.2 e §1.3 (nuovo `lib/supabase-admin.js` con service role)
- **Stato**: ✅ RISOLTO in commit `12521ed` (branch staging). `lib/supabase-admin.js` creato. Webhook ora usa client con SERVICE_ROLE_KEY. Da verificare runtime in Fase 3.

### BUG-004 — Env vars Stripe non configurate su Vercel
- **Aperto da**: Claude Opus 4.7 (review 2026-04-25)
- **Severità**: 🟠 ALTA (blocca runtime ma non build)
- **Mancanti**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY` (tutte assenti su entrambi gli scope Production e Preview)
- **Conseguenza**: anche fixati i §1-3, il flusso checkout fallisce a runtime (throw all'avvio del modulo `book/route.js`)
- **Fix proposto**: vedi [[Plan-Stripe-Recovery]] §3.2
- **Stato**: ✅ RISOLTO (parziale) per **Preview**. `STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET` (test), `SUPABASE_SERVICE_ROLE_KEY` (staging), `SENTRY_AUTH_TOKEN` configurati su Vercel via API. `NEXT_PUBLIC_APP_URL` non più necessario (codice migrato a `NEXT_PUBLIC_SITE_URL` esistente). **In attesa per Production**: STRIPE_SECRET_KEY live + STRIPE_WEBHOOK_SECRET live (richiedono onboarding Stripe live + Partita IVA Pro Loco). `SUPABASE_SERVICE_ROLE_KEY` su Production già configurato. Smoke test in corso su `https://soresina-mercati-git-staging-...vercel.app`.

### BUG-005 — Possibile mismatch schema: webhook Stripe dipende da `stripe_events_seen` non presente nello schema unificato
- **Aperto da**: Codex 5.3 (check statico 2026-04-25)
- **Severità**: 🔴 CRITICA (rischio blocco webhook)
- **Sintomo**: `app/api/webhooks/stripe/route.js` esegue insert/delete su `stripe_events_seen` per idempotenza, ma `supabase/schema.sql` non contiene la definizione della tabella.
- **Conseguenza**: se il DB runtime non ha la tabella, il webhook risponde `database_error` (500) e gli eventi Stripe non vengono processati.
- **Fix proposto**: riallineare `supabase/schema.sql` al DB reale (o creare migration dedicata) includendo `stripe_events_seen` con vincolo univoco su `id`.
- **Evidenza**: check statico su codice + schema; **da confermare con test runtime webhook**.
- **Stato**: ✅ RISOLTO. Migration `13_stripe_events_seen` applicata su prod (`ddqwutxocznggfmrzzkw`) e staging (`yctfshlwgouhppadptgy`) tramite Supabase MCP. Tabella ha PK su `id`, indice su `processed_at`, RLS attivo (admin-read only). Schema unificato (`supabase/schema.sql`) verrà riallineato in Fase 2 di [[Plan-Stripe-Recovery]].

### BUG-006 — Prenotazioni `pending` orfane se creazione checkout Stripe fallisce dopo insert booking
- **Aperto da**: Codex 5.3 (check statico 2026-04-25)
- **Severità**: 🟠 ALTA
- **Sintomo**: in `app/api/book/route.js` il record `bookings` viene inserito con stato `pending` prima di `stripe.checkout.sessions.create(...)`.
- **Conseguenza**: in caso di errore Stripe post-insert, il record resta `pending` senza cleanup esplicito; rischio stalli temporanei/incoerenza operativa.
- **Fix proposto**: introdurre rollback esplicito o job di cleanup per pending senza sessione valida/entro TTL.
- **Evidenza**: check statico del flusso; **da confermare con run runtime su errore Stripe simulato**.
- **Stato**: ✅ RISOLTO in commit `12521ed`. Aggiunta funzione `rollbackPendingBooking()` che mette `status=cancelled` se Stripe checkout creation fallisce. Ritorno 502 al client con errore esplicito. Best-effort: se anche il rollback fallisce, il GC dei pending (Fase 2) lo libera entro 15 min.

### BUG-007 — Segreti sensibili committati nel vault (`.obsidian` plugin config)
- **Aperto da**: Codex 5.3 (audit vault 2026-04-25)
- **Severità**: 🔴 CRITICA (secret leak)
- **Sintomo**: `vault/.obsidian/plugins/obsidian-local-rest-api/data.json` contiene valori sensibili in chiaro (`apiKey`, certificato TLS, `privateKey`, `publicKey`).
- **Conseguenza**: esposizione di credenziali e chiavi private nel repository; rischio accesso non autorizzato all'API locale Obsidian e possibile riuso delle chiavi.
- **Fix proposto**: rimuovere subito il file dal tracciamento git, rigenerare API key/certificati del plugin, aggiungere regole `.gitignore` per `vault/.obsidian/plugins/obsidian-local-rest-api/data.json` (e in generale file locali con secret).
- **Evidenza**: verifica diretta del file versionato nel vault durante audit.
- **Stato**: ✅ RISOLTO in commit `7cc6866`. Il vault non era ancora committato (working tree untracked), quindi i segreti non sono mai arrivati su GitHub. `.gitignore` ora esclude `vault/.obsidian/` interamente (profilattico). **Action item per Salandra**: rigenerare comunque l'API key Obsidian + certificati TLS (Settings > Local REST API > Reset API Key) perché il file resta sul disco locale e potrebbe essere stato letto da Codex 5.3 in chiaro.

### BUG-008 — Middleware non protegge rotte API e blocca HTTPS redirect globale
- **Aperto da**: Antigravity (analisi 2026-04-25)
- **Severità**: 🔴 CRITICA (Security misconfiguration)
- **Sintomo**: In `middleware.js`, `export const config = { matcher: ['/admin/:path*'] }` limita l'esecuzione del middleware esclusivamente all'area admin. Questo significa che il redirect da HTTP a HTTPS a riga 10-17 NON viene applicato al resto del sito (es. root, `/api/*`). Tutte le API e il frontend sono esposti in chiaro se l'utente digita http://.
- **Fix proposto**: Rimuovere il matcher restrittivo o usare una regex omnicomprensiva standard: `matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']`.
- **Stato**: ✅ RISOLTO in commit `7cc6866`. Matcher esteso a tutto il sito (escluso `_next/static`, `_next/image`, `favicon.ico`, asset immagine).

### BUG-009 — Import ES Module illegale in `lib/rate-limit.js`
- **Aperto da**: Antigravity (analisi 2026-04-25)
- **Severità**: 🟡 MEDIA (Tech Debt)
- **Sintomo**: L'istruzione `import { NextResponse } from 'next/server'` si trova a riga 70. È una violazione delle specifiche ES Modules. Anche se Webpack lo fa funzionare tramite hoisting, potrebbe rompere in contesti edge.
- **Fix proposto**: Spostare l'import a inizio file.
- **Stato**: ✅ RISOLTO in commit `7cc6866`. Import spostato in cima al file.

### BUG-010 — Link di conferma registrazione su staging punta a `localhost`
- **Aperto da**: Salandra (segnalazione runtime 2026-04-25)
- **Severità**: 🔴 ALTA (blocca onboarding in staging)
- **Sintomo**: dopo registrazione su ambiente staging, il link ricevuto via email (conferma/attivazione account) apre `localhost` invece del dominio staging.
- **Conseguenza**: il nuovo utente staging non completa correttamente il flusso di registrazione sul sito deployato.
- **Fix proposto**: verificare `SITE_URL`/redirect URL in Supabase Auth per il progetto staging e l'uso di fallback `localhost` lato app/env; allineare callback e allowlist URL al dominio staging.
- **Evidenza**: bug riprodotto da utente su staging.
- **Stato**: aperto (da validare con trace runtime e log redirect URL generato).

### BUG-011 — `supabase/.temp/` non nel `.gitignore`
- **Aperto da**: Antigravity (analisi 2026-04-25)
- **Severità**: 🟡 BASSA (file temporanei esposti nel repo)
- **Sintomo**: la cartella `supabase/.temp/` generata dalla Supabase CLI non è presente nel `.gitignore`. Contiene file temporanei di sessione CLI che non devono essere versionati.
- **Conseguenza**: commit accidentali di file temp in futuro; repo rumoroso.
- **Fix proposto**: aggiungere `supabase/.temp/` al `.gitignore`.
- **Stato**: ✅ RISOLTO in commit `7cc6866`. Pattern aggiunto.

### BUG-012 — `SENTRY_AUTH_TOKEN` mancante su Vercel (source maps non caricati)
- **Aperto da**: Antigravity (analisi 2026-04-25)
- **Severità**: 🟡 MEDIA (degrada la qualità del debugging in produzione)
- **Sintomo**: in `next.config.js` riga 79, il plugin Sentry usa `dryRun: !process.env.SENTRY_AUTH_TOKEN`. Senza il token, i source map non vengono caricati su Sentry → gli stack trace in produzione mostrano codice minificato, rendendo difficile il debugging di errori reali.
- **Conseguenza**: Sentry cattura gli errori correttamente, ma non riesce a mappare la riga/colonna al sorgente originale.
- **Fix proposto**: Opus aggiunge `SENTRY_AUTH_TOKEN` come env su Vercel (Production + Preview). Il token si ottiene da `https://sentry.io/settings/account/api/auth-tokens/`.
- **Stato**: ✅ RISOLTO. Token `sntryu_...` configurato su Vercel via API per Production+Preview. Effettivo dal prossimo build (commit `f2cd9eb` triggera redeploy).

## Debito tecnico (non bloccante)

### TECH-DEBT-001 — `Roadmap-Master.md` fuori sincrono con la realtà
- Decine di task marcati `[ ]` ma già implementati (rate limit, validazione, GDPR, dark mode, Sentry, ecc.)
- Riallineare alla TodoList interna (75 task `[completed]`) dopo Fase 1 di [[Plan-Stripe-Recovery]]

### TECH-DEBT-002 — Componenti monolitici
- `components/StallMapSatellite.jsx` (~20KB)
- `components/BookingForm.jsx` (~10KB)
- Refactor in sub-componenti: bassa priorità, post-consegna Pro Loco

### TECH-DEBT-003 — Mancano test automatizzati
- 0 test E2E (Playwright)
- 0 unit test (Vitest)
- Priorità: media. Pre-consegna: smoke test sui 3 flussi critici (signup, prenotazione, admin block)

### TECH-DEBT-004 — Rate limiting in-memory
- `lib/rate-limit.js` usa Map in memoria. Su Vercel serverless è frammentato per istanza.
- Per il volume target (Pro Loco, ~50 prenotazioni/anno) accettabile.
- Da migrare a Vercel KV / Upstash il giorno in cui si va multi-tenant.
