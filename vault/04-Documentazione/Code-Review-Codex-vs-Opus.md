---
tipo: review
progetto: soresina-mercati
data: 2026-05-01
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

## Addendum: audit completo 2026-05-01

> Audit eseguito il 2026-05-01.
> Scope: rilettura vault, check repo locale, `npm run lint`, `npm run build`, lettura punti sensibili del codice, controllo deploy Vercel e tentativo di audit GitHub via connettore.
>
> Nota per Opus: anche oggi non ho toccato `[[backlog]]`. Ti lascio qui il quadro operativo aggiornato.

## TL;DR 2026-05-01

- Il progetto continua a sembrarmi buono e molto piu' maturo rispetto a una settimana fa.
- Localmente il repo e' sano: tree pulito, lint verde, build verde.
- Il rischio principale oggi non e' il codice locale, ma la differenza fra staging e production, piu' alcune discrepanze residue tra documentazione e stato reale.

## Stato verificato oggi

- branch locale corrente: `staging`
- `git status` pulito
- `npm run lint` verde
- `npm run build` verde
- commit locale piu' recente: `a8739f9 fix: BUG-042/043/044 + audit Codex 28apr (schema.sql allineato, README riscritto)`

## Verifiche esterne

### Vercel

- Il progetto Vercel `soresina-mercati` risponde correttamente.
- L'ultima deploy visibile e' `READY` e punta al commit `a8739f9` su branch `staging`.
- Le deploy di `production` che vedo sono invece molto piu' indietro:
  - ultimo commit prod visibile: `5989389`
- Lettura pratica: i fix recenti mi sembrano credibili su staging, ma non sono ancora equivalenti in produzione.

### GitHub / Graphify

- Il remote git locale punta a `PerfectPoH/soresina-mercati`.
- Il connettore GitHub non mi ha permesso un audit completo: la ricerca branch risponde con `token_revoked`.
- Quindi oggi la parte GitHub l'ho verificata indirettamente via:
  - `git` locale
  - metadata Vercel dei deploy/commit
- Se Salandra vuole un audit GitHub pieno via connettore, il token va ricollegato.
- Ho letto anche il report Graphify del 2026-04-30:
  - 256 nodi
  - 281 edge
  - 12 community
  - god nodes principali: `createSupabaseServerClient()`, `safeLogError()`, `enforceRateLimit()`
- Il graph conferma una lettura che condivido: il progetto e' molto centrato su pochi bridge server-side forti, soprattutto Supabase SSR + logging + rate limit.
- Nota operativa: `CLAUDE.md` parla di `graphify-out/GRAPH_REPORT.md`, ma gli artefatti che vedo oggi sono in `vault/GRAPH_REPORT.md`, `vault/graph.json`, `vault/cache/` e `vault/.graphify_root`. C'e' una piccola divergenza da riallineare nella doc/strumentazione.

## Cose che mi convincono

- I fix BUG-042/043/044 ci sono davvero nel codice:
  - `app/api/admin/waitlist/[id]/promote/route.js` blocca promote su eventi passati/archiviati
  - le migration 20 e 21 esistono
  - `app/profilo/page.js` tratta meglio eventi passati/rimossi
- La catena commit -> deploy staging e' coerente, che e' un ottimo segnale.
- Il progetto oggi non mi da' piu' l'idea di "MVP fragile": mi da' l'idea di uno staging serio.

## Findings residui (oggi)

### [P1] `schema.sql` NON e' davvero allineato a tutto cio' che il backlog dichiara

- Il backlog dice che `schema.sql` e' allineato alle migrations 13 -> 21.
- Pero' nel file consolidato vedo ancora una versione vecchia di `promote_next_waitlist(...)`:
  - `supabase/schema.sql:446` definisce la funzione senza il pre-check dell'evento valido
  - la migration 20 invece lo introduce
- Inoltre in `supabase/schema.sql` non trovo proprio `request_booking_cancellation(...)`
  - la funzione esiste in `supabase/migrations/18_booking_cancellation_request.sql`
  - viene aggiornata in `supabase/migrations/21_request_cancellation_blocks_past_events.sql`
- Impatto:
  - il bootstrap "schema consolidato" non e' il vero stato finale
  - chi ricrea un nuovo project rischia di partire con DB incoerente se segue male i passaggi

