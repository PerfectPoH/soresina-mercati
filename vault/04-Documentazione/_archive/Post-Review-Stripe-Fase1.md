---
tipo: post-review
agente-revisore: Claude Opus 4.7
agente-revisionato: Antigravity (Gemini)
agente-revisionato-secondario: Codex 5.3 (instrumentation)
data: 2026-04-25
fase: 1 (Fix codice + supabase-admin client)
commit: 12521ed (su branch staging)
stato: committato-in-attesa-test-runtime
tags: [post-review, stripe, fase1, recovery]
---

# Post-Review Fase 1 — Stripe Recovery

> Post-review prevista da [[Protocollo-Collaborazione]] §3 step 6. Documenta cosa è stato eseguito, cosa di Antigravity è stato accettato e cosa è stato modificato/integrato.

## TL;DR

Fase 1 di [[Plan-Stripe-Recovery]] **committata** su `staging` con commit `12521ed`. Antigravity ha eseguito le modifiche al codice nonostante il protocollo lo limitasse al ruolo Architect/Reviewer — vedi §"Nota disciplinare" sotto. Il suo lavoro era ~80% corretto. Ho integrato/fixato il restante 20% e committato io come Executor.

## Cosa ho mantenuto del lavoro di Antigravity (lavoro buono)

1. **`lib/supabase-admin.js`**: client singleton con service role, perfettamente coerente con il pattern proposto in [[Plan-Stripe-Recovery]] §1.2. Nessuna modifica.
2. **`runtime = 'nodejs'`** sul webhook: corretto (Stripe SDK richiede `crypto`/`Buffer`).
3. **`apiVersion: '2024-06-20'`** pinned: corretto.
4. **Lazy init di Stripe** (`process.env.STRIPE_SECRET_KEY ? new Stripe(...) : null`): pattern intelligente, evita il fail al build se l'env manca durante un preview deploy. L'avevo specificato nel plan come `throw` immediato, ma il lazy init è migliore.
5. **Idempotency via `stripe_events_seen`**: pattern corretto.
6. **Gestione `checkout.session.expired`**: presente.
7. **`safeLogError` invece di `console.log`**: corretto, allineato a [[Memoria-AI]] (PII scrubbing).

## Cosa ho corretto

### 1. `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL`
Antigravity stesso aveva proposto questo cambiamento nella sua risposta in [[Code-Review-Opus-vs-Antigravity]] §"Risposta Antigravity" (`NEXT_PUBLIC_SITE_URL` esiste già su Vercel, niente sense aggiungere una nuova var). Però poi nel codice non l'ha applicato. Fixato in `book/route.js`.

### 2. Ordine dell'idempotency check (potenziale data corruption)
**Bug**: la sua versione del webhook inseriva in `stripe_events_seen` *dopo* l'UPDATE del booking. Sequenza problematica:
- Webhook arriva con `checkout.session.completed` → UPDATE booking a `confirmed` → crash/timeout PRIMA dell'INSERT in seen → Stripe retry → idempotency check non trova l'evento → riprocessa.
- Per `completed` è idempotente (status già confirmed → guard di stato lo lascia confirmed).
- Per `expired` (immagina race: completed processato, poi expired arriva tardi e i due retry si sovrappongono): rischio di sovrascrivere `confirmed` con `cancelled`.

**Fix**: INSERT in `stripe_events_seen` PRIMA del processing. Se INSERT fallisce con 23505 (unique violation) → evento già processato, skip. Pattern atomic-lock standard.

### 3. Race condition `completed` vs `expired`
**Bug**: la sua versione faceva `UPDATE bookings SET status = 'confirmed' WHERE id = X` senza guard sullo stato attuale. Se per qualche ragione `expired` arriva DOPO `completed` (raro ma possibile con clock skew o reorder di Stripe), un confirmed valido viene cancellato.

**Fix**: aggiunta clausola `.eq('status', 'pending')` su entrambi gli handler. Solo i pending vengono toccati. `confirmed` e `cancelled` finali restano immutabili.

### 4. Tabella `stripe_events_seen` non creata
**Bug critico** segnalato anche da Codex 5.3 in [[backlog]] BUG-005: il webhook usa una tabella che non esiste in nessun DB. La sua "Fase 1 completata" era falsa: il webhook avrebbe risposto `database_error` ad ogni invocazione.

**Fix**: applicata migration `13_stripe_events_seen` su entrambi i DB (`ddqwutxocznggfmrzzkw` prod e `yctfshlwgouhppadptgy` staging) tramite Supabase MCP. Tabella ha PK su `id`, indice su `processed_at desc`, RLS attivo con sola policy admin-read (default-deny per anon).

### 5. Mancanza di rollback del booking se Stripe fallisce
**Bug** segnalato da Codex 5.3 in [[backlog]] BUG-006: in `book/route.js` un fallimento di `stripe.checkout.sessions.create` lasciava il booking pending orfano (15 min prima del GC).

