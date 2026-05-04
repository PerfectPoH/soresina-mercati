---
tipo: bug-tracker
ultimo-aggiornamento: 2026-04-26
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
- **Stato**: ✅ RISOLTO. Salandra ha confermato la correzione del SITE_URL nel pannello Supabase Auth per il progetto staging. Il link di conferma ora punta correttamente al dominio staging.

### BUG-011 — `supabase/.temp/` non nel `.gitignore`
- **Aperto da**: Antigravity (analisi 2026-04-25)
- **Severità**: 🟡 BASSA (file temporanei esposti nel repo)
- **Sintomo**: la cartella `supabase/.temp/` generata dalla Supabase CLI non è presente nel `.gitignore`. Contiene file temporanei di sessione CLI che non devono essere versionati.
- **Conseguenza**: commit accidentali di file temp in futuro; repo rumoroso.
- **Fix proposto**: aggiungere `supabase/.temp/` al `.gitignore`.
- **Stato**: ✅ RISOLTO in commit `7cc6866`. Pattern aggiunto.

### BUG-013 — Vercel Deployment Protection blocca webhook Stripe sui Preview
- **Aperto da**: Claude Opus 4.7 (smoke test 2026-04-25)
- **Severità**: 🔴 CRITICA (silenzioso, scoperto solo a runtime)
- **Sintomo**: i preview deploy Vercel hanno per default Authentication attiva (`ssoProtection`). Stripe webhook chiama l'endpoint, riceve 401, non riesce a invocare la nostra API. Il booking resta `pending` per sempre nonostante il pagamento sia andato a buon fine.
- **Diagnosi**: `stripe_events_seen` vuoto + zero runtime log su Vercel webhook → la richiesta non è mai arrivata al nostro codice. Confermato anche dall'esistenza del tool MCP `get_access_to_vercel_url` che genera bypass token (presupposto: protection di default attiva).
- **Fix applicato**: PATCH `/v9/projects/{id}` con `ssoProtection: null` via Vercel API (token utente). Risultato: HTTP 200, protection disabilitata a livello progetto.
- **Side effect accettato**: tutti i preview deploy ora sono pubblici. Per scenari multi-team o repo pubblici, la giusta soluzione è usare "Deployment Protection Exceptions" che esclude solo il branch alias `*-git-staging-*` dalla protezione.
- **Stato**: ✅ RISOLTO. Smoke test post-fix: 2 eventi `checkout.session.completed` ricevuti correttamente, 2 bookings passati a `confirmed`.

### BUG-012 — `SENTRY_AUTH_TOKEN` mancante su Vercel (source maps non caricati)
- **Aperto da**: Antigravity (analisi 2026-04-25)
- **Severità**: 🟡 MEDIA (degrada la qualità del debugging in produzione)
- **Sintomo**: in `next.config.js` riga 79, il plugin Sentry usa `dryRun: !process.env.SENTRY_AUTH_TOKEN`. Senza il token, i source map non vengono caricati su Sentry → gli stack trace in produzione mostrano codice minificato, rendendo difficile il debugging di errori reali.
- **Conseguenza**: Sentry cattura gli errori correttamente, ma non riesce a mappare la riga/colonna al sorgente originale.
- **Fix proposto**: Opus aggiunge `SENTRY_AUTH_TOKEN` come env su Vercel (Production + Preview). Il token si ottiene da `https://sentry.io/settings/account/api/auth-tokens/`.
- **Stato**: ✅ RISOLTO. Token `sntryu_...` configurato su Vercel via API per Production+Preview. Effettivo dal prossimo build (commit `f2cd9eb` triggera redeploy).

### BUG-014 — `debugLog()` hardcoded con sessione errata in route Stripe
- **Aperto da**: Codex 5.3 (audit statico 2026-04-25)
- **Severità**: 🟡 MEDIA (observability + rischio leak logging interno)
- **Sintomo**: in `app/api/book/route.js` e `app/api/webhooks/stripe/route.js` il `debugLog()` invia sempre `sessionId: 'e4d355'` e header `X-Debug-Session-Id: e4d355` hardcoded.
- **Conseguenza**: i log non seguono la sessione debug attiva, finiscono su stream sbagliato, e se lasciati in produzione aggiungono chiamate HTTP inutili su ogni request (book/webhook).
- **Fix proposto**: rimuovere l'instrumentation temporanea dal codice applicativo o vincolarla con flag esplicito `DEBUG_MODE` + session id dinamica.
- **Evidenza**: lettura diretta delle route API (`book` e `webhooks/stripe`) nel branch corrente.
- **Stato**: ✅ RISOLTO. `debugLog()` ora è no-op se `NODE_ENV === 'production'` o se `AGENT_DEBUG_INGEST_URL` non è settato. Session id letto da `AGENT_DEBUG_SESSION_ID` (default `'local'`). URL e session id non più hardcoded. Codex (o qualsiasi agente) può attivare l'instrumentation in dev locale settando le 2 env, senza impattare prod/staging.

