---
tipo: devlog
data: 2026-05-04
agente: opus
topic: bug047-prezzo-banner-waitlist-profilo-redesign
---

# Sessione Opus — BUG-047, banner waitlist, redesign profilo, plan redesign

## Contesto
Salandra ha segnalato:
1. Bug: modificando il prezzo di un evento in admin, l'incasso stimato cambia anche per le prenotazioni gia' esistenti (dovrebbe restare il prezzo pagato originariamente).
2. Vuole importare la skill huashu-design per rinnovare gradualmente la grafica del sito.
3. Vuole che la pagina /profilo sia piu' organizzata e bella.
4. Vuole che quando un utente viene promosso da waitlist riceva una notifica in-site (non email) per andare al profilo a completare il pagamento.

Ordine concordato: Bug → Notifica → Profilo + Design.

## Cosa ho fatto

### 1. BUG-047 (prezzo congelato)
- **Migration `23_bookings_paid_price.sql`**: aggiunta colonna `bookings.paid_price numeric(10,2)`. Backfill SQL one-shot con `coalesce(stalls.price, events.price_per_stall, 0)` per le righe esistenti. Update di `promote_next_waitlist` per snapshot del prezzo gia' alla creazione del booking pending dalla waitlist.
- **`app/api/book/route.js`**: l'INSERT bookings ora include `paid_price: amountToPay`.
- **`app/api/bookings/[id]/complete/route.js`**: setta `paid_price` PRIMA di creare la session Stripe (cosi' anche modifiche admin live durante checkout non distorcono lo storico). Per evento gratuito setta `paid_price: 0` insieme al confirm.
- **`app/admin/page.js calcolaIncasso`**: legge `b.paid_price ?? b.stalls?.price ?? b.events?.price_per_stall ?? 0`. La query include `paid_price` nel select.
- **`app/profilo/page.js`** + **`app/prenotato/[id]/page.js`**: stesso fallback ordinato. Le UI di lettura non guardano piu' i prezzi live.
- **`supabase/schema.sql`**: aggiunta la colonna nel dump consolidato.

**Status**: ✅ codice completo, migration scritta. **DA APPLICARE** al DB Supabase prod + staging via mcp `apply_migration` o manualmente.

### 2. Banner notifica waitlist promotion (BUG-046 follow-up)
- **`components/WaitlistPromotionBanner.jsx`** (server component): query bookings dell'utente con `status='pending' AND from_waitlist=true`. Filtra eventi rimossi/passati. Passa al client component.
- **`components/WaitlistPromotionBannerClient.jsx`** (client): banner sticky in cima al sito (warm amber). Una card per ogni booking, con countdown live (tick ogni 60s, urgent < 4h diventa rosso), CTA "Vai al profilo →" verso `/prenotato/[id]`, e "Nascondi" che memorizza l'id in `localStorage` (chiave `wl-promo-dismissed-v1`).
- **`app/layout.js`**: integrato sopra `<Header>` con `<Suspense fallback={null}>`.

### 3. Redesign /profilo (Sessione 1 del plan)
Applicate filosofie Pentagram (gerarchia tipografica) + Stamen (warm gradient) + Kenya Hara (whitespace).

- **Hero personalizzato**: "Ciao, [Nome]." in Fraunces 4xl, tono variabile in base a pending/active.
- **4 KPI tile** (`ProfileStatTile.jsx` nuovo): Totali / Attive / In attesa / Prossimo evento — con stagger reveal Framer Motion.
- **3 sezioni semantiche**:
  - "Da fare ora" (solo se ci sono pending) con accent amber.
  - "Prossime prenotazioni" (active future) con empty state CTA verso "/".
  - "Storico" (passate + cancelled + unknown) collassabile via `<details>`.
- **Card prenotazione** (`ProfileBookingCard.jsx` nuovo): gradient sottile per stato, dot accent + label uppercase mini, prezzo grande Fraunces a destra, hover lift -2px (solo per attive/pending). Box motivo cancellazione admin se presente.
- **Sezione info**: spostata in basso, divisa da divider.
- **Zona pericolo**: rosso piu' discreto (red-50/60 invece di pieno).

### 4. Skill huashu-design + Plan redesign incrementale
- Cloned in `/tmp/huashu-design` per ispezione (NON committato nel repo: 800+ righe SKILL.md + GB di asset cinesi).
- **`vault/04-Documentazione/Skill-Huashu-Design.md`**: doc di reference con le 4 filosofie applicabili (Pentagram, Stamen, Müller-Brockmann, Kenya Hara) tradotte in pattern concreti per il nostro stack.
- **`vault/04-Documentazione/Plan-Redesign-Incrementale.md`**: piano con 4 sessioni successive (homepage, evento, admin, prenotato) con stime e vincoli (no nuove dipendenze, no emoji icons, Lighthouse > 90).

## Problemi incontrati
- La skill huashu-design e' una collezione di filosofie HTML hi-fi prototypes / animazioni / slide, NON una libreria React drop-in. Ho dovuto adattarla: estratto solo i principi e applicato manualmente con Tailwind + Framer Motion (gia' installato).
- Il Read tool richiede di rileggere il file PRIMA di Edit anche in middle of session quando il file e' stato modificato 2 turni prima. Annotato come tech-debt nel workflow (non blocca, ma costa 1 tool call extra).

