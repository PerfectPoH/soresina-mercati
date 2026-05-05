---
tipo: memoria-ai
ultimo-aggiornamento: 2026-05-03
tags: [apprendimento, regole, feedback-loop, convenzioni-vault]
---

# 🧠 Memoria Condivisa AI (Lessons Learned)

> **[ISTRUZIONE DI SISTEMA PER ANTIGRAVITY, OPUS E CODEX]**
> PRIMA di iniziare qualsiasi task, dovete leggere questo file per non ripetere errori passati e seguire le convenzioni corrette di questo specifico progetto.
> INOLTRE, ogni volta che risolvete un bug insidioso o trovate una soluzione particolarmente elegante in questo progetto, **è vostro dovere aggiornare questo file** aggiungendo la nuova lezione imparata.
>
> 🤖 **[DIRETTIVA SPECIALE PER CLAUDE DESKTOP: INTEGRAZIONE ECC]**
> Sul sistema dell'utente è installato il framework "Everything Claude Code". Le tue *Skill* avanzate, le regole di TDD, e i pattern architetturali si trovano fisicamente in:
> - `C:\Users\barak\.claude\rules\`
> - `C:\Users\barak\.claude\skills\`
> Prima di scrivere codice complesso, **sei autorizzato e incoraggiato** ad accedere in sola lettura a quelle cartelle.
>
> 🛑 **[PROTOCOLLO DI DOPPIA APPROVAZIONE OBBLIGATORIO]**
> ⚠️ **DAL 2026-04-25 il protocollo di collaborazione vincolante è in [[Protocollo-Collaborazione]]**. In caso di conflitto, prevale il file di protocollo.
>
> **Ruoli:**
> - **Opus = Executor** — esegue commit Git, modifiche al codice, configurazioni online (Vercel/Supabase/Stripe/Sentry/Resend). Ha accesso a token e API.
> - **Antigravity = Architect/Reviewer** — propone idee, scrive Implementation Plan, fa code-review preventiva e post-implementazione. **Non scrive codice** né esegue comandi online.
> - **Codex = Architect/Reviewer + Executor locale autorizzato** — dal 2026-05-03 ha pari dignità tecnica di Antigravity per architettura/review, e può applicare modifiche locali quando Salandra lo autorizza esplicitamente in chat. Documenta nel vault quando il task è sostanziale.
>
> **Regole di approvazione:**
> 1. Prima di una modifica, l'agente che propone scrive un "Implementation Plan" in `04-Documentazione/Plan-*.md`.
> 2. L'altro agente fa Code-Review preventiva in `04-Documentazione/Code-Review-*.md`.
> 3. Solo Salandra dà l'OK esplicito in chat. Niente auto-approvazione.
> 4. Se il revisore RIFIUTA, deve elencare i motivi tecnici (es. "Viola RLS", "Crea race condition").
> 5. Ogni modifica completata viene documentata in `02-Devlog/<data>-<agente>-<topic>.md`.
>
> 📖 **REGOLA DI LETTURA OBBLIGATORIA**: prima di rispondere a qualsiasi messaggio di Salandra che richieda un'azione, leggere [[Protocollo-Collaborazione]], questo file, gli ultimi devlog e i piani aperti in `04-Documentazione/`.

---

## Knowledge graph del progetto (Graphify)

> **DA MAGGIO 3, 2026** Graphify e' cablato tramite wrapper locale di progetto. Non assumere che il comando globale `graphify` sia nel PATH: usare sempre gli script npm.

**Entrypoint agente:**
- leggere `vault/INDEX.md`, `[[Protocollo-Collaborazione]]`, questo file e `[[backlog]]` prima di lavorare;
- leggere `graphify-out/GRAPH_REPORT.md` prima di domande architetturali o ricerche larghe;
- usare il grafo per orientarsi, poi leggere i file reali per verificare dettagli e linee.

**Comandi stabili:**
```bash
npm run graph:update
npm run graph:query -- "come il booking interagisce con Stripe?"
npm run graph:path -- "POST()" "createSupabaseAdminClient()"
npm run graph:explain -- "createSupabaseServerClient()"
npm run graph:check
```

**Dopo aver modificato codice:**
1. eseguire `npm run graph:update`;
2. eseguire `npm run graph:check`;
3. se il task e' sostanziale, lasciare devlog/memo nel vault.

**Policy file:**
- `graphify-out/` e' la fonte canonica degli artefatti generati;
- `vault/` e' memoria umana/operativa, non cache del grafo;
- non duplicare `graph.json`, `graph.html`, `GRAPH_REPORT.md` o `cache/` dentro `vault/`;
- non aggiungere a mano nodi al graph: si rigenera da Graphify/tree-sitter.

---

## 🔴 Errori da NON ripetere (Anti-pattern)

### Database / RLS
- **[25 Apr]** **Database Local Setup**: non fare affidamento solo su `schema.sql` per ricreare il DB locale. Lanciare anche tutte le migration in `supabase/migrations/`.
- **[25 Apr]** **Consolidamento schema SQL — non cancellare lo storico**: archiviare in `migrations-archive/` invece di cancellare. L'eliminazione di 8 file ha causato BUG-002.
- **[25 Apr]** **View `stalls_with_status` con SECURITY DEFINER**: mai `LEFT JOIN bookings` diretto in una view pubblica. Pattern: funzioni `stall_status_of(uuid)` e `stall_vendor_name(uuid)` con `SECURITY DEFINER` + `set search_path = public`.
- **[26 Apr]** **Update post-payment usa `createSupabaseAdminClient`, non `createSupabaseServerClient`** (BUG-035). Anche per il flusso 0 EUR. Server-to-server non manda cookie → `auth.uid()` è null → RLS scarta tutte le righe → UPDATE silenziosamente non aggiorna. Stessa logica del webhook Stripe.
- **[28 Apr]** **RLS che nasconde records produce `null` nei join, non errore** (BUG-044). Esempio: `events.active = false` → utente non-admin riceve `events: null` nel join Supabase. Sempre gestire `if (!b.events)` come stato esplicito (es. badge "Evento rimosso") invece di assumere che il join restituisca dati.

### API / Server-side
- **[25 Apr]** **Webhook server-to-server NON usano `createSupabaseServerClient`** (BUG-003). Pattern corretto: `lib/supabase-admin.js` con `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_`).
- **[25 Apr]** **Pinare API version di Stripe SDK**: `apiVersion: '2024-06-20'`. Senza pin il default cambia nel tempo.
- **[25 Apr]** **Webhook Stripe — idempotency**: tabella `stripe_events_seen` o `ON CONFLICT DO NOTHING`. Stripe rinvia in caso di timeout.
- **[26 Apr]** **Server-side date check sempre obbligatorio per eventi passati** (BUG-037, 042, 043). Non fidarsi del filtro UI: difensivo `event_date < today` in `/api/book`, `/api/waitlist`, `request_booking_cancellation`, `promote_next_waitlist`. Curl bypassa l'UI.
- **[26 Apr]** **Trigger di limite contatore deve includere lo stato `pending`** (BUG-030). Contare solo `confirmed` → utente bypassa pagando su Stripe → webhook UPDATE bloccato dal trigger → utente paga senza ricevere prenotazione. Pattern: `count(*) where status in ('confirmed', 'pending') and id != current.id`.
- **[04 Mag]** **Lo stato UI del posteggio non e' una garanzia server-side** (BUG-050, aperto). Se una route riceve `stall_id`, deve verificare lato server che il posteggio sia davvero prenotabile (`stall_status = free`) subito prima dell'insert. Meglio ancora: RPC/constraint atomica DB-side che fa check stato + insert nella stessa transazione. Non fidarsi di mappa, pulsanti disabilitati o dati letti qualche secondo prima.
- **[04 Mag]** **`pending` non e' un solo tipo temporale** (BUG-051, aperto). Nel progetto esistono almeno due pending diversi: Stripe checkout breve (~15 min) e waitlist promotion lunga (24h). Ogni cron/GC/API deve distinguere `from_waitlist` o un equivalente campo di origine, altrimenti un cleanup generico rompe la promessa UX.
- **[04 Mag]** **Creazione Checkout deve essere idempotente per booking** (BUG-052, aperto). Un endpoint che crea Stripe Checkout non deve generare sessioni multiple pagabili per lo stesso booking pending. Pattern: claim atomico/lock sul booking, oppure salvare e riusare `stripe_session_id` finche' la sessione e' valida.

### Vercel / Deploy
- **[25 Apr]** **Vercel preview deploy → Auth Protection blocca webhook esterni** (BUG-013). Patch via `PATCH /v9/projects/{id}` `ssoProtection: null` o "Deployment Protection Exceptions" sul branch staging.
- **[25 Apr]** **`NEXT_PUBLIC_*` env distinte per scope**. Una var con `target: ['production', 'preview']` usa lo stesso valore in entrambi → redirect Stripe/magic-link va sul dominio sbagliato.
- **[26 Apr]** **`@vercel/og` su Windows local build fallisce con `Invalid URL` durante prerender statico** (BUG-027). Fix: route API `app/api/og/route.js` invece di `app/opengraph-image.js` (file convention prerender). `app/layout.js` referenzia `metadata.openGraph.images = ['/api/og']`.
- **[26 Apr]** **`next lint` senza `.eslintrc*` apre wizard interattivo** (BUG-028). Su CI/agent rompe. Sempre creare `.eslintrc.json` minimo (`extends: ["next/core-web-vitals"]`).

### Codice / Edit
- **[25 Apr]** **Edit di file: verificare il risultato dopo modifiche multi-line** (BUG-001). Dopo qualsiasi modifica a file con import block, **rileggere le prime 30 righe** prima di considerare il task chiuso.
- **[25 Apr]** **Rate limiting in-memory NON protegge da DDoS su Vercel Serverless** (memoria frammentata per istanza). OK come placeholder anti-abuse, ma migrare a Vercel KV / Upstash quando si scala.
- **[04 Mag]** **Snapshot immutabile dei valori al momento del commit della transazione** (BUG-047). Mai derivare dati storici (incasso, prezzi, statistiche) da JOIN live su tabelle che possono essere modificate dall'admin. Pattern corretto: salvare il valore congelato in una colonna dedicata sulla riga "transazionale" (es. `bookings.paid_price`). Per le righe esistenti, backfill SQL una-tantum con il valore live al momento del fix. Le UI di lettura usano sempre `coalesce(snapshot, fallback_live)`.
- **[04 Mag]** **Allineare `schema.sql` consolidato a OGNI funzione/colonna toccata dalla migration** (BUG-048, audit Codex). Quando una migration tocca una funzione SECURITY DEFINER esistente (es. `promote_next_waitlist`), aggiornare anche la versione nel dump `schema.sql`. Bootstrap su nuovo Supabase project altrimenti perde la nuova logica. Checklist post-migration: `grep -n "create or replace function <nome>" supabase/schema.sql` per verificare allineamento.
- **[04 Mag]** **Endpoint che operano su righe gia' snapshottate non devono ricalcolare il valore** (BUG-049, audit Codex). Pattern corretto in `complete/route.js`: SELECT include sempre la colonna snapshot (`paid_price`); calcolo `amountToCharge = b.snapshot ?? livePrice`; UPDATE del snapshot SOLO se `b.snapshot == null` (booking vecchio pre-migration). Mai fare `update({ snapshot: livePrice })` cieco: ricreerebbe il bug originale per le righe migrate dalla waitlist. Sempre `.select('id').maybeSingle()` per detection del race condition (409 invece di silent fail).
- **[04 Mag]** **Mai passare function come prop da Server Component a Client Component** (BUG-050, crash /profilo in preview). Next.js 14 richiede che i prop attraverso il boundary RSC siano serializzabili JSON; le function lanciano `An error occurred in the Server Components render`. Pattern corretto: la funzione vive INSIDE il client component (es. `formatDate` dentro `ProfileBookingCard.jsx`). Se la funzione e' usata sia server-side che client, duplica con cura o estrai in un module separato `'use client'` che entrambi possono importare. Sintomo classico: pagina con `<ServerComponent>` che renderizza `<ClientComponent fn={...} />` crasha solo in build/prod, non in dev.
- **[04 Mag]** **Email transazionali Resend: invio fail-safe nei webhook critici** (BUG-040). Pattern in `lib/email.js`: lazy init del client Resend (no crash se `RESEND_API_KEY` manca al build), `sendEmail()` ritorna `{ ok, error }` invece di throw, plain-text fallback automatico via `htmlToText()`. Negli endpoint critici (webhook Stripe `checkout.completed`, admin cancel, waitlist promote) l'`await sendEmail(...)` NON deve far rollback dello state DB se fallisce: il booking e' confermato anche senza email. Usa `.select(...).maybeSingle()` dopo l'UPDATE pending→confirmed per evitare doppio invio email se il webhook viene rigocato (lo `.select` torna null se no row aggiornata = booking gia' confermato). Mittente di default: `onboarding@resend.dev` (Resend testing, 100/day, only own email). Per produzione configurare `RESEND_FROM_EMAIL` con dominio verificato (DNS SPF+DKIM+DMARC).
- **[05 Mag]** **Email HTML dark mode: opt-out esplicito** (richiesta Salandra). Apple Mail e iOS Mail invertono automaticamente i colori di tutto il body se la palette percepita e' "chiara", causando contrasto basso su gradient ambra + testi marroni. Pattern: aggiungere nel `<head>` `<meta name="color-scheme" content="only light">` + `<meta name="supported-color-schemes" content="light">` + `<style>:root { color-scheme: only light; supported-color-schemes: light; }</style>`. Per Outlook.com / Gmail dark (che ignorano i meta) usare classi su tutti gli elementi colorati (es. `.em-card`, `.em-meta`, `.em-link`, `.em-cta`) e una media query `@prefers-color-scheme: dark` che forza i propri colori con `!important`. Tenere i background inline su tutti gli elementi (anche se padre li copre) per ridurre l'ambiguita' delle euristiche di Gmail.
- **[05 Mag]** **Server-side validation di stato risorsa prima dell'INSERT** (BUG-050 Codex). Per ogni operazione che dipende da uno stato (es. "stall_status === 'free'" prima di creare booking), verificare il campo NELLO STESSO SELECT che usi per i prezzi/dati (uno solo round-trip), e ritornare 409 Conflict con messaggio specifico per ogni stato negativo. La RLS + unique index sono safety net ma non coprono tutti gli stati (es. `blocked` non genera unique violation perche' nessun `confirmed` esiste su quel posto). Sintomo classico: utente con tab stale o curl arriva fino al checkout Stripe su un posto blocked, paga, webhook fallisce silenziosamente.
- **[05 Mag]** **GC che condivide tabella ma TTL diversi: filtrare esplicitamente** (BUG-051 Codex). Se una tabella ha righe con stesso `status='pending'` ma TTL operativi diversi (15min checkout abbandonato vs 24h waitlist promosso), il GC piu' aggressivo deve escludere esplicitamente le righe del cron lento via colonna discriminante (es. `coalesce(from_waitlist, false) = false`). Senza questo filtro il primo cron a girare cancella anche le righe del secondo cron, producendo TTL apparente piu' breve di quello documentato. Pattern: ogni `release_expired_*` SQL function deve avere un commento che dichiara quali sottoset di pending tocca e quali esclude.
- **[05 Mag]** **Stripe Checkout idempotency: claim della session_id sul booking** (BUG-052 Codex). Doppio click, due tab, retry post-error possono chiamare piu' volte l'endpoint che crea una Stripe Checkout session. Senza claim, ogni chiamata crea una nuova session: il primo pagamento conferma il booking, le altre session restano "pagabili" ma il webhook su quelle viene scartato dal recheck `status='pending'` (gia' confermato). Pattern: SELECT include `stripe_session_id`. Se ce n'e' una, `stripe.checkout.sessions.retrieve(id)`: status=`complete`/`paid` → return `alreadyPaid:true`; status=`open` con `url` → riusa; altri stati → crea nuova. Subito dopo la create, `UPDATE bookings SET stripe_session_id=:new WHERE id=:id AND status='pending'` (claim atomico). Best-effort sul claim: se fallisce, log ma non rollback (l'utente puo' pagare comunque).

### Codex / Vault
- **[03 Mag]** **Codex promosso a pari ruolo tecnico di Antigravity**: non è più solo auditor read-only. Può proporre piani, fare review, modificare file locali e aggiornare il vault se Salandra lo autorizza in chat. Deve restare tracciabile: leggere vault + Graphify, rispettare working tree, verificare, lasciare devlog/memo quando il task è sostanziale.
- **[01 Mag]** **Dopo ogni audit completo richiesto da Salandra, Codex deve sempre lasciare un memo nel vault per Opus**. Anche se il verdetto e' positivo e anche se non apre bug nuovi. File preferito: `04-Documentazione/Code-Review-Codex-vs-Opus.md`, aggiornando lo storico invece di creare file sparsi.
- **[26 Apr]** **`GOODS_TYPES` (e qualsiasi enum condiviso FE/BE) deve avere fonte unica** (BUG-023). `lib/validate.js` è la SoT. Mai duplicare in `BookingForm.jsx`, `WaitlistWidget.jsx`, `app/registrati/page.js`.
- **[26 Apr]** **Prezzo 0 ≠ falsy** (BUG-015). Usare `??` invece di `||` quando il valore può essere legittimamente `0`. Pattern: `price ?? default`.
- **[26 Apr]** **`debugLog` instrumentation è sempre gatekeeper-ata da env**, mai hardcoded `console.log` con dati personali (BUG-014). `lib/log.js` → `safeLogError` + `scrubString` per nomi/email/telefono.

### Codex regole operative
- **[25 Apr → superata il 03 Mag]** **Codex modalità audit-only**: questa regola storica è stata superata dalla promozione del 2026-05-03. Resta valido il principio di cautela: niente modifiche distruttive, cloud, push o deploy senza richiesta esplicita di Salandra.
- **[25 Apr]** **Prima di ogni azione leggere tutto il vault**: stato reale, decisioni recenti.

---

## 🟢 Cose fatte bene da ricordare (Best Practices)

- **[25 Apr]** **Protezione rotte admin via `middleware.js`** che interroga Supabase SSR per `role === 'admin'`.
- **[25 Apr]** **A11y/SEO**: ogni pagina esporta `metadata` con `viewport` e `themeColor` separati. Skip-link per tastiera.
- **[25 Apr]** **Font via `next/font`** (Inter, Fraunces). No script esterni Google Fonts (GDPR).
- **[25 Apr]** **Flusso Stripe**: booking `pending` quando si genera `checkout.session`. Solo il webhook sposta a `confirmed`. Mai client-side.
- **[26 Apr]** **`pg_cron` per task ricorrenti DB-side** (BUG-039, 041): `archive_past_events()` ogni notte 03:15, `release_expired_waitlist_promotions()` orario. Più affidabile di un cron HTTP esterno (no cold start, no 401 Vercel Auth).
- **[26 Apr]** **Defense-in-depth ownership check** anche se RLS lo fa già (BUG-018). Pattern "belt and suspenders": `if (booking.user_id !== user.id) → notFound()` in app code, anche se RLS già filtra. Se RLS viene rilassata in futuro, l'app code resta sicuro.
- **[26 Apr]** **Auto-promozione waitlist con priorità** (BUG-041): chi ha targetato lo specifico stall ha priorità su lista generale. Se utente al limite booking → skip e prova successivo (loop fino a fine lista).
- **[28 Apr]** **Endpoint `complete` per recuperare booking pending** (BUG-046): per utenti promossi da waitlist o checkout abbandonato. Verifica ownership + stato pending + evento futuro. Se gratuito → conferma immediata via admin client. Se a pagamento → nuova Stripe session con `metadata.booking_id` puntando al booking esistente.
- **[28 Apr]** **Variant UX distinta per stati pending diversi** (BUG-046): "In attesa di pagamento" (waitlist 24h) vs "Pagamento in corso" (Stripe 15min) vs "Prenotazione confermata!". Stesso DB status `pending`, ma UX diversa via flag `from_waitlist`.
- **[28 Apr]** **Cancellazione admin con motivo obbligatorio** (BUG-045): `window.prompt(reasonPrompt, '')` → null/empty cancella l'azione. Salvato in `admin_cancel_reason` + flag `admin_refunded` (boolean, non null). Mostrato in profilo + `/prenotato/[id]` con box dedicato.

---

## 📝 Convenzioni Vault (Come scrivere senza creare nodi a caso)

> Aggiunto il 30 Apr 2026 per evitare la proliferazione di file disorganizzati nel vault.

### Struttura cartelle
```
vault/
├── 00-Progetto/        # Fonti di verità stabili (Memoria-AI, Architettura, Protocollo, Roadmap-Master)
├── 01-Feature/         # Spec di feature in corso/pianificate
├── 02-Devlog/          # Log delle sessioni (1 file per sessione di lavoro)
│   └── _archive/       # Devlog di sessioni passate (>1 settimana)
├── 03-Bug/              # Backlog bug (1 file `backlog.md`) + bug report individuali aperti
│   └── _archive/       # Bug-Risolti-Storico.md + report di bug chiusi
├── 04-Documentazione/  # Stato progetto, code review, plan
│   └── _archive/       # Documenti datati / superati
├── INDEX.md            # Indice navigazione
└── Roadmap.md          # Roadmap progetto
```

### Template **Devlog** (`02-Devlog/YYYY-MM-DD-<agente>-<topic>.md`)
```markdown
---
tipo: devlog
data: YYYY-MM-DD
agente: opus|antigravity|codex
topic: <tema-sintetico>
---