### [P1] README e backlog non sono perfettamente sincronizzati sul bootstrap DB

- `README.md` e' migliorato molto, ma in bootstrap dice ancora:
  - `supabase/migrations/` numerati `13 -> 19`
- Oggi invece il repo contiene anche:
  - `20_promote_waitlist_only_future_events.sql`
  - `21_request_cancellation_blocks_past_events.sql`
- Il backlog, nel frattempo, racconta che lo schema e' gia' allineato fino a 21.
- Impatto: il materiale operativo si contraddice proprio sul punto piu' delicato, cioe' "come ricreo il DB giusto".

### [P1] `docs/SECURITY.md` e' ancora falsamente rassicurante sulla service role

- Il documento dice ancora che la `service_role` sostanzialmente non serve in questa app.
- Ma il codice reale usa `SUPABASE_SERVICE_ROLE_KEY` in `lib/supabase-admin.js`.
- Oggi webhook e altri path server-side dipendono da quel client.
- Impatto: rischio di setup errato e diagnosi sbagliate se qualcuno legge solo la doc.

### [P2] UX `pending` non completamente chiusa lato utente

- `app/profilo/page.js` oggi distingue meglio:
  - `In attesa (24h)` per pending da waitlist
  - `Evento rimosso` per join evento mancante
- Pero' `app/prenotato/[id]/page.js` continua a ragionare solo su:
  - `cancelled`
  - tutto il resto = "Prenotazione confermata!"
- Quindi un booking `pending` puo' ancora avere una pagina dettaglio che parla come se fosse confermato.
- Impatto: non e' un bug bloccante come i precedenti, ma e' ancora una UX contraddittoria su uno stato delicato.

### [P2] Manca il devlog della sessione 28 aprile dove il backlog dice che sono stati chiusi BUG-042/043/044

- In `vault/02-Devlog/` non trovo un file del 2026-04-28 coerente con quelle chiusure.
- Il lavoro e' rintracciabile via commit, backlog e deploy, ma il diario operativo e' incompleto.
- Impatto: non rompe il prodotto, ma indebolisce la memoria storica proprio quando il vault sta funzionando bene.

### [P2] Debt gia' noto ma ancora reale

- `new Date().toISOString().slice(0, 10)` resta sparso in piu' punti critici
- `consent_at` esiste ma non viene ancora valorizzato nel bootstrap profilo
- non ci sono test automatici:
  - 0 E2E
  - 0 unit test

### [P3] Sentry resta in configurazione legacy

- Il build continua a passare ma emette warning per:
  - `sentry.server.config.js`
  - `sentry.edge.config.js`
  - `sentry.client.config.js`
- Non e' urgente, ma non e' chiuso davvero.

## Giudizio aggiornato

Se guardo solo lo stato locale e staging, il progetto oggi mi piace molto:
- e' coerente
- e' costruito con criterio
- ha una base molto piu' seria della media dei piccoli gestionali custom

Se allargo lo sguardo a documentazione, bootstrap e produzione, la mia opinione resta positiva ma piu' prudente:
- staging mi sembra credibile
- production e' ancora indietro
- il vault racconta quasi tutto, ma in 2-3 punti racconta uno stato un po' piu' "chiuso" di quanto il repo dimostri davvero

## Se fossi Opus, oggi

1. sistemerei per davvero il pacchetto `schema.sql` / `README.md` / `docs/SECURITY.md`
2. chiuderei l'ultimo buco UX sullo stato `pending` lato `/prenotato/[id]`
3. annoterei nel vault anche il pezzo operativo mancante del 28 aprile
4. poi ragionerei su quando promuovere davvero `staging -> main`

---

Nota finale per me stesso/Codex:
- dal 2026-05-01, dopo ogni audit completo richiesto da Salandra, devo sempre lasciare il memo qui nel vault per Opus, anche se il verdetto e' "tutto bene".

## Contesto operativo chiarito da Salandra (2026-05-01)

> Nota aggiuntiva importante ricevuta DOPO l'audit:

- in questo momento Salandra sta lavorando **solo su staging**
- la **production** ricevera' le modifiche di `staging` solo quando il progetto sara' considerato completo al 100%
- il flusso `pending` e i dettagli UX collegati sono **work in progress intenzionale**: Opus ci sta ancora lavorando, non vanno letti come feature dichiarata "finita"
- `graphify` e' stato introdotto apposta per facilitare l'accesso al codice e ridurre il consumo di token
- il vault e' attualmente in fase di riordino su richiesta esplicita di Salandra, quindi spostamenti/archiviazioni recenti non vanno automaticamente interpretati come disordine o perdita di controllo

### Impatto sulla lettura dell'audit

Con questo contesto, alcune osservazioni del memo sopra vanno lette cosi':

1. **Staging vs production**
   - il disallineamento non e' una anomalia: e' il workflow previsto
   - quindi per ora va letto come "branching model intenzionale", non come problema operativo

2. **UX `pending`**
   - resta una zona non ancora chiusa
   - ma oggi va classificata come **lavoro in corso**, non come regressione inattesa

3. **Graphify / vault churn**
   - la presenza di nuovi artefatti `graphify` e la riorganizzazione del vault sono coerenti con la direzione dichiarata da Salandra
   - quindi eventuali differenze nel working tree vanno interpretate prima come reorg/tooling, poi come potenziale anomalia

### Giudizio ricalibrato

Alla luce di questo contesto, il mio giudizio diventa ancora piu' semplice:

- **staging**: progetto sano, promettente, con alcune parti ancora volutamente in lavorazione
- **production**: non la valuto come "indietro", la valuto come **ferma intenzionalmente** fino a completamento
- **vault/graphify**: evoluzione attiva dell'infrastruttura di memoria e lettura del codice, non rumore casuale

## Contesto prodotto / business chiarito da Salandra (2026-05-01)

> Nota strategica per Opus: questa non e' una richiesta di fix immediato, ma il contesto con cui leggere le prossime scelte di prodotto e UX.

- Salandra percepisce che oggi il sito, soprattutto lato grafica, "urla AI / vibecoding" e vuole in futuro un revamp che lo faccia sembrare piu' professionale e meno generato.
- Per ora il lavoro resta focalizzato su:
  1. debugging e chiusura mini-problemi
  2. rifinitura flussi aperti
  3. solo dopo: revamp grafico piu' serio
  4. miglioramento gestione profilo mercanti
- Salandra ha gia' scritto al Comune di Soresina per capire come vengono gestiti oggi i mercati, ma non ha ancora presentato formalmente il progetto.
- Visione futura possibile: evolvere da sito singolo per un comune a piattaforma multi-tenant stile "Shopify dei mercati", con area admin separata per ogni Comune / Pro Loco.
- Dubbi gia' emersi correttamente:
  - l'appartenenza fissa del mercante a un solo comune potrebbe non riflettere la realta' dei mercati itineranti
  - questa parte multi-tenant va trattata come futura, solo se il progetto prende davvero piede
- Salandra considera questo il suo primo progetto business, quindi il compromesso corretto oggi e':
  - non under-engineer sulla sicurezza
  - non over-engineer sulla piattaforma futura

### Lettura Codex per Opus

- Oggi il valore principale non e' "piu' feature", ma far sembrare il prodotto:
  - affidabile
  - professionale
  - sobrio
  - amministrativamente utile
- Per una piccola Pro Loco, il rischio non e' che manchi una mega-feature enterprise:
  - il rischio vero e' che il prodotto sembri "una demo fatta dall'AI" invece che uno strumento serio
- Quindi, quando arrivera' il momento del revamp UI, suggerisco di privilegiare:
  - chiarezza
  - tono istituzionale leggero
  - meno effetti "template / startup"
  - piu' densita' informativa utile
  - piu' fiducia percepita
- Sulla visione futura multi-tenant:
  - ha senso come direzione potenziale
  - NON ha senso oggi piegare tutta l'architettura corrente per inseguirla troppo presto
  - prima va validato che almeno 1 comune / Pro Loco voglia davvero usare questo modello

## Addendum: impressione sicurezza dal codice (2026-05-01)

> Check mirato richiesto da Salandra guardando soprattutto auth, admin, webhook, log, validazione e policy dati. Nessun fix eseguito: solo valutazione.

### TL;DR sicurezza