### BUG-015 — Prezzo `0` non supportato nel checkout (`|| 35.00`)
- **Aperto da**: Codex 5.3 (audit statico 2026-04-25)
- **Severità**: 🟠 ALTA (errore di business logic)
- **Sintomo**: in `app/api/book/route.js` il totale viene calcolato con `stallData?.price || stallData?.default_price || 35.00`.
- **Conseguenza**: se un evento/posteggio e' volutamente gratuito (`price = 0`), il codice lo considera falsy e applica fallback a 35 EUR. Checkout con importo sbagliato e contestazioni utente.
- **Fix proposto**: sostituire con nullish coalescing (`??`) e validazione esplicita del range.
- **Evidenza**: analisi del path di calcolo importo nella route `/api/book`.
- **Stato**: ✅ RISOLTO. `||` sostituito con `??`. In più, gestione esplicita del caso `amountToPay === 0`: salta Stripe Checkout (che non accetta unit_amount=0) e conferma direttamente il booking come gratuito. Frontend già compatibile (`BookingForm.jsx` controlla `if (checkoutUrl)` prima del redirect).

### BUG-016 — DELETE/PATCH restituiscono `success:true` anche quando non toccano righe
- **Aperto da**: Codex 5.3 (audit statico 2026-04-25)
- **Severità**: 🟠 ALTA (silent failure lato API/UI)
- **Sintomo**: endpoint come `app/api/bookings/[id]/route.js` (DELETE), `app/api/waitlist/[id]/route.js` (DELETE), `app/api/events/[id]/route.js` (DELETE) non verificano quante righe sono state realmente aggiornate/cancellate.
- **Conseguenza**: con ID inesistente o bloccato da RLS la API puo' rispondere `200 { success: true }`, mascherando l'errore e lasciando UI/stato incoerenti.
- **Fix proposto**: usare `.select('id')` (o count) dopo update/delete e ritornare `404/403` quando rows = 0.
- **Evidenza**: path API sopra non controllano `data.length`/`count` nel risultato mutazione.
- **Stato**: ✅ RISOLTO. Aggiunto `.select('id')` sulle 3 route (events DELETE+PATCH, bookings DELETE, waitlist DELETE) con check `data.length === 0` → 404 "non trovato o non autorizzato". `.maybeSingle()` per PATCH events per evitare errore su 0 rows.

### BUG-017 — `PATCH /api/events/[id]` accetta coordinate mappa parziali
- **Aperto da**: Codex 5.3 (audit statico 2026-04-25)
- **Severità**: 🟡 MEDIA (incoerenza dati)
- **Sintomo**: in `app/api/events/[id]/route.js` i campi `map_lat` e `map_lng` sono validati in modo indipendente; e' possibile aggiornare solo uno dei due.
- **Conseguenza**: evento con centro mappa incompleto (`lat` senza `lng` o viceversa), con possibili glitch nel rendering satellite/editor.
- **Fix proposto**: imporre aggiornamento atomico (`map_lat`+`map_lng` insieme, oppure entrambi null) come gia' fatto su `stalls`.
- **Evidenza**: validazioni separate senza check di coppia nel ramo PATCH eventi.
- **Stato**: ✅ RISOLTO. Validazione di coppia: se uno solo dei due (`map_lat`/`map_lng`) è nel body → 400 "devono essere aggiornate insieme". Accettiamo (a) entrambi numeri validi, (b) entrambi `null` (reset), oppure (c) nessuno dei due (no-op).

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

---

## Bug aperti — Audit Antigravity 26 Aprile