# Sessione <agente> — <topic>

## Contesto
2-3 righe: cosa Salandra ha richiesto, da dove si parte.

## Cosa ho fatto
Lista sintetica delle modifiche (file + 1 riga di sintesi).

## Problemi incontrati
Bug/blocchi e come sono stati risolti (1-2 righe ciascuno, link a `[[BUG-XXX]]` se aperto un report).

## Note per la prossima sessione
Cosa resta aperto, prossimi step, dipendenze esterne.
```

**Regole**:
- **1 file = 1 sessione**. Non concatenare sessioni di giorni diversi.
- **Nome file**: `YYYY-MM-DD-<agente>-<topic-kebab>.md` (es. `2026-04-28-opus-bugs-045-046.md`).
- **Dopo 7 giorni** → spostare in `_archive/`.

### Template **Bug Report** (`03-Bug/BUG-NNN-<slug>.md`)
> Solo per bug **complessi** che richiedono una dedicated page (root cause analysis, multiple commit). Per bug semplici basta una entry in `backlog.md`.

```markdown
---
tipo: bug-report
id: BUG-NNN
data-apertura: YYYY-MM-DD
data-chiusura: YYYY-MM-DD | aperto
severità: 🔴 critica | 🟡 media | 🟢 bassa
aperto-da: salandra | opus | antigravity | codex
stato: aperto | in-fix | risolto | not-a-bug
---