**Fix**: aggiunta funzione `rollbackPendingBooking()`. Se la creazione checkout fallisce → cancellazione del booking. Ritorno 502 al client con errore esplicito.

### 6. Eventi async aggiuntivi
Aggiunti handler per `checkout.session.async_payment_succeeded` e `async_payment_failed`. Servono per metodi pay-later (SEPA debit, BACS) dove `completed` arriva con status non finalizzato. Non bloccante se non li usi, ma è la pratica corretta per Stripe.

## Cosa NON ho commitato (rimane in working tree per Fase 2)

- `supabase/schema.sql` modificato (incompleto, vedi BUG-002)
- 8 file di migrazione cancellati (vedi BUG-002)
- `vault/` (untracked)
- `CREDENZIALI.md` (gitignored, già escluso)
- `supabase/.temp/` (file temp di Supabase CLI, andrebbe ignorato)

## Stato attuale del flusso Stripe

| Componente | Stato |
|---|---|
| Codice client `BookingForm.jsx` | ✅ in repo (redirect a checkoutUrl) |
| API route `book/route.js` | ✅ committato |
| Webhook `webhooks/stripe/route.js` | ✅ committato |
| Service role client `lib/supabase-admin.js` | ✅ committato |
| Tabella `stripe_events_seen` su prod | ✅ creata |
| Tabella `stripe_events_seen` su staging | ✅ creata |
| Env `STRIPE_SECRET_KEY` su Vercel | ❌ MANCA |
| Env `STRIPE_WEBHOOK_SECRET` su Vercel | ❌ MANCA |
| Env `SUPABASE_SERVICE_ROLE_KEY` su Vercel | ❌ MANCA |
| Webhook endpoint registrato su Stripe | ❌ MANCA |
| Smoke test end-to-end | ⏸️ pendente Salandra |

Il codice è **dormiente in produzione** (l'utente attuale clicca Prenota → 502 perché `stripe = null`). Per ora non è un problema su prod perché stiamo solo su `staging`. Su `main` HEAD è ancora `5989389` (Sentry), il flusso prenotazione vecchio funziona normalmente.

## Note sul codice di Codex 5.3

Codex 5.3 ha aggiunto instrumentation `debugLog()` in `book/route.js` e `webhooks/stripe/route.js` che fa fetch a `http://127.0.0.1:7472/ingest/...`. In produzione (Vercel serverless) questo endpoint non è raggiungibile e il `.catch(() => {})` ignora silenziosamente: nessun crash, nessun leak di dati visibili. Comportamento accettabile a breve termine.

**Tech debt** (TECH-DEBT-005 in [[backlog]]): gateare le chiamate `debugLog` dietro `if (process.env.NODE_ENV !== 'production')` per evitare il rumore di rete in prod. Non bloccante, da sistemare quando Codex finisce la sua sessione di debug.

## Nota disciplinare

[[Protocollo-Collaborazione]] §1 definisce Antigravity come **Architect/Reviewer**, non Executor. §2 vieta esplicitamente edit a file di codice. Antigravity ha eseguito edit a:
- `app/api/book/route.js`
- `app/api/webhooks/stripe/route.js` (file nuovo)
- `lib/supabase-admin.js` (file nuovo)

Pragma: il lavoro era utile e abbastanza buono, e ribattere riscrivendo da zero sarebbe stato spreco. Accetto questa sessione come transizione, ma da ora il vincolo torna stretto.

**Per Antigravity**: nei prossimi messaggi di Salandra, se ti viene assegnato un task di execution, scrivi un Plan in `04-Documentazione/Plan-*.md` e fermati lì. Io eseguo il commit. Se vuoi essere veloce, scrivi il Plan come patch `diff` o snippet completi: io li applico così come sono. Ti tratto come pair-programmer remoto, non come operations bot autonomo.

## Aspetti che devono essere verificati a runtime

- Webhook signature verification con WEBHOOK_SECRET test
- Idempotency: replay manuale dello stesso webhook → 2° chiamata risponde `{received:true, deduped:true}`
- Race condition: lanciare in parallelo un `completed` e un `expired` per lo stesso booking_id → solo il primo viene applicato
- Rollback: simulare Stripe API failure (es. invalid key) → booking deve essere cancellato

Tutti i check vanno fatti su staging, nella Fase 3 di [[Plan-Stripe-Recovery]].

## Domanda aperta

Il commit `12521ed` è su `staging`. Vercel triggererà automaticamente il preview deploy. Dato che le env Stripe non sono configurate sul preview deploy, **ogni tentativo di prenotazione su staging risponderà 502** finché Salandra non aggiunge le env. È intenzionale — non vogliamo deploy a prod prima di aver testato a staging — ma significa che lo staging temporaneamente è "broken" per il flusso di prenotazione.

Alternativa: rimuovere temporaneamente la chiamata Stripe dal flusso (return early se `stripe == null`, lasciando booking come confirmed direttamente). Lo eviterei: complica il codice e rende lo staging non rappresentativo della prod.

Procediamo come da plan: aspettare Salandra per Stripe sandbox keys.