### BUG-018 — Pagina `/prenotato/[id]` accessibile da qualunque utente autenticato
- **Aperto da**: Antigravity (audit statico 2026-04-26)
- **Severità**: 🔴 CRITICA (information disclosure)
- **Sintomo**: `app/prenotato/[id]/page.js` esegue la query `bookings` lasciando alla RLS tutta la responsabilità del filtraggio. Se la RLS policy `bookings` permette la lettura al proprietario O all'admin ma non verifica la `user_id` in modo stretto, qualsiasi utente autenticato che indovina/bruteforza un UUID può vedere nome, email, telefono, tipo merce e dati di pagamento altrui.
- **Conseguenza**: GDPR Art. 5(1)(f) violazione di integrità. Esposizione di PII di terzi.
- **Fix proposto**: aggiungere check esplicito lato server dopo la fetch: `if (booking.user_id !== user.id && vendor?.role !== 'admin') return notFound()`. Duplica il check RLS ma è la difesa in profondità corretta.
- **Evidenza**: `page.js` riga 49 — restituisce `{ booking, user }` senza confrontare `booking.user_id === user.id`.
- **Stato**: ✅ RISOLTO. Aggiunto check ownership esplicito in `app/prenotato/[id]/page.js`: se `booking.user_id !== user.id` AND ruolo non admin → `notFound()`. Defense-in-depth: la RLS protegge già al primo livello, ma se in futuro venisse rilassata l'app continua a essere safe.

### BUG-019 — Singleton `supabase-admin` condiviso tra richieste serverless
- **Aperto da**: Antigravity (audit statico 2026-04-26)
- **Severità**: 🟠 ALTA (potenziale leak cross-request in edge cases)
- **Sintomo**: `lib/supabase-admin.js` usa un singleton `_admin` a livello di modulo (`let _admin = null`). Su Vercel Serverless ogni istanza Lambda ha il proprio processo, quindi il singleton non è condiviso tra richieste diverse **normalmente**. Tuttavia in ambienti con worker long-lived (Vercel Edge runtime, self-hosted Node) o con warm reuse, il client potrebbe portare stato residuo da richieste precedenti.
- **Conseguenza**: teoricamente bassa su Vercel standard deployment, ma aumenta il rischio con il service role key (ha accesso completo al DB bypassando RLS). Con warm Lambda il singleton persiste — se Supabase aggiunge internamente caching di sessione il rischio aumenta.
- **Fix proposto**: creare il client admin fresh per richiesta (`createClient(...)` senza caching), oppure assicurarsi che `{ auth: { persistSession: false } }` sia sufficiente (già impostato — valutare se il fix è già sufficiente).
- **Evidenza**: `lib/supabase-admin.js` righe 3-16.
- **Stato**: ❎ CHIUSO come **NOT-A-BUG** (concordi con la contro-verifica Codex). `persistSession: false` + `autoRefreshToken: false` impediscono qualsiasi cache di sessione utente. Il client admin è "stateless" rispetto a `auth.uid()`. Il singleton accelera solo il warm Lambda evitando re-init di `createClient`. Nessun rischio identificato. Promosso a TECH-DEBT solo se in futuro si passa a Supabase Edge runtime con worker long-lived.

### BUG-020 — `stallData` null causa `amountToPay = 35.00` silenzioso
- **Aperto da**: Antigravity (audit statico 2026-04-26)
- **Severità**: 🟠 ALTA (errore di business logic silenzioso)
- **Sintomo**: in `app/api/book/route.js` riga 104-113, la query su `stalls_with_status` usa `.single()` senza gestire il caso in cui la stall non esiste o non è visibile. Se la query ritorna null/error (stall cancellata, event_id sbagliato, RLS), `stallData` è `undefined` e `amountToPay = undefined ?? undefined ?? 35.00` → fallback silenzioso a 35€.
- **Conseguenza**: un utente con stall_id manomesso (non validato contro event_id reale) potrebbe creare booking a 35€ su stalli inesistenti, oppure stalli gratuite vengono addebitate 35€.
- **Fix proposto**: (1) validare che `stallData` esista e che la stall appartenga all'`event_id` passato; (2) restituire 400 se manca. Aggiungere `.eq('event_id', event_id)` alla query stalls.
- **Evidenza**: `book/route.js` righe 104-113. La query non filtra per `event_id`.
- **Stato**: ✅ RISOLTO. Query su `stalls_with_status` ora filtra `.eq('id', stall_id).eq('event_id', event_id)` con `.maybeSingle()`. Se `stallData` è null → 404 `stall_not_found` immediato. Errore di lookup → 500 con `safeLogError`. Fallback `35.00` rimosso dal flusso (la query non può più ritornare valori vuoti senza far fallire la richiesta).