# BUG-NNN — <titolo sintetico>

## Sintomo (cosa vede l'utente)
Descrizione osservabile.

## Riproduzione
Steps per riprodurlo.

## Causa root (post-debug)
Spiegazione tecnica del perché succede.

## Fix
- File modificati + 1 riga di razionale ciascuno.
- Migration SQL (se DB) con numero (es. `migration 22`).

## Verifica
Come confermare che è risolto (test manuale, query SQL, log).
```

**Regole**:
- **ID progressivo** (BUG-001, BUG-002, ...). Mai riusare un ID.
- **Quando chiuso** → mantenere il file con `stato: risolto` per 1 settimana, poi spostare in `_archive/` e aggiungere una sezione in `_archive/Bug-Risolti-Storico.md`.

### `backlog.md` (`03-Bug/backlog.md`)
- **Solo bug attivi** + tech debt non risolto + summary per categoria.
- **Quando un bug viene chiuso** → riassumi in 3-5 righe (sintomo + fix + stato), non copiare l'intero report.
- **A fine sessione** → sposta le sezioni "Bug risolti in questa sessione" in `_archive/Bug-Risolti-Storico.md` mantenendo solo la categoria nel summary.

### Template **Code Review / Implementation Plan** (`04-Documentazione/`)
```markdown
---
tipo: code-review | implementation-plan
data: YYYY-MM-DD
agente: opus | antigravity | codex
oggetto: <feature/bug/file>
---

