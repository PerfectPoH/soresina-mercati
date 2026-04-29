---
tipo: review
progetto: soresina-mercati
data: 2026-04-28
agente: Codex 5
destinatario: Claude Opus 4.7
stato: aggiornato
tags: [review, audit, codex, opus, followup, allineamento]
---

# Code Review: Codex -> Opus

> Follow-up eseguito il 2026-04-28.
> Scope: rilettura del vault operativo, lettura della codebase attuale, verifica locale con `git status`, `npm run lint` e `npm run build` sul branch `staging`.
>
> Nota per Opus: anche stavolta non ho toccato `[[backlog]]`, per lasciarti la decisione su reopen, nuovi ID, o semplice triage operativo. Qui sotto ti lascio il quadro aggiornato.

## TL;DR aggiornato

- Impressione generale confermata e migliorata: il progetto oggi e' molto piu' solido di ieri.
- I P1 del 27 aprile risultano chiusi nel repo attuale: build verde reale, waitlist promote flow presente, lint pulito, working tree pulito.
- I rischi residui non sono piu' nel core runtime, ma in bootstrap/schema/docs e in alcuni debt operativi ancora aperti.

## Stato verificato oggi (2026-04-28)

- `git status` pulito su `staging`
- `npm run lint` verde, senza warning
- `npm run build` verde
- ultimo commit visibile: `db86511 feat: BUG-038/039/041 + waitlist promote flow + chiusura audit Codex (BUG-027 reale)`

## Cosa hai chiuso davvero rispetto all'audit del 27 aprile

- BUG-027 e' chiuso davvero:
  - l'immagine Open Graph non passa piu' da `app/opengraph-image.js`
  - ora vive in `app/api/og/route.js`
  - `app/layout.js` punta a `/api/og`
  - il build locale non fallisce piu'

- BUG-041 e' chiuso davvero:
  - esiste la migration `supabase/migrations/19_auto_archive_past_events_and_waitlist_promote.sql`
  - esiste `waitlist.stall_id`
  - esistono `promote_next_waitlist(...)` e `release_expired_waitlist_promotions()`
  - esiste la route admin `app/api/admin/waitlist/[id]/promote/route.js`
  - la cancellazione admin prova davvero a promuovere il successivo dalla waitlist

- BUG-023 e i residui UI/lint sono stati ripuliti davvero:
  - `components/WaitlistWidget.jsx` importa `GOODS_TYPES` da `lib/validate`
  - `components/StallMap.jsx` non usa piu' l'attributo ARIA sbagliato che avevo segnalato
  - `components/StallMapSatellite.jsx` non lascia piu' warning di lint

- Devlog e backlog ora raccontano il lavoro del 27 aprile, quindi il vault e' rientrato in sync molto meglio di ieri.

## Segnalazioni residue per te

### [P1] `supabase/schema.sql` non e' allineato alle migration recenti

- `README.md:15-16` continua a dire che per bootstrap basta incollare `supabase/schema.sql` nello SQL Editor.
- Pero' `supabase/schema.sql:92-134` non include gli ultimi pezzi del flow waitlist:
  - `waitlist.stall_id`
  - `bookings.from_waitlist`
  - `bookings.waitlist_promoted_at`
- Gli stessi pezzi invece esistono nella migration `supabase/migrations/19_auto_archive_past_events_and_waitlist_promote.sql`.
- Impatto: una nuova installazione rischia di partire incoerente rispetto al codice attuale, proprio nel flusso waitlist che ora e' stato completato.

### [P1] README e security docs sono ancora fuori sync col codice reale

- `README.md:51-57` presenta ancora auth admin, Stripe e cancellazioni come roadmap futura, ma il repo le ha gia'.
- `docs/SECURITY.md:18-24` dice ancora che la `service_role` "non serve", mentre oggi il progetto la usa davvero tramite `lib/supabase-admin.js:4-15`.
- Impatto: chi legge solo la doc top-level puo' configurare male l'ambiente o farsi un'idea sbagliata dello stato reale del prodotto.

### [P2] Date helper UTC ancora diffuso

- Rimane molto codice che usa `new Date().toISOString().slice(0, 10)` per decidere passato/futuro/oggi, per esempio:
  - `app/page.js:17`
  - `app/admin/page.js:14`
  - `app/api/book/route.js:133`
  - `app/api/events/route.js:45`
  - `app/api/events/[id]/route.js:108`
  - `app/api/waitlist/route.js:47`
  - `app/evento/[id]/page.js:115`
  - `app/profilo/page.js:43`
  - `components/AdminBookingRow.jsx:64`
- Per un progetto che vive nel calendario italiano va ancora bene in pratica, ma resta un debt fragile vicino alla mezzanotte e ai cambi DST.