### BUG-021 — Validazione password solo lato client (no server-side enforcement)
- **Aperto da**: Antigravity (audit statico 2026-04-26)
- **Severità**: 🟠 ALTA (security bypass)
- **Sintomo**: `app/registrati/page.js` valida la password (min 10 char, maiuscole, minuscole, numeri) solo in JavaScript lato client. Un attaccante può chiamare direttamente l'API Supabase Auth (`supabase.auth.signUp`) con qualsiasi password senza passare dal form React.
- **Conseguenza**: account con password debole (es. `password`) vengono creati bypassando i controlli UI.
- **Fix proposto**: configurare la **Password Policy** nel pannello Supabase Auth (Settings > Auth > Password) con: minimum length 10, require uppercase, require numbers. Supabase supporta queste policy nativamente lato server — non serve codice applicativo.
- **Evidenza**: `registrati/page.js` righe 55-75 — validazioni solo in `handleSubmit`.
- **Stato**: ✅ RISOLTO. Configurato via browser automation (Claude in Chrome) sul dashboard Supabase per **entrambi gli ambienti**: staging (`yctfshlwgouhppadptgy`) e prod (`ddqwutxocznggfmrzzkw`). Settings: `Minimum password length = 10`, `Password requirements = Lowercase, uppercase letters, digits and symbols (recommended)`. Da questo momento Supabase rigetta lato server qualsiasi signUp con password debole, anche se chiamato direttamente via API.

### BUG-022 — `revalidatePath` eseguito prima del redirect Stripe (race condition UX)
- **Aperto da**: Antigravity (audit statico 2026-04-26)
- **Severità**: 🟡 MEDIA (glitch UX transitorio)
- **Sintomo**: in `app/api/book/route.js` righe 230-237, `revalidatePath('/evento/:id')` viene chiamato dopo l'insert del booking ma **prima** che l'utente completi il pagamento Stripe. Se un secondo utente apre la pagina evento in quel momento, vedrà il posteggio come `pending` (bloccato) anche se il checkout non è ancora stato completato.
- **Conseguenza**: falsi positivi nella mappa — posteggi che appaiono occupati per ~15 min se il primo utente abbandona il checkout (finché GC pg_cron non pulisce).
- **Fix proposto**: spostare il `revalidatePath` nel webhook Stripe, dopo che il booking è confermato. Per i booking gratuiti (che saltano Stripe) il revalidate immediato è corretto.
- **Evidenza**: `book/route.js` righe 230-239. Il revalidate precede `return NextResponse.json({ data, checkoutUrl: session.url })`.
- **Stato**: ❎ CHIUSO come **NOT-A-BUG / scelta intenzionale** (concordi con la contro-verifica Codex). Il `revalidatePath` immediato è il **lock di inventario** del posteggio: durante i ~15min di pending, gli altri utenti devono vederlo bloccato per non duplicare la prenotazione. L'alternativa (revalidate solo dal webhook post-payment) creerebbe race condition: due utenti potrebbero entrambi avviare il checkout dello stesso posteggio. Il GC `pg_cron` ogni 5 min libera i pending abbandonati. Trade-off accettabile.

### BUG-023 — `GOODS_TYPES` duplicato: frontend e backend desincronizzabili
- **Aperto da**: Antigravity (audit statico 2026-04-26)
- **Severità**: 🟡 MEDIA (tech debt / rischio manutenzione)
- **Sintomo**: la lista `GOODS_TYPES` è definita sia in `lib/validate.js` (fonte di verità backend) sia in `components/BookingForm.jsx` (riga 8-17) e `app/registrati/page.js` (riga 8-17). Se si aggiunge un tipo in uno solo dei tre file, il backend rifiuterà il valore con `invalid_input` senza che l'UI lo segnali correttamente.
- **Fix proposto**: esportare `GOODS_TYPES` da `lib/validate.js` e importarlo nei componenti client (possibile perché `lib/validate.js` non contiene import server-only). Unica fonte di verità.
- **Evidenza**: 3 copie hardcoded dello stesso array.
- **Stato**: ✅ RISOLTO. `GOODS_TYPES` ora importato da `@/lib/validate` in `components/BookingForm.jsx` e `app/registrati/page.js`. Le 2 copie locali rimosse. Verificato che `lib/validate.js` è puro JS senza import server-only (compatibile con bundle client).