# <Titolo>

## Obiettivo
1-2 righe.

## Analisi / Plan
Sezioni numerate con priorità (P1/P2/P3).

## Decisione finale
**[Salandra]** OK / NO-GO / Modifiche richieste.

## Esito esecuzione
**[Opus]** Cosa è stato fatto, link al devlog.
```

**Regole**:
- **1 plan = 1 obiettivo**. Niente plan onnicomprensivi.
- **Dopo merge / esecuzione** → muove in `_archive/` se non più consultato.

### `Stato-Progetto-YYYY-MM-DD.md` (`04-Documentazione/`)
- **1 file ogni milestone** (consegna Pro Loco, dominio, Stripe live).
- **Non scrivere uno stato-progetto a settimana**: usa devlog. Stato-progetto è un punto di restart per nuovi onboarding o fine fase.
- **Quando obsoleto** (>2 settimane senza essere stato letto) → `_archive/`.

### Wikilinks (`[[Nome-File]]`)
- **Sempre usarli** quando si menziona un altro file del vault. Mantengono integro il Graph View di Obsidian.
- **Non duplicare contenuti**: se stai scrivendo qualcosa che esiste già altrove, **linka** invece di copiare.

### Cosa NON fare (anti-pattern vault)
- ❌ Creare un file nuovo per ogni piccola idea ("Note-Refactor-X.md", "Pensieri-Stripe.md"). Le idee vanno in `02-Devlog/` (sezione "Note per prossima sessione") o come commit message.
- ❌ Scrivere riassunti onnicomprensivi in `Memoria-AI.md`. Solo lezioni atomiche con data.
- ❌ Lasciare devlog/bug-report/plan a marcire nella root delle cartelle. Se >7 giorni → `_archive/`.
- ❌ Editare `Bug-Risolti-Storico.md` se il bug è ancora aperto. Quel file è solo cronologia.

---

## 🔄 Routine di manutenzione (ogni 2 settimane)

1. Sposta in `_archive/` i devlog >7 giorni.
2. Sposta in `_archive/Bug-Risolti-Storico.md` i bug chiusi >7 giorni.
3. Rivedi `Roadmap-Master.md` se è cambiato qualcosa.
4. Lancia `graphify update .` per rinfrescare il graph.
5. Aggiungi a questa Memoria-AI le nuove lezioni della sessione (1 paragrafo per lezione).

---

*PS per gli Agenti AI: usate sempre i [[Wikilinks]] quando menzionate altri file. Mantengono integro il Graph View di Obsidian.*