- Il progetto mi sembra **piu' sicuro della media** per un primo progetto business.
- Non vedo scorciatoie folli tipo segreti nel client, route admin aperte o assenza totale di permessi lato database.
- I rischi piu' concreti che vedo oggi non sono "mega-hacker movie style", ma:
  - bug logici nei flussi
  - regressioni auth/RLS
  - abuso non bloccato bene dal rate limit
  - qualche spigolo di hardening web ancora migliorabile

### Punti forti reali

1. **Base permessi buona lato Supabase**
   - `supabase/schema.sql:573-636` abilita RLS sulle tabelle sensibili e definisce policy sensate su `vendors`, `events`, `bookings`, `waitlist`, `audit_log`, `stripe_events_seen`.
   - In particolare:
     - `bookings` selezionabili dal proprietario o admin, insert solo per `user_id = auth.uid()` o admin
     - `waitlist` leggibile/inseribile/cancellabile dal proprietario o admin
     - `audit_log` leggibile solo admin

2. **Le route admin non si fidano solo del middleware**
   - `middleware.js:56-66` protegge `/admin/*`.
   - Ma in piu' le route server-side ricontrollano davvero l'utente:
     - `app/api/admin/waitlist/[id]/promote/route.js:24-30`
     - `app/api/admin/bookings/[id]/cancel/route.js:39-47` e `158-166`
   - Questo e' un segnale buono: meno dipendenza da un solo strato di difesa.

3. **Uso corretto della service role**
   - `lib/supabase-admin.js:5-11` centralizza la `SUPABASE_SERVICE_ROLE_KEY` lato server-only.
   - La doc ora e' coerente: `docs/SECURITY.md:18-40` spiega bene dove viene usata e dove non deve mai finire.

4. **Webhook Stripe gestita nel modo giusto**
   - `app/api/webhooks/stripe/route.js:59` usa `stripe.webhooks.constructEvent(...)`.
   - Questo e' il minimo serio che voglio vedere quando c'e' Stripe in mezzo.

5. **Logging prudente**
   - `lib/log.js:16-23` filtra email/telefono.
   - `lib/log.js:37` esplicita che `details / hint / stack` non vengono inclusi per evitare PII o leak inutili.
   - Per un gestionale con dati reali, questa e' una scelta molto sana.

6. **Input validation presente**
   - `lib/validate.js` copre stringhe, email, telefono, UUID, enum, numeri, date, URL.
   - `app/api/book/route.js:51` e `82` usa anche rate limit su endpoint sensibile.

### Punti deboli / attenzioni vere

1. **Probabile open redirect nel callback auth**
   - `app/auth/callback/route.js:27` legge `next` dalla query string.
   - `app/auth/callback/route.js:59` fa `NextResponse.redirect(new URL(nextPath, request.url))`.
   - Se `next` puo' essere passato come URL assoluto esterno, questo e' il classico punto da hardenare.
   - Non e' la fine del mondo, ma e' il finding piu' concreto che vedo guardando il codice.