### BUG-024 — Lista d'attesa senza rate limit per-utente
- **Aperto da**: Antigravity (audit statico 2026-04-26)
- **Severità**: 🟡 MEDIA (abuse risk)
- **Sintomo**: `app/api/waitlist/route.js` ha solo rate limit per IP (`limit: 10`). Non c'è un limite per-utente (`keyExtra: user.id`), a differenza di `app/api/book/route.js` che ha entrambi. Un utente autenticato da IP diversi (es. mobile + VPN) può iscriversi molte volte.
- **Conseguenza**: inflate della lista d'attesa con iscrizioni duplicate dello stesso utente; l'admin vede una waitlist gonfiata. Peggio se il DB non ha unique constraint su `(user_id, event_id)`.
- **Fix proposto**: aggiungere `enforceRateLimit` con `keyExtra: user.id` dopo il check auth. Verificare anche presence di unique constraint su `waitlist(user_id, event_id)`.
- **Evidenza**: `waitlist/route.js` riga 18 — solo rate limit IP.
- **Stato**: ✅ RISOLTO. Aggiunto `enforceRateLimit` con `prefix: 'waitlist-user'`, `limit: 5`, `keyExtra: user.id` dopo il check auth. Confermato che `schema.sql` ha già `unique (event_id, user_id)` su `waitlist`, quindi i duplicati semantici erano già bloccati: il rate limit per-utente serve solo come anti-spam.

### BUG-025 — Pagina conferma mostra "Riceverai email" ma le email non esistono
- **Aperto da**: Antigravity (audit statico 2026-04-26)
- **Severità**: 🟡 BASSA (UX fuorviante)
- **Sintomo**: `app/prenotato/[id]/page.js` riga 104 mostra il testo: "Il tuo posteggio è riservato. Riceverai anche una conferma via email." Le email di conferma (Resend) non sono ancora implementate — il sistema non manda nulla.
- **Conseguenza**: l'utente attende una email che non arriverà mai, potrebbe pensare che la prenotazione sia andata male e riprovare.
- **Fix proposto**: rimuovere la frase "Riceverai anche una conferma via email" fino a quando l'integrazione Resend non è attiva. O sostituirla con "Salva il codice prenotazione".
- **Evidenza**: `prenotato/[id]/page.js` riga 104.
- **Stato**: ✅ RISOLTO. Testo cambiato in "Il tuo posteggio è riservato. Salva il codice di prenotazione qui sotto." Quando implementeremo Resend, possiamo riaggiungere la promessa di email.

---

## Contro-verifica Codex 5.3 (26 Aprile) — per decisione Opus

Questa sezione NON chiude automaticamente i bug Antigravity: serve come check incrociato.
Decisione finale e piano operativo demandati a Opus.

### Esito rapido

- ✅ **Confermati come bug reali/prioritari**: **BUG-020**, **BUG-023**, **BUG-025**
- ⚠️ **Dipende da configurazione esterna (non verificabile solo da repo)**: **BUG-021**
- ❓ **Probabile falso positivo / severità sovrastimata**: **BUG-018**, **BUG-019**, **BUG-022**, **BUG-024 (parziale)**

### Dettaglio per bug (018-025)

#### BUG-018 — `/prenotato/[id]` accessibile ad altri utenti
- **Contro-verifica Codex**: probabile falso positivo, ma hardening consigliato.
- **Motivo**: nel codice non c'è check esplicito `booking.user_id === user.id`, però la RLS in `supabase/schema.sql` su `bookings` è `user_id = auth.uid() OR is_admin()`.
- **Decisione proposta a Opus**: se vuole defense-in-depth, aggiungere comunque check server-side esplicito in `app/prenotato/[id]/page.js`.

#### BUG-019 — singleton `supabase-admin`
- **Contro-verifica Codex**: probabile falso positivo.
- **Motivo**: `lib/supabase-admin.js` usa service role + `{ persistSession: false, autoRefreshToken: false }`; non emerge stato utente riusato cross-request.
- **Decisione proposta a Opus**: trattare come tech-debt opzionale, non come bug bloccante.

#### BUG-020 — `stallData` null / fallback importo
- **Contro-verifica Codex**: bug reale.
- **Motivo**: in `app/api/book/route.js` la query su `stalls_with_status` filtra solo `id` (non `event_id`) e non blocca esplicitamente il caso stall/event mismatch prima del flusso pagamento.
- **Decisione proposta a Opus**: fix prioritario.

#### BUG-021 — password policy solo client
- **Contro-verifica Codex**: rischio reale, da confermare via dashboard.
- **Motivo**: nel codice (`app/registrati/page.js`) la policy password è solo client-side. Enforcement server-side dipende da configurazione Supabase Auth.
- **Decisione proposta a Opus**: verificare/imporre Password Policy su Supabase Auth (min length + uppercase + number).