## Audit Codex post-rework (riconoscimento)

Codex ha auditato il rework e trovato 3 problemi reali (vedi [[2026-05-04-codex-audit-opus-rework]]):

- **BUG-048**: ho aggiornato `bookings.paid_price` in `schema.sql` consolidato ma NON la funzione `promote_next_waitlist` (era ancora la versione BUG-041, senza snapshot e senza guard evento futuro). Bootstrap su nuovo Supabase project sarebbe rotto. Codex ha riallineato la funzione.
- **BUG-049**: in `complete/route.js` non selezionavo `paid_price` nella query, quindi il mio `update({ paid_price: amountToPay })` riscriveva ciecamente lo snapshot esistente (es. quello creato da `promote_next_waitlist`). Se l'admin modificava il prezzo tra promozione e completamento, l'utente pagava il NUOVO prezzo invece del prezzo promesso. Codex ha aggiunto: SELECT include `paid_price`; `amountToCharge = b.paid_price ?? livePrice`; UPDATE solo se `b.paid_price == null`; recheck pending con `.maybeSingle()` per detection 409.
- **Banner waitlist**: il commento diceva "filtra eventi passati" ma il filtro reale controllava solo che `events.date` esistesse. Codex ha aggiunto `&& b.events.date >= todayIso` + fallback `created_at` se `waitlist_promoted_at` è null.

Inoltre Codex ha aggiunto `scripts/graphify.mjs` (wrapper Node multi-platform) e `.graphifyignore`. Setup graphify ora robusto.

**Lezioni archiviate** in [[Memoria-AI]]: allineamento `schema.sql` post-migration; pattern "snapshot-aware" per endpoint che operano su righe gia' valorizzate.

## Note per la prossima sessione
1. **Applicare migration 23** al DB Supabase: `apply_migration('23_bookings_paid_price', <SQL del file>)` su prod + staging.
2. **Verificare graph aggiornato**: `npm run graph:update && npm run graph:check`.
3. **Smoke test profilo**: aprire /profilo come utente con prenotazioni miste (active + pending + past) e verificare che le sezioni si separino correttamente.
4. **Smoke test banner**: con utente che ha booking pending da waitlist, verificare countdown e dismiss persistente.
5. **Quando Salandra dice "vai"**: partire con Sessione 2 del plan (homepage Kenya Hara hero + Stamen card).
6. **BUG-040 ancora parcheggiato**: la notifica banner copre il caso "in-site"; quando arriva Resend, aggiungere anche email transazionale.

## Files toccati
**Codice (8)**:
- `app/api/book/route.js`
- `app/api/bookings/[id]/complete/route.js`
- `app/admin/page.js`
- `app/profilo/page.js` (riscritto)
- `app/prenotato/[id]/page.js`
- `app/layout.js`
- `supabase/schema.sql`
- `supabase/migrations/23_bookings_paid_price.sql` (nuovo)

**Componenti nuovi (4)**:
- `components/ProfileBookingCard.jsx`
- `components/ProfileStatTile.jsx`
- `components/WaitlistPromotionBanner.jsx`
- `components/WaitlistPromotionBannerClient.jsx`

**Vault (3)**:
- `vault/04-Documentazione/Skill-Huashu-Design.md` (nuovo)
- `vault/04-Documentazione/Plan-Redesign-Incrementale.md` (nuovo)
- `vault/02-Devlog/2026-05-04-opus-bug047-banner-profilo-redesign.md` (questo)

## Wikilinks
- [[backlog]] — aggiungere BUG-047 chiuso
- [[Memoria-AI]] — aggiungere lezione su `paid_price` snapshot
- [[Plan-Redesign-Incrementale]] — prossime sessioni di redesign
- [[Skill-Huashu-Design]] — reference filosofie
