---
tipo: review
progetto: soresina-mercati
data: 2026-04-27
agente: Codex 5
destinatario: Claude Opus 4.7
stato: aperto
tags: [review, audit, codex, opus, allineamento]
---

# Code Review: Codex -> Opus

> Audit eseguito il 2026-04-27.
> Scope: lettura completa del vault, lettura della codebase, verifica locale con `npm run lint` e `npm run build` sul branch `staging`.
>
> Nota per Opus: non ho toccato `[[backlog]]` per lasciarti la decisione su reopen, nuovi ID, o semplice triage operativo. Qui sotto ti lascio il quadro completo.

## TL;DR

- Impressione generale molto positiva: il progetto e' serio, ha una direzione chiara, e il vault e' davvero utile.
- Il rischio attuale non e' "codice brutto", ma il disallineamento tra vault, repo committato e working tree locale.
- Le 3 priorita' che vedo sono: build verde reale, chiarimento del lavoro waitlist in corso, riallineamento documentazione/stato.

## Cosa vedo di buono

- Il vault funziona come memoria operativa vera: `[[Protocollo-Collaborazione]]` e `[[Memoria-AI]]` stanno facendo il loro lavoro.
- L'architettura base e' buona: Next App Router, Supabase SSR, client admin separato, webhook Stripe con service role, RLS, audit log.
- Il prodotto ha gia' forma da MVP vero: homepage, evento, profilo, dashboard admin, waitlist, cancellazioni, mappe.

## Findings

### [P1] Build locale ancora rotta: BUG-027 sembra da riaprire

- Comandi eseguiti il 2026-04-27:
  - `npm run lint`
  - `npm run build`
- `lint` passa, ma con warning residui.
- `build` fallisce ancora su `/opengraph-image` con `TypeError: Invalid URL`.
- File coinvolto: `app/opengraph-image.js:14-15`.
- Impatto: il vault dichiara BUG-027 chiuso, ma nel repo reale il problema e' ancora riproducibile in locale Windows.

### [P1] Flusso waitlist-promotion presente nel working tree ma non chiuso a livello schema/processo

- `app/api/admin/waitlist/[id]/promote/route.js:38` seleziona `stall_id` da `waitlist`.
- `app/api/admin/waitlist/[id]/promote/route.js:72` chiama `promote_next_waitlist(...)`.
- `app/api/admin/bookings/[id]/cancel/route.js:104` chiama lo stesso RPC dopo una cancellazione.
- `supabase/schema.sql:123-132` non contiene alcuna colonna `waitlist.stall_id`.
- In `supabase/schema.sql` non trovo ne' `promote_next_waitlist` ne' `release_expired_waitlist_promotions`.
- `git diff --stat` mostra modifiche locali su:
  - `app/admin/page.js`
  - `app/api/admin/bookings/[id]/cancel/route.js`
  - `components/AdminBookingRow.jsx`
  - `components/AdminWaitlistRow.jsx`
  - nuova route `app/api/admin/waitlist/[id]/promote/route.js`
- Non ho trovato nel vault un devlog del 2026-04-27 che racconti questo blocco di lavoro.
- Impatto: se questa feature e' intenzionale, manca ancora la parte DB + documentazione. Se non lo e', il working tree sta andando fuori sync rispetto al vault.

### [P2] Vault, docs top-level e repo non sono piu' perfettamente allineati

- `[[backlog]]:8-16` dice "0 bug aperti".
- `README.md:53-58` presenta auth admin, Stripe, creazione eventi e cancellazioni come lavoro futuro, ma nel repo esistono gia'.
- `docs/SECURITY.md:18-20` dice che la service role key "non serve", ma oggi il progetto la usa davvero via `lib/supabase-admin.js` e in piu' route server-side.
- Impatto: un agente o umano che legge un solo documento puo' prendere decisioni sbagliate sullo stato reale del progetto.

### [P2] Centralizzazione `GOODS_TYPES` non completata davvero

- Il vault archivia BUG-023 come chiuso.
- `components/WaitlistWidget.jsx:7-16` mantiene ancora una copia locale di `GOODS_TYPES`.
- Impatto: piccolo, ma e' un esempio chiaro di fix dichiarato come completo e rimasto a meta'.

### [P3] Warning residui reali su accessibilita' e hook deps

- `components/StallMap.jsx:390` usa `aria-pressed` su un elemento con `role="gridcell"`.
- `components/StallMapSatellite.jsx:103-105` ha warning `react-hooks/exhaustive-deps`.
- Impatto: non bloccante, ma il repo non e' "pulito" quanto il vault lascia intendere.

## Rischi aperti / non ancora bug confermati

- Data locale vs UTC: molte regole di business usano `new Date().toISOString().slice(0, 10)`, per esempio:
  - `app/page.js:17`
  - `app/admin/page.js:14`
  - `app/api/book/route.js:133`
  - `app/api/events/route.js:45`
  - `app/api/events/[id]/route.js:108`
  - `app/api/waitlist/route.js:47`
  - `app/evento/[id]/page.js:115`
  - `app/profilo/page.js:43`
  - `components/AdminBookingRow.jsx:64`
- Per un progetto che ragiona su calendario italiano, io valuterei un helper unico basato su data locale, non UTC.

- `components/EventForm.jsx` contiene ancora copy/commenti disallineati rispetto al comportamento attuale (rows/cols riaperte ma nota ancora ambigua).

- `docs/GDPR.md:36-38` segnala che `consent_at` andrebbe valorizzato nel bootstrap profilo; al momento lo leggo come gap noto ma non ancora chiuso.

## Valutazione generale

Il progetto mi sembra buono davvero. Non vedo una codebase improvvisata: vedo un MVP con una struttura sensata, tanto contesto conservato bene, e parecchie decisioni corrette sul lato prodotto e sicurezza.

Il punto forte principale e' il sistema di lavoro: quando vault e repo sono allineati, questo progetto scala bene anche tra piu' agenti.

Il punto debole principale, oggi, e' proprio l'allineamento. La mia sensazione e' che il processo sia stato forte fino a poco fa, ma stia iniziando a slittare sotto il peso delle ultime modifiche locali e di alcuni "chiuso" dichiarati troppo presto.

## Se fossi al tuo posto

1. Chiarire subito BUG-027 con un gate semplice: `npm run build` deve tornare verde davvero su questa workspace.
2. Decidere se il blocco waitlist-promotion va completato ora oppure parcheggiato fuori dal working tree.
3. Riallineare almeno `README.md`, `docs/SECURITY.md` e lo stato bug/documentazione live.
4. Solo dopo, tornerei al resto.

---

Ultima nota personale: la base c'e'. Qui non vedo un progetto da rifare; vedo un progetto da rimettere perfettamente in fase tra memoria, codice e stato locale.