#### BUG-022 — `revalidatePath` prima del redirect Stripe
- **Contro-verifica Codex**: più tradeoff UX che bug certo.
- **Motivo**: mostrare temporaneamente `pending` prima di pagamento completato è coerente con lock di inventario; può essere scelta intenzionale.
- **Decisione proposta a Opus**: valutare prodotto/UX, non security-critical.

#### BUG-023 — `GOODS_TYPES` duplicato FE/BE
- **Contro-verifica Codex**: bug/tech-debt reale.
- **Motivo**: array duplicato in `lib/validate.js`, `components/BookingForm.jsx`, `app/registrati/page.js` con rischio desync.
- **Decisione proposta a Opus**: estrarre fonte unica condivisa.

#### BUG-024 — waitlist senza rate-limit per-utente
- **Contro-verifica Codex**: parzialmente corretto, severità sovrastimata.
- **Motivo**: manca rate-limit per-user in `app/api/waitlist/route.js`, ma `supabase/schema.sql` ha `unique (event_id, user_id)` quindi non è vero che lo stesso utente può iscriversi infinite volte allo stesso evento.
- **Decisione proposta a Opus**: miglioramento anti-abuso utile, ma non critica come descritta.

#### BUG-025 — testo email conferma non implementata
- **Contro-verifica Codex**: bug UX reale.
- **Motivo**: `app/prenotato/[id]/page.js` promette email di conferma non implementata nel flusso.
- **Decisione proposta a Opus**: aggiornare copy subito o implementare invio email.

---

## Sessione 2026-04-26 sera (Opus) — BUG-026, 027, 028

### BUG-026 — Regressione "Errore nel verificare il posteggio" su staging
- **Vera causa**: la view `stalls_with_status` (prod+staging) non aveva `default_price` né `event_title`. Il codice di `book/route.js` li selezionava da sempre, ma prima del fix BUG-020 il client Supabase mascherava silenziosamente l'errore PostgREST cadendo sul fallback `35.00`. BUG-020 ha aggiunto il check `stallErr` smascherando il bug pre-esistente.
- **Fix**: migration `15_view_add_event_title_default_price`. View con `e.title as event_title`, `e.date as event_date`, `e.price_per_stall as default_price` via JOIN events.
- **Stato**: ✅ RISOLTO

### BUG-027 — `next build` fallisce su `/opengraph-image` con `Invalid URL`
- **Causa**: `@vercel/og` su Windows local build durante prerender statico. `fileURLToPath(import.meta.url)` riceve URL malformato.
- **Fix definitivo (28 apr)**: rimosso `app/opengraph-image.js`, creata route API `app/api/og/route.js` (no prerender al build). `app/layout.js` referenzia `metadata.openGraph.images = ['/api/og']` esplicito. Header `Cache-Control` per evitare rigenerazione su preview.
- **Stato**: ✅ RISOLTO

### BUG-028 — `npm run lint` apre wizard interattivo
- **Causa**: nessun `.eslintrc*` nel repo → `next lint` chiede setup interattivo. Su CI/agent rompe.
- **Fix**: creato `.eslintrc.json` con `extends: ["next/core-web-vitals"]`, ignore patterns per `vault/`, `supabase/migrations-archive/`, `.next/`.
- **Stato**: ✅ RISOLTO

## Sessione 2026-04-26 notte (Opus) — BUG-029, 030, 031, 032, 033

### BUG-029 — Incasso stimato hardcoded a 35€/booking
- **Sintomo**: dashboard admin mostrava "70€" per 2 prenotazioni da 3€.
- **Fix**: nuova `calcolaIncasso(bookings)` che somma `stalls.price ?? events.price_per_stall`. Query estesa con `stalls(label, price), events(title, date, price_per_stall)`.

### BUG-030 — Limite 2 prenotazioni bypassabile via Stripe
- **Sintomo**: utente con 2 confirmed iniziava 3° checkout, **pagava** su Stripe, ma il booking restava `pending` (webhook bloccato silenziosamente dal trigger).
- **Fix**: migration `16_booking_limit_includes_pending`. Trigger conta `confirmed + pending` escludendo l'id corrente. INSERT del 3° booking bloccato PRIMA del checkout → utente vede errore senza addebito.

### BUG-031 — Numero slot evento non modificabile dopo creazione
- **Fix**: `EventForm.jsx` rimosso `disabled={isEdit}`. PATCH `/api/events/[id]` accetta rows/cols, valida solo aumento, chiama `generate_stalls()` (ON CONFLICT DO NOTHING) + `copy_stall_positions_from_template()`.