### [P2] `consent_at` esiste ma non viene ancora valorizzato nel bootstrap profilo

- `vendors.consent_at` esiste nello schema ed e' letto in `app/profilo/page.js:26`.
- In registrazione, pero', il consenso resta un checkbox UI e i dati finiscono solo in `user_metadata`:
  - `app/registrati/page.js:71-76`
  - `app/registrati/page.js:87-103`
- Quando poi viene creato il profilo vendor al primo accesso, `app/accedi/page.js:238-245` non valorizza `consent_at`.
- Impatto: non blocca il prodotto, ma lascia aperto un gap GDPR gia' noto.

### [P3] Build verde, ma Sentry resta in configurazione legacy

- Il build passa, pero' Next/Sentry emette ancora warning per:
  - `sentry.server.config.js`
  - `sentry.edge.config.js`
  - `sentry.client.config.js`
- Non e' un bug runtime oggi, ma e' un cleanup da pianificare prima che diventi un problema con tooling piu' nuovo.

## Nota operativa

- Salandra mi ha appena detto che Codex ora e' collegato anche a GitHub, Sentry e Vercel.
- Per i prossimi giri di verifica questo apre controlli esterni utili:
  - GitHub: stato PR, commit e CI
  - Vercel: deploy, build logs e preview
  - Sentry: errori runtime reali e regressioni lato produzione/staging

## Valutazione generale aggiornata

Il progetto mi sembra buono davvero. Non vedo una codebase improvvisata: vedo un MVP con una struttura sensata, tanto contesto conservato bene, e parecchie decisioni corrette sul lato prodotto e sicurezza.

Rispetto al 27 aprile, oggi la sensazione e' nettamente migliore: le chiusure importanti sono reali, il repo e' molto piu' pulito, e il lavoro di Opus sulle ultime correzioni si vede.

Il punto debole principale, adesso, non e' piu' la stabilita' del codice ma la coerenza tra:
- schema bootstrap
- migration reali
- documentazione top-level
- debt residui non ancora chiusi formalmente

## Se fossi al tuo posto oggi

1. Riallineare `supabase/schema.sql` al DB reale, oppure cambiare il README per dire chiaramente che il bootstrap passa dalle migration e non dal solo schema monolitico.
2. Riallineare `README.md` e `docs/SECURITY.md` alla realta' corrente del progetto.
3. Poi chiudere con calma i debt residui: date helper locale, `consent_at`, warning Sentry legacy.

---

Ultima nota personale: la base c'e' davvero. Non vedo piu' un progetto da "salvare"; vedo un progetto buono che ha bisogno soprattutto di rimettere perfettamente in fase codice, bootstrap e memoria operativa.

## Addendum: segnalazioni testing Salandra (2026-04-28)

> Queste NON sono fix eseguiti da Codex. Le registro qui per Opus con ipotesi di causa e possibili soluzioni, senza toccare backlog o codice applicativo.

### [Triage] Promozione waitlist su evento passato + booking che resta giallo/pending

**Sintomo riportato**
- Salandra era in lista d'attesa su un evento passato.
- Da admin ha promosso un utente per assegnargli il posto.
- Il posto/promosso risulta poi "in attesa" (giallo) invece di avere un flusso chiaro e chiuso.

**Causa probabile**
- `app/api/admin/waitlist/[id]/promote/route.js` non verifica che l'evento sia ancora futuro/attivo prima di promuovere.
- `promote_next_waitlist(...)` in `supabase/schema.sql` inserisce sempre `status = 'pending'`, senza distinguere:
  - evento passato vs futuro
  - prezzo 0 vs pagamento Stripe necessario
- Oggi il flusso "pending da waitlist" sembra monco lato utente:
  - il booking nasce pending
  - la UI profilo lo mostra come "In attesa"
  - `app/prenotato/[id]/page.js` non ha una UX specifica per pending/waitlist
  - non vedo un'azione utente esplicita per "completa checkout / conferma prenotazione"

**Possibili soluzioni (da valutare)**
1. **Contenimento minimo e robusto**
   - bloccare promozioni manuali e automatiche per eventi con `date < today` / `date < current_date`
   - disabilitare bottone "Promuovi" in admin per eventi passati
   - aggiungere la stessa guardia anche nel path automatico `admin/bookings/[id]/cancel` e, se serve, nella funzione DB
2. **Fix di prodotto coerente col design attuale**
   - se la promozione waitlist deve restare un "booking pending per 24h", serve un vero flusso di completamento lato utente:
     - CTA "Completa prenotazione"
     - eventuale checkout Stripe per i pagamenti
     - pagina `/prenotato/[id]` con copy specifico per pending, non "Prenotazione confermata!"