2. **CSP presente, ma ancora permissiva**
   - `next.config.js:15-16` include:
     - `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
     - `style-src 'self' 'unsafe-inline'`
   - Bene avere una CSP; meno bene che sia ancora abbastanza larga.
   - Oggi la leggerei piu' come "igiene decente" che come barriera forte anti-XSS.

3. **Rate limiting utile ma non forte**
   - `lib/rate-limit.js:1` dice chiaramente che e' in-memory.
   - `lib/rate-limit.js:19` usa `Map`.
   - `lib/rate-limit.js:63` si appoggia a `x-forwarded-for`.
   - Per staging / MVP va bene come primo strato, ma contro abuso serio o distribuito non basta.

4. **Il rischio piu' grosso resta la logica di business**
   - Guardando il progetto, il vero pericolo non mi sembra il "bucano il server".
   - Mi sembrano piu' pericolosi:
     - stati incoerenti booking/waitlist/pending
     - path admin delicati
     - regressioni nei passaggi `pending -> confirmed/cancelled`
   - Quindi la sicurezza qui passa anche tanto da test e coerenza dei flussi.

5. **Mancano ancora test automatici sui percorsi piu' delicati**
   - Non e' un finding "security" puro, ma in pratica pesa:
   - auth, admin, webhook, booking e cancellazioni senza test sono piu' facili da rompere in silenzio.

### Valutazione onesta per Opus

- Il progetto **non mi sembra naive sulla sicurezza**.
- Mi sembra invece un progetto che ha gia' preso alcune decisioni giuste presto:
  - RLS
  - separazione service-role
  - protezione admin
  - log puliti
  - header di sicurezza
- Se devo essere brutale:
  - **non lo definirei insicuro**
  - **non lo definirei ancora hardenato a fondo**
  - lo definirei **seriamente impostato, con alcuni spigoli ancora da stringere**

### Priorita' che suggerirei a Opus sul lato sicurezza

1. Verificare e chiudere il possibile open redirect del callback auth.
2. Continuare a chiudere i flussi business delicati (`pending`, waitlist, cancellazioni) come parte anche della sicurezza logica.
3. Valutare, piu' avanti, un rate limit condiviso/persistente per gli endpoint piu' esposti.
4. Aggiungere almeno test automatici minimi sui percorsi auth/admin/payment.

## Addendum: top 5 rischi security reali (2026-05-01)

> Classifica richiesta da Salandra. Ordinata per mix di gravita' + probabilita' pratica nel contesto attuale del progetto.

### 1. Sicurezza logica dei flussi `booking / pending / waitlist / cancellation`

Questo e' il rischio piu' concreto del progetto.

Non perche' il codice sia "aperto", ma perche' qui vivono gli stati delicati:
- `pending -> confirmed`
- `pending -> cancelled`
- promozioni waitlist
- cancellazioni su eventi passati
- differenza tra admin action e vendor action

Se qui scappa una regressione, il danno reale non e' "hacker ha preso il server", ma:
- prenotazioni incoerenti
- posti bloccati male
- utenti che vedono / toccano stati non previsti
- cancellazioni o conferme fuori policy

Per il business, questo e' il rischio numero uno.

### 2. Probabile open redirect nel callback auth

Riferimenti:
- `app/auth/callback/route.js:27`
- `app/auth/callback/route.js:59`

Il parametro `next` viene letto dalla query string e poi usato nel redirect finale.
Se non viene ristretto a path interni sicuri, questo e' un classico punto di abuso:
- phishing post-login
- redirect verso URL esterni controllati da terzi

Non e' un disastro totale, ma e' il finding tecnico piu' netto che oggi vedo nel codice.

### 3. Rate limiting troppo debole per abuso serio

Riferimenti:
- `lib/rate-limit.js:1`
- `lib/rate-limit.js:19`
- `lib/rate-limit.js:63`

Oggi il rate limit e':
- in-memory
- per processo
- basato su IP/header forwardati

Per MVP e staging va bene come primo strato.
Per abuso vero, botting o traffico distribuito, no.

Questo pesa soprattutto sugli endpoint esposti al pubblico o sensibili:
- booking
- auth-related flows
- eventuali form / waitlist / webhook-adjacent paths

### 4. Hardening browser-side ancora non stretto del tutto

Riferimenti:
- `next.config.js:15-16`

La CSP c'e', che e' gia' positivo.
Pero' con:
- `script-src 'unsafe-inline' 'unsafe-eval'`
- `style-src 'unsafe-inline'`

oggi non la considererei una barriera forte anti-XSS, ma piu' una baseline decente.

Questo non vuol dire "sito vulnerabile per forza", ma vuol dire:
- se domani entra un rendering sbagliato
- o un punto di output non sanificato

la rete di protezione browser-side non e' ancora stretta come potrebbe essere.

### 5. Assenza di test automatici sui percorsi piu' sensibili

Questo e' l'ultimo in classifica solo perche' non e' una vulnerabilita' diretta.
Pero' in pratica e' un amplificatore di rischio:
- auth
- admin
- Stripe/webhook
- booking status transitions
- cancellation policy

senza test sono piu' facili da rompere in silenzio.

### Lettura franca per Opus

Se devo dirla in modo secco:
- il progetto non mi preoccupa per "buchi grossolani"
- mi preoccupa molto di piu' per **regressioni di logica applicativa**

Quindi la priorita' security piu' intelligente, oggi, non e':
- paranoia astratta
- over-engineering da enterprise

ma:
1. chiudere bene i flussi sensibili
2. hardenare il callback auth
3. rinforzare rate limit e test sui percorsi critici

## Addendum: audit Vault + Graphify (2026-05-03)

> Audit richiesto da Salandra per capire se vault e graphify sono settati bene come memoria lunga e mappa del codice per gli agenti.
> Nessun file di codice modificato. Ho solo verificato configurazione, disponibilita' tool, stato git e salute minima del progetto.

### TL;DR

L'idea e' giusta: il vault e' utile e il graph generato contiene davvero una mappa del codice.
Pero' il setup oggi e' solo parzialmente operativo: gli agenti possono leggere i file gia' generati, ma non possono contare sul comando `graphify`, sugli hook automatici o su un bootstrap uniforme tra Claude, Codex e Cursor.

### Cosa funziona

- `graphify-out/GRAPH_REPORT.md` esiste ed e' coerente con `graphify-out/graph.json`.
- Il grafo contiene 256 nodi e 281 relazioni, quindi e' abbastanza ricco da essere utile su domande architetturali.
- Gli artefatti duplicati in `vault/` e `graphify-out/` hanno lo stesso hash.
- Il vault contiene buone regole operative in `00-Progetto/Protocollo-Collaborazione.md` e `00-Progetto/Memoria-AI.md`.
- `npm run lint` passa senza warning o errori.

### Problemi trovati

1. **`graphify` non e' disponibile nel PATH**
   - `graphify --help` e `graphify query ...` falliscono con comando non riconosciuto.
   - `npm list --depth=0` e `npm list -g --depth=0` non mostrano pacchetti graphify.
   - Impatto: niente `graphify query`, `graphify path`, `graphify explain`, `graphify update .`.

2. **L'hook Claude e' fragile/broken su questa macchina**
   - `.claude/settings.json` usa `python3`, ma qui `python3 --version` e `python --version` falliscono.
   - L'hook e' `PreToolUse` su `Bash` e non copre Codex/PowerShell/Cursor.
   - Inoltre non aggiorna il grafo: al massimo aggiunge contesto prima di grep/rg/find se il graph esiste.

3. **La documentazione promette piu' automazione di quella reale**
   - `CLAUDE.md` dice di usare `graphify query/path/explain`, ma il comando non esiste.
   - `Memoria-AI.md` dice che il PreToolUse hook "lo fa di default", ma l'hook non esegue `graphify update .`.
   - `.gitignore` dice che Claude ricostruisce automaticamente il graph tramite hook, ma non e' vero nello stato attuale.

4. **Root bootstrap incompleto**
   - `CLAUDE.md` parla solo di Graphify.
   - Non dice agli agenti di leggere subito `vault/INDEX.md`, `Protocollo-Collaborazione.md`, `Memoria-AI.md`, ultimo devlog e backlog.
   - Manca un `AGENTS.md` per Codex.
   - Manca una regola Cursor reale: `.cursor/` contiene solo un log.

5. **Artefatti generati nel vault non gestiti bene**
   - `graphify-out/` e `.claude/` sono ignorati.
   - Pero' `vault/graph.json`, `vault/graph.html`, `vault/GRAPH_REPORT.md`, `vault/cache/` e `vault/.graphify_root` sono untracked e non ignorati.
   - Rischio: committare per sbaglio cache/HTML generati o, al contrario, perdere il report che gli agenti dovrebbero leggere.

6. **`.graphify_root` punta a un path vecchio/non Windows**
   - Contenuto: `/sessions/fervent-sharp-babbage/mnt/soresina-mercati`.
   - Impatto: se Graphify usa quel riferimento per update/query, e' sospetto rispetto al workspace reale Windows.

7. **Community pages incomplete**
   - `GRAPH_REPORT.md` linka 12 community hub.
   - Nel vault esistono solo `_COMMUNITY_Community 2.md` e `_COMMUNITY_Community 10.md`, entrambi vuoti.
   - Il check wikilink trova 10 community link non risolti.

8. **Indice vault leggermente stantio**
   - `INDEX.md` e `Wikilinks.md` trattano `Stato-Progetto-2026-04-26` come documento vivo, ma ora e' in `_archive/`.
   - Alcuni devlog spostati in `_archive/` sono ancora presentati come se fossero nella cartella principale.
   - Non e' grave per Obsidian, ma confonde agenti e umani.

9. **Working tree vault ancora non consolidato**
   - Git vede molte delete + nuovi file in `_archive/`.
   - Sembra una riorganizzazione intenzionale, ma non e' ancora consolidata in commit/stage.

### Fix consigliato

1. Decidere una policy semplice:
   - commitare solo docs leggere del vault;
   - ignorare cache, HTML e JSON grossi;
   - tenere un report leggibile e aggiornabile in un posto solo.
2. Installare/configurare davvero `graphify`, poi aggiungere script tipo:
   - `graph:update`
   - `graph:report`
   - `graph:query`
3. Riscrivere `CLAUDE.md` come bootstrap unico:
   - leggere vault;
   - leggere Graph report;
   - usare graphify solo se disponibile;
   - aggiornare graph dopo edit di codice.
4. Aggiungere `AGENTS.md` per Codex e, se serve, regole Cursor.
5. Correggere o rimuovere la promessa degli hook automatici finche' non esiste un hook `PostToolUse`/manuale affidabile.
6. Ripulire i file vuoti e riallineare `INDEX.md`/`Wikilinks.md`.

### Giudizio

Vault: buono come contenuto, da rendere piu' "entrypoint-friendly".
Graphify: utile come snapshot, non ancora affidabile come workflow operativo.
La direzione e' corretta, ma oggi un agente nuovo deve ancora essere guidato a mano.

### Follow-up eseguito nella stessa sessione

Salandra ha autorizzato Codex a sistemare direttamente questa infrastruttura. Interventi applicati:

- creato `AGENTS.md` per bootstrap Codex/agent generici;
- riscritto `CLAUDE.md` come entrypoint vault + Graphify;
- aggiunta `.cursor/rules/graphify.mdc` always-on;
- aggiunti script npm `graph:*` e wrapper `scripts/graphify.mjs`;
- aggiunto check `scripts/check-agent-memory.mjs`;
- aggiunto `.graphifyignore`;
- puliti i duplicati generati dal root del vault;
- aggiornati `Memoria-AI.md`, `INDEX.md`, `Wikilinks.md`;
- creato devlog `2026-05-03-codex-vault-graphify-setup.md`;
- eseguiti `npm run graph:update`, `npm run graph:check`, `npm run lint`.

Esito:
- Graphify ora funziona via `npm run graph:*`.
- Il check agent-memory passa.
- Il lint passa.

## Addendum: audit rework Opus BUG-047 / banner / profilo (2026-05-04)

> Audit richiesto da Salandra dopo il rework esteso di Opus. Focus: coerenza dati, migrazioni, flussi Stripe/waitlist, regressioni architetturali e salute minima del progetto.

### Verifiche eseguite

- `npm run lint` -> OK.
- `npm run build` -> OK. Restano solo warning Sentry legacy gia' noti.
- `npm run graph:check` -> KO non per codice prodotto: `graphify-out/.graphify_root` e' tornato al path stale `/sessions/fervent-sharp-babbage/mnt/soresina-mercati`.
- Lettura mirata di migration 23, schema consolidato, endpoint booking, webhook Stripe, dashboard admin, profilo, pagina prenotato e banner waitlist.

### Finding principali

1. **P1 - `schema.sql` e' driftato dalla migration 23**
   - Migration 23 aggiorna `promote_next_waitlist` con guard evento attivo/futuro e `paid_price`.
   - `supabase/schema.sql` contiene ancora la funzione vecchia: insert senza `paid_price`, nessun `v_price`, nessun controllo `v_event_ok`.
   - Impatto: bootstrap/reset DB da schema produce un comportamento diverso dalla sequenza migration.
   - Tracciato come BUG-048.

2. **P1 - `complete` riscrive lo snapshot prezzo invece di rispettarlo**
   - `app/api/bookings/[id]/complete/route.js` non seleziona `paid_price`.
   - Calcola `amountToPay` da prezzo live `stall/event` e aggiorna sempre `paid_price` prima di Stripe.
   - Questo contraddice la migration 23, che definisce `paid_price` come snapshot immutabile e lo setta gia' sui booking da waitlist.
   - Tracciato come BUG-049.

3. **P2 - Banner waitlist nel root layout rende sensibili tutte le pagine al contesto auth/DB**
   - `WaitlistPromotionBanner` gira da `app/layout.js`, quindi la root layout legge sessione e potenzialmente DB su ogni pagina.
   - La build ora mostra le route come dinamiche; per pagine pubbliche tipo privacy/termini e' un costo architetturale evitabile.
   - Consiglio: spostare la notifica in un client component/API leggera agganciata a Header o alle aree autenticate, oppure condizionarla meglio.

4. **P3 - Commento banner promette filtro eventi passati ma il codice filtra solo presenza data**
   - `WaitlistPromotionBanner.jsx` dice di filtrare eventi rimossi o gia' passati.
   - Il filtro reale e' solo `b.events && b.events.date`.
   - Non blocca la build, ma puo' mostrare un banner non completabile se resta un pending vecchio.

### Giudizio

Il rework e' tecnicamente ampio ma non e' "rotto": lint e build sono verdi, il modello dati nuovo e' nella direzione giusta, e le UI principali compilano.

### Follow-up eseguito da Codex nello stesso audit

- BUG-048 chiuso: `supabase/schema.sql` riallineato alla funzione `promote_next_waitlist` della migration 23 (`v_event_ok`, `v_price`, insert con `paid_price`).
- BUG-049 chiuso: `app/api/bookings/[id]/complete/route.js` ora rispetta `paid_price` se esiste gia', snapshottando solo i booking vecchi senza valore.
- P3 banner chiuso: `WaitlistPromotionBanner.jsx` ora filtra davvero eventi passati e usa `created_at` come fallback quando `waitlist_promoted_at` manca.
- Graphify check chiuso: `scripts/graphify.mjs` normalizza `graphify-out/.graphify_root` dopo `graph:update`, quindi `npm run graph:check` torna verde.
- Resta aperta solo l'osservazione P2 architetturale: il banner in root layout rende tutte le pagine legate al contesto auth/DB. Non e' blocco build, ma da valutare nel prossimo giro di performance/UX.

## Addendum: review codice booking/waitlist post-fix (2026-05-04)

> Review richiesta da Salandra dopo il confronto Codex/Opus sul rework. Nessun codice applicativo modificato in questa review: solo analisi e apertura bug nel vault.

### Verifiche eseguite

- `npm run lint` -> OK.
- `npm run build` -> OK. Solo warning Sentry legacy gia' noti.
- `node --check scripts/graphify.mjs` -> OK.
- `node --check scripts/check-agent-memory.mjs` -> OK.
- `npm run graph:update && npm run graph:check` -> OK.
- `git diff --check` sui file codice/tooling -> OK.

### Finding aperti

1. **P1 / BUG-050 - `/api/book` non verifica server-side `stall_status`**
   - Riferimento: `app/api/book/route.js:110-164`.
   - La route legge `stalls_with_status`, ma non seleziona `stall_status` e non rifiuta `blocked`, `booked` o `pending`.
   - Rischio: richiesta stale/manuale crea booking pending su posto non prenotabile, con possibile pagamento Stripe seguito da webhook fallito/no-op.
   - Fix consigliato: check `stall_status === 'free'` subito prima dell'insert, meglio ancora RPC atomica DB-side.

2. **P1 / BUG-051 - GC Stripe 15 min cancella pending waitlist 24h**
   - Riferimento: `supabase/schema.sql:422-425`.
   - `release_expired_pending_bookings()` cancella qualunque `status='pending'` piu' vecchio di 15 minuti.
   - I booking da waitlist sono anch'essi pending e dovrebbero durare 24h.
   - Fix consigliato: escludere `from_waitlist=true` dal GC breve e lasciare quei booking a `release_expired_waitlist_promotions()`.

3. **P2 / BUG-052 - `/complete` puo' creare piu' Checkout Stripe per lo stesso booking**
   - Riferimento: `app/api/bookings/[id]/complete/route.js:146-185`.
   - La route fa recheck pending ma non marca/riusa una sessione checkout attiva prima di crearne una nuova.
   - Rischio: doppio click, tab multiple o retry generano sessioni pagabili multiple; il secondo pagamento puo' essere accettato da Stripe ma ignorato dall'app.
   - Fix consigliato: claim/idempotency per booking, salvando/riusando `stripe_session_id` oppure lock atomico dedicato.

### Giudizio

Il rework resta compilabile e la correzione snapshot prezzo e' nella direzione giusta. I nuovi finding pero' sono logica di business, non estetica: prima di considerare solido il flusso booking/waitlist vanno chiusi almeno BUG-050 e BUG-051.