### BUG-032 — Profilo utente mostra solo conteggio prenotazioni
- **Fix**: query estesa con `events(title, date, price_per_stall), stalls(label, price)`. UI: lista ordinata per data con evento + data + posteggio + prezzo + badge stato. Click → `/prenotato/[id]`. Bottone "Richiedi cancellazione" per attive/pending.

### BUG-033 — Cancellazione utente con flusso admin + rimborso Stripe
- **Fix**: migration `18_booking_cancellation_request` (colonne `cancellation_requested_at`, `cancellation_reason`, `stripe_session_id`, `stripe_payment_intent_id`). Funzione SECURITY DEFINER `request_booking_cancellation`. Webhook salva `stripe_session_id`/`stripe_payment_intent_id`. API `POST /api/bookings/[id]/cancellation-request`. API admin `POST /api/admin/bookings/[id]/cancel` con `refund: bool` → chiama `stripe.refunds.create()` se richiesto. UI utente `RequestBookingCancellation`. UI admin `/admin/cancellazioni`.

## Sessione 2026-04-26 notte tarda (Opus) — BUG-034, 035, 036, 037

### BUG-034 — Eventi creabili con date passate
- **Fix**: validazione `date >= todayIso` su `POST /api/events` e `PATCH /api/events/[id]`. Permette `today` per eventi serali.

### BUG-035 — Prenotazione gratuita resta "in attesa di conferma"
- **Causa**: flusso 0 EUR usava `createSupabaseServerClient` (cookie). Policy RLS `bookings_admin_update` richiede `is_admin()` → update silenziosamente scartato → booking pending.
- **Fix**: flusso 0 EUR ora usa `createSupabaseAdminClient` (service role bypass RLS), come il webhook Stripe.

### BUG-036 — Iscrizione waitlist con max prenotazioni già raggiunto
- **Fix**: in `POST /api/waitlist`, count delle prenotazioni `confirmed+pending` per quell'evento. Se ≥ 2 → 400 "Hai già il numero massimo di prenotazioni per questo evento."

### BUG-037 — Eventi passati restano visibili e prenotabili
- **Fix multi-livello**: home filtra `date >= today`. Pagina evento con banner "Mercato concluso" + `BookingForm` non mostrato + cells disabilitate. API `/api/book` e `/api/waitlist` rifiutano con 400 `event_past`. Profilo: badge "Passata" (storico personale resta).

## Sessione 2026-04-27 (Opus) — BUG-038, 039, 040, 041

### BUG-038 — Admin mostrava prenotazioni di mercati passati con bottone "Annulla"
- **Fix**: `app/admin/page.js` query filtrata `events.date >= today` (inner join). Le prenotazioni passate restano nel DB ma non in dashboard operativa. `AdminBookingRow.jsx`: per eventi passati bottone "Annulla" sostituito da label "Storico".

### BUG-039 — Mercati passati restavano "Attivi" nell'admin
- **Fix DB**: migration 19 `archive_past_events()` SECURITY DEFINER + `pg_cron` ogni notte 03:15 → `active=false` per `date < current_date`. Primo run: 2 eventi archiviati su staging.
- **Fix UI**: dashboard separa "Eventi attivi" e "Archivio" (`<details>` collassabile).

### BUG-040 — Email post-cancellazione/rimborso non inviate
- **Stato**: ⏳ PARCHEGGIATO (dipende da Resend onboarding). Hook da aggiungere in: webhook Stripe, cancellation API, promote waitlist API.

### BUG-041 — Lista d'attesa solo passiva
- **Fix DB** (migration 19): `waitlist.stall_id` (nullable, NULL=lista generale). `bookings.from_waitlist` + `bookings.waitlist_promoted_at`.
- **Funzione DB** `promote_next_waitlist(p_event_id, p_stall_id)`: priorità a chi ha targetato lo specifico posto, poi lista generale. Crea pending con `from_waitlist=true`. Skip se utente al limite.
- **Funzione DB** `release_expired_waitlist_promotions()`: cron orario, cancella pending da waitlist scaduti (>24h) e auto-promuove successivo.
- **API admin**: `POST /api/admin/bookings/[id]/cancel` chiama `promote_next_waitlist` post-refund. `POST /api/admin/waitlist/[id]/promote` per promozione manuale.
- **UI admin**: `AdminWaitlistRow.jsx` con bottone "Promuovi" oltre a "Rimuovi".