3. **Caso gratuito**
   - se il posto/evento promosso costa 0 euro, valutare conferma immediata (`confirmed`) invece di `pending`, replicando la logica gia' usata in `/api/book` per i booking gratuiti

### [Triage] L'utente puo' chiedere cancellazione di prenotazioni relative a eventi passati

**Sintomo riportato**
- Nel profilo utente compaiono ancora link di cancellazione anche su prenotazioni di eventi passati, che dovrebbero essere storico disattivato.

**Causa probabile**
- In `app/profilo/page.js`, il bottone e' deciso da:
  - `const canRequestCancel = cls.key === 'active' || cls.key === 'pending'`
- Se la classificazione non riesce a riconoscere "passata", il link resta attivo.
- In piu', la funzione DB `request_booking_cancellation(...)` (migration 18) controlla solo ownership + `status in ('confirmed','pending')`, ma non la data evento.

**Possibili soluzioni (da valutare)**
1. **Defense in depth completa**
   - disattivare il link in UI per eventi passati
   - rifiutare server-side / DB ogni richiesta cancellazione se `event.date < current_date`
2. **Regola piu' prudente in UI**
   - se il join evento manca o la data non e' disponibile, default a "non cancellabile" invece che lasciare il link
3. **Copy di storico**
   - per gli eventi passati usare badge/label solo storico ("Passata") e nessuna azione operativa utente

### [Triage] Dopo la promozione compare nel profilo un "Evento" senza nome, senza data, con prezzo 0 euro

**Sintomo riportato**
- Dopo la promozione waitlist, nel profilo appare una prenotazione con:
  - titolo fallback "Evento"
  - data mancante
  - prezzo `0€`
  - badge "In attesa"

**Causa probabile forte**
- La policy RLS sugli eventi e':
  - `events_authenticated_read` -> `active = true or public.is_admin()`
- Se l'evento e' passato/archiviato (`active = false`), il booking resta leggibile all'utente, ma il nested join `events (...)` in:
  - `app/profilo/page.js`
  - `app/prenotato/[id]/page.js`
  puo' tornare `null`.
- Quando `events` e' `null`:
  - il titolo cade su fallback `'Evento'`
  - la data cade su `—`
  - il prezzo cade su `b.stalls?.price ?? b.events?.price_per_stall ?? 0`
- Questo spiega molto bene il pattern visto nello screenshot.

**Possibili soluzioni (da valutare)**
1. **Fix RLS mirato**
   - ampliare la lettura di `events` anche ai vendor che hanno una booking collegata a quell'evento
   - stessa idea, se serve, anche per utenti ancora in waitlist
2. **Fix query lato app**
   - in `/profilo` e `/prenotato/[id]`, fare la query con client admin/server-side dopo aver verificato la sessione utente, invece di dipendere dalla RLS della relazione `events`
3. **Fix strutturale migliore per storico**
   - salvare snapshot di `event_title`, `event_date`, `event_price` dentro `bookings` al momento della creazione/promozione
   - cosi lo storico non dipende da RLS, cambi nome evento, archiviazione o cancellazione relazione
4. **Palliativo UI**
   - se `events` e' null, mostrare "Evento archiviato" e "prezzo non disponibile" invece di `Evento` + `0€`

### [Triage] Pending da waitlist sembra una meta' feature anche lato conferma utente

**Osservazione aggiuntiva**
- `app/prenotato/[id]/page.js` distingue solo:
  - cancellata
  - tutto il resto = "Prenotazione confermata!"
- Quindi un booking `pending` promosso da waitlist rischia di avere:
  - badge "In attesa" nel profilo
  - pagina di conferma che parla come se fosse confermato
  - nessuna CTA esplicita per finalizzare il flusso

**Possibili soluzioni (da valutare)**
1. introdurre stato UX dedicato per `pending`
2. se pending nasce da waitlist pagante, offrire "Vai al pagamento / completa prenotazione"
3. se pending nasce da waitlist gratuita, confermare subito e saltare il pending

## Lettura sintetica per Opus

Se dovessi indovinare una root cause unificante, direi questa:
- la waitlist promotion e' stata chiusa bene lato DB/UI admin
- ma il ramo "cosa vede e cosa puo' fare il vendor promosso" non e' ancora finito
- e sui mercati passati/archiviati questo si incrocia con RLS sugli `events`, facendo saltare titolo/data/prezzo nello storico utente

Se fossi Opus, partirei con quest'ordine di ragionamento:
1. decidere la semantica corretta del pending da waitlist
2. bloccare subito ogni promozione/cancellazione operativa su eventi passati
3. poi chiudere il problema storico/RLS sugli eventi archiviati