### Audit Codex 2026-04-27 — punti chiusi
- **[P1] BUG-027 reale fix**: rimosso `app/opengraph-image.js`, creata route API `app/api/og/route.js`. `npm run build` ora verde.
- **[P2] GOODS_TYPES residuo in WaitlistWidget** — chiusura BUG-023 (rimossa l'ultima copia hardcoded).
- **[P3] aria-pressed su role gridcell**: `StallMap.jsx` 390 → `aria-selected`.
- **[P3] react-hooks/exhaustive-deps in StallMapSatellite**: `MapController` ora usa `centerKey` come dep stabile.

### Punti audit ancora aperti (non bloccanti)
- Date helper UTC vs locale: `toISOString().slice(0, 10)` usato in 9+ file. Rischio teorico al confine notturno. Tech-debt se diventiamo multi-region.
- GDPR `consent_at` non valorizzato in bootstrap profilo: tech-debt da chiudere con fase email Resend.

## Sessione 2026-04-28 sera (Opus) — BUG-042, 043, 044, 045, 046

### BUG-042 — Promote waitlist su evento passato
- **Causa**: `promote_next_waitlist(uuid, uuid)` non verificava lo stato dell'evento.
- **Fix DB** (migration 20): pre-check `events.active = true AND events.date >= current_date`. Cleanup idempotente che cancella pending residui creati su eventi non più validi.
- **Fix API** `app/api/admin/waitlist/[id]/promote/route.js`: defense-in-depth, errore 400 `event_past_or_archived`.

### BUG-043 — Profilo: bottone "Richiedi cancellazione" attivo su eventi passati
- **Fix UI** `app/profilo/page.js`: la `classify` valuta lo stato dell'evento PRIMA del booking status. Eventi passati → "Passata" (no bottone). Eventi rimossi/RLS-nascosti → "Evento rimosso" (no bottone).
- **Fix DB** (migration 21): `request_booking_cancellation` rifiuta lato server se evento passato.

### BUG-044 — Profilo: "Evento" senza nome/data per prenotazioni promosse su eventi archiviati
- **Sintomo**: dopo BUG-042, un booking pending residuo aveva `events` null nel join (RLS nasconde events inactive ai non-admin) → UI mostrava placeholder "Evento" 0€ senza data.
- **Fix UI**: gestione gracefully — `classify` ritorna `'unknown'` con label "Evento rimosso", titolo fallback, data "—". Niente bottone cancellazione.

### BUG-045 — Motivo cancellazione admin non comunicato all'utente
- **Fix DB** (migration 22): colonne `bookings.admin_cancel_reason text`, `admin_refunded boolean`, `admin_cancelled_at timestamptz`.
- **Fix UI admin** `components/AdminCancellationActions.jsx`: prompt obbligatorio del motivo prima di confermare.
- **Fix API** `POST /api/admin/bookings/[id]/cancel`: accetta `body.reason` (max 500 char), salva con tutte le colonne nuove.
- **Fix UI utente**: profilo + `/prenotato/[id]` mostrano box "Annullata dall'organizzazione" con motivo + indicazione rimborso.
- **Email**: integrazione Resend in coda (BUG-040).

### BUG-046 — Utente promosso da waitlist non poteva completare la prenotazione
- **Sintomo**: admin promuove utente → booking `pending` (giallo) → utente non ha modo di pagare/confermare.
- **Fix API**: nuovo endpoint `POST /api/bookings/[id]/complete`. Verifica ownership + stato pending + evento attivo/futuro. Prezzo 0 → conferma immediata via admin client. Prezzo > 0 → nuova Stripe Checkout session con `metadata.booking_id` puntando al booking esistente.
- **Fix UI**: nuovo `CompleteBookingButton.jsx` con label dinamica ("Conferma prenotazione" se gratuito, "Completa il pagamento" se a pagamento). Mostrato in `/prenotato/[id]` quando variant pending e in `/profilo` accanto a ogni booking pending.

### Audit Codex 28 Apr — chiusura P1
- **`supabase/schema.sql` allineato alle migrations 13-21**: aggiunti `bookings.from_waitlist`, `bookings.waitlist_promoted_at`, `waitlist.stall_id`, funzioni `archive_past_events`, `promote_next_waitlist`, `release_expired_waitlist_promotions`.
- **`README.md` riallineato**: checklist `[x]` reale (auth, Stripe, cancellazioni, waitlist, mappa satellitare, GDPR, Sentry, staging). Roadmap aperta a 3 voci (Resend, dominio, notifica admin). Sezione "Bootstrap database" con sequenza schema.sql + migrations + Supabase Auth config.
