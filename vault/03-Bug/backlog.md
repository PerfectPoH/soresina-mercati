---
tipo: bug-tracker
ultimo-aggiornamento: 2026-05-04
---

# Backlog dei Bug

> 🟢 **0 bug critici aperti.** I 3 bug aperti dall'audit Codex 2026-05-04 (BUG-050 stall_status check, BUG-051 GC waitlist 24h, BUG-052 Stripe session idempotency) sono stati chiusi nella sessione 2026-05-05 (Opus). Aggiunti anche: dark mode email + UI annullamento forzato admin con motivo + scelta rimborso.
>
> 📚 **Storia completa** (BUG-001 → BUG-046, con cause, fix, motivazioni di chiusura) → [[Bug-Risolti-Storico]] in `_archive/`.

---

## 🔴 Bug aperti

*(nessuno)*

---

## 🆕 Bug risolti in questa sessione (2026-05-05, Opus)

### BUG-050 — `/api/book` non verificava server-side che il posteggio fosse libero
- **Priorita**: P1.
- **Sintomo**: una richiesta stale o costruita a mano poteva inviare `stall_id` di un posteggio blocked/booked/pending.
- **Fix**: `app/api/book/route.js` ora seleziona `stall_status` da `stalls_with_status` e ritorna 409 con messaggio dedicato per ciascuno stato (blocked / booked / pending) prima dell'INSERT.
- **Stato**: ✅ risolto.

### BUG-051 — GC Stripe 15min cancellava pending da waitlist che dovrebbero durare 24h
- **Priorita**: P1.
- **Sintomo**: i pending da `promote_next_waitlist` venivano cancellati dopo 15min invece che dopo 24h, contraddicendo banner ed email.
- **Fix DB** (migration 24): `release_expired_pending_bookings()` aggiunge `and coalesce(from_waitlist, false) = false`. I waitlist pending restano gestiti dal cron orario `release_expired_waitlist_promotions()`.
- **Migration applicata** su prod e staging.
- **Stato**: ✅ risolto.

### BUG-052 — `/api/bookings/[id]/complete` poteva creare Stripe Checkout multiple per lo stesso booking
- **Priorita**: P2.
- **Sintomo**: doppio click / due tab / retry creavano sessioni Stripe multiple → rischio doppio pagamento accettato da Stripe ma scartato dall'app.
- **Fix**: la query iniziale ora seleziona anche `stripe_session_id`. Prima di creare nuova session: se ne esiste una `complete`/`paid` → ritorna `alreadyPaid:true` (webhook in corso); se `open` → riusa l'URL; se `expired`/non recuperabile → crea nuova. La nuova `stripe_session_id` viene salvata SUBITO sul booking (claim atomico via `.eq('status', 'pending')`).
- **Stato**: ✅ risolto.

### Email dark mode (richiesta Salandra)
- **Sintomo**: contrasto basso in Apple Mail / Gmail / Outlook dark mode (gradient ambra + testi marroni invertiti automaticamente).
- **Fix**: `lib/email-templates.js` shell ora include `<meta name="color-scheme" content="only light">` + `<meta name="supported-color-schemes" content="light">` + `<style>` con `:root { color-scheme: only light; }` e media query `@prefers-color-scheme: dark` che forza i nostri colori warm con `!important`. Aggiunte classi `.em-card .em-meta .em-link .em-cta` su tutti gli elementi colorati per il targeting selettivo.
- **Stato**: ✅ risolto.

### UI Admin "Annulla forzatamente" con scelta rimborso (richiesta Salandra)
- **Sintomo**: il bottone "Annulla" nella tabella prenotazioni admin chiamava `DELETE /api/bookings/[id]` (endpoint utente) senza motivo, senza rimborso, senza email.
- **Fix**: `components/AdminBookingRow.jsx` `handleCancel` ora usa `POST /api/admin/bookings/[id]/cancel` (endpoint con motivo + refund). Flow:
  1. Prompt motivo obbligatorio (max 500 char).
  2. Se `stripe_payment_intent_id` esiste (booking pagato): confirm "Vuoi anche EMETTERE IL RIMBORSO di X€?" → sì/no.
  3. Se booking non pagato (gratuito o pending): confirm secco senza scelta rimborso (niente da rimborsare).
  4. Backend invia email automaticamente via `bookingCancelledByAdminEmail` con motivo + indicazione rimborso (gia' implementato in BUG-040).
- **Stato**: ✅ risolto.

---

## 🆕 Bug risolti in sessione precedente (2026-05-04, Codex audit)

### BUG-048 — `supabase/schema.sql` non includeva la nuova logica `promote_next_waitlist`
- **Sintomo**: la migration 23 crea `bookings.paid_price` e aggiorna `promote_next_waitlist` per snapshottare il prezzo, ma il dump consolidato `supabase/schema.sql` contiene ancora la funzione vecchia.
- **Causa root**: schema aggiornato solo per la colonna `paid_price`; la sezione funzione e' rimasta alla versione BUG-041.
- **Impatto**: chi ricostruisce il DB da `schema.sql` perde `paid_price` sulle promozioni da waitlist e anche il guard su evento attivo/futuro.
- **Fix**: `supabase/schema.sql` riallineato alla funzione definita in `supabase/migrations/23_bookings_paid_price.sql`: `v_event_ok`, `v_price`, insert con `paid_price`.
- **Stato**: ✅ risolto da Codex audit.

### BUG-049 — `/api/bookings/[id]/complete` poteva riscrivere lo snapshot `paid_price`
- **Sintomo**: una prenotazione pending promossa da waitlist puo' avere gia' `paid_price`, ma l'endpoint di completamento ricalcola il prezzo live da `stalls/events` e lo sovrascrive prima di Stripe.
- **Causa root**: la query non seleziona `paid_price`; `amountToPay` usa solo prezzo live e l'`update({ paid_price })` non controlla errori.
- **Impatto**: se l'admin cambia prezzo tra promozione e pagamento, l'utente puo' pagare il nuovo prezzo invece dello snapshot creato dalla promozione. Questo contraddice l'immutabilita' documentata da BUG-047.
- **Fix**: `app/api/bookings/[id]/complete/route.js` seleziona `paid_price`, calcola `amountToCharge = b.paid_price ?? livePrice`, valorizza `paid_price` solo se null, usa `amountToCharge` per Stripe/free flow e gestisce l'errore di snapshot.
- **Stato**: ✅ risolto da Codex audit.

---

## 🆕 Bug risolti in questa sessione (2026-05-04, Opus)

### BUG-047 — Modifica prezzo evento ricalcola incasso retroattivo
- **Sintomo**: l'admin modifica `events.price_per_stall` (es. 5€ → 10€). L'"incasso stimato" in dashboard cambia anche per le prenotazioni gia' confermate, mostrando un valore diverso da quello realmente pagato dall'utente.
- **Causa**: `calcolaIncasso(bookings)` leggeva live `b.stalls?.price ?? b.events?.price_per_stall ?? 0`. Senza una colonna snapshot, ogni lettura ricalcolava il prezzo corrente.
- **Fix DB** (migration 23): nuova colonna `bookings.paid_price numeric(10,2)`. Backfill SQL one-shot per le righe esistenti con il prezzo corrente. `promote_next_waitlist` aggiornata per snapshottare gia' alla creazione del pending da waitlist.
- **Fix codice**: `app/api/book/route.js` setta `paid_price` all'INSERT. `app/api/bookings/[id]/complete/route.js` setta `paid_price` prima di Stripe. `app/admin/page.js`, `app/profilo/page.js`, `app/prenotato/[id]/page.js` leggono `b.paid_price ?? <fallback live>`.
- **Stato**: ✅ codice + migration scritti. **DA APPLICARE** la migration 23 su prod e staging via mcp.

### Banner waitlist promotion (follow-up BUG-046)
- **Sintomo**: l'utente promosso da waitlist non aveva nessuna evidenza in-site, doveva ricordarsi di andare manualmente nel profilo per pagare.
- **Fix**: `components/WaitlistPromotionBanner.jsx` (server) + `WaitlistPromotionBannerClient.jsx` (client) integrati in `app/layout.js`. Banner persistente in cima con countdown 24h live (urgent < 4h diventa rosso), CTA "Vai al profilo →", dismiss persistente in localStorage.
- **Email**: ⏳ ancora parcheggiato (BUG-040 Resend). La notifica in-site copre il caso utente loggato.
- **Stato**: ✅ RISOLTO (in-site). Email follow-up con Resend.

### BUG-050 — Crash /profilo: function passata come prop server→client
- **Sintomo**: post-prenotazione redirect a /profilo da "Pagina Errore" `Qualcosa e' andato storto`. Sentry SORESINA-MERCATI-2: `Error: An error occurred in the Server Components render` (3 occorrenze in 1 minuto, environment=preview).
- **Causa**: `app/profilo/page.js` (server component) passava `formatDate={formatDate}` a `ProfileBookingCard` (client component). Next.js 14 non permette function come prop attraverso il boundary RSC: i prop devono essere JSON-serializzabili.
- **Fix**: spostato `formatDate` dentro `ProfileBookingCard.jsx` (gia' `'use client'`). Rimossa la prop dal call site (3 occorrenze). `formatDate` resta nel server component per uso interno (`hint={formatDate(...)}`, `<Field value={formatDate(...)}/>`).
- **Stato**: ✅ RISOLTO. Da pushare staging per verifica preview Vercel.

### Redesign /evento/[id] (Sessione 3 di [[Plan-Redesign-Incrementale]])
- Header Müller-Brockmann split-grid: data XL "12 / MAG" Fraunces a sinistra, titolo + descrizione a destra, border-bottom.
- Image_url spostata sotto come "evidence" invece di hero overlay.
- Info grid 2x2/4x1: Data / Luogo / Prezzo / Posti.
- Occupancy bar warm gradient + pill stato posteggi sopra la mappa.
- Mappa resta l'eroe della pagina.

### Redesign /admin (Sessione 4 di [[Plan-Redesign-Incrementale]])
- Header H1 Fraunces "Dashboard" + kicker uppercase, CTA "+ Nuovo evento" a destra.
- Nav sub-header con divider sottile invece di pill, link rosso + badge per cancellazioni urgenti.
- Banner urgente subito sotto: "N richieste di cancellazione da gestire" + CTA "Gestisci →".
- KPI strip Linear-style: tile su griglia stone gap-px, numeri 2xl-3xl Fraunces tabular, accent ambra solo su Incasso.

### Refresh /prenotato/[id] (Sessione 5 di [[Plan-Redesign-Incrementale]])
- Hero ariosa con titolo Fraunces 3xl-4xl ("Prenotazione confermata.").
- Indicator dot ring (cerchio outer + inner con SVG check/clock/cross) invece di emoji.
- Codice prenotazione font-mono tracking-wider sotto l'hero.
- Bottoni azione con SVG inline (calendar, map) al posto delle emoji 📅 🗺.

### Redesign homepage `/` (Sessione 2 di [[Plan-Redesign-Incrementale]])
- Hero filosofia Kenya Hara: titolo Fraunces 5xl-6xl-7xl con `Soresina` in italic ambra come accent unico, kicker uppercase tracking-wide, padding-top/bottom abbondante (96px+), una sola CTA (no badge "Prenotazioni aperte" + "Sei un venditore?" → spostato in fondo come link discreto).
- Event card Stamen-style nuova (`HomeEventCard.jsx`): aggiunta progress bar warm gradient amber-300→500 per posti occupati, contatore `freeCount/totalCount` tabular, stagger reveal Framer Motion (delay 0.08s × index).
- Section "Prossimi mercati" con border-bottom invece di solo h2, contatore eventi uppercase tracking-wider.
- Empty state ridisegnato: `<p>In attesa.</p>` Fraunces invece di una riga sola.
- BUG-050 lezione applicata: pre-formattazione `chipDate` e `pill` nel server component, passati al client come stringhe/oggetti.

### Redesign /profilo (Sessione 1 di [[Plan-Redesign-Incrementale]])
- Hero "Ciao, [Nome]." in Fraunces 4xl.
- 4 KPI tile con stagger reveal Framer Motion (`ProfileStatTile.jsx`).
- 3 sezioni semantiche: "Da fare ora" / "Prossime" / "Storico" collassabile.
- Card prenotazione ridisegnate (`ProfileBookingCard.jsx`): gradient sottile per stato, hover lift -2px, prezzo grande Fraunces.
- Filosofie applicate da [[Skill-Huashu-Design]]: Pentagram (gerarchia tipografica) + Stamen (warm gradient) + Kenya Hara (whitespace).

---

## ⏳ In attesa di dipendenze esterne

*(nessuno)*

## ✅ Risolti recentemente (in coda di archiviazione)

### BUG-040 — Email transazionali via Resend ✅
- **Stato finale**: 3 email critiche implementate via Resend SDK + template inline JSX-to-string.
  - Conferma prenotazione (post Stripe `checkout.session.completed`).
  - Annullamento admin con/senza rimborso (motivo da `admin_cancel_reason`, `admin_refunded`).
  - Promozione waitlist (24h scadenza, in entrambi i punti: cancel+promote auto e promote manuale admin).
- **Files**: `lib/email.js` (wrapper), `lib/email-templates.js` (3 template), hook in `app/api/webhooks/stripe/route.js`, `app/api/admin/bookings/[id]/cancel/route.js`, `app/api/admin/waitlist/[id]/promote/route.js`.
- **Pattern**: lazy init client (no crash se `RESEND_API_KEY` manca), fail-safe (l'invio non rolla back state DB), idempotency via `.select(...).maybeSingle()` dopo UPDATE.
- **Da configurare lato Salandra**: dominio verificato Resend (DNS SPF+DKIM+DMARC) + `RESEND_FROM_EMAIL` su Vercel. Per testing immediato `onboarding@resend.dev` (limite 100/day to-own-email).

---

## 🟡 Tech debt (non bloccante)

### TECH-DEBT-001 — Date helper UTC vs locale
- **Cosa**: `toISOString().slice(0, 10)` usato in 9+ file per `today`. Al confine notturno (~01:00 ora italiana = 23:00 UTC) può dare il giorno "sbagliato" in confronti `event.date < today`.
- **Volume Pro Loco** (1 timezone, eventi giornalieri): rischio basso.
- **Fix**: helper `lib/dates.js` con `todayInRome()` quando si va multi-region.

### TECH-DEBT-002 — GDPR `consent_at` non valorizzato in bootstrap profilo
- **Cosa**: il consenso (checkbox cookies/privacy) non viene salvato in `vendors.consent_at` al signup.
- **Fix**: settare `consent_at = now()` al primo signup. Affrontare con la fase email Resend.

### TECH-DEBT-003 — Componenti monolitici
- `components/StallMapSatellite.jsx` (~20KB)
- `components/BookingForm.jsx` (~10KB)
- **Priorità**: bassa, post-consegna Pro Loco.
- **Fix**: estrarre `StallTooltip`, `BookingFormFields`, `BookingFormSubmit`.

### TECH-DEBT-004 — Mancano test automatizzati
- 0 E2E (Playwright), 0 unit test (Vitest).
- **Pre-consegna**: smoke test sui 3 flussi critici (signup, prenotazione end-to-end Stripe, admin block/unblock).

### TECH-DEBT-005 — Rate limiting in-memory
- `lib/rate-limit.js` usa `Map` in memoria. Su Vercel serverless è frammentato per istanza.
- **OK** per volume Pro Loco (~50 prenotazioni/anno).
- **Migrare** a Vercel KV / Upstash se multi-tenant.

### TECH-DEBT-006 — `Roadmap-Master.md` allineamento periodico
- Rivedi ad ogni milestone (consegna Pro Loco, dominio, Stripe live).

---

## 📊 Riassunto bug risolti per categoria (BUG-001 → BUG-046)

**Sicurezza** (7): BUG-007, 008, 013, 018, 021, 024, 014.
**Schema/DB** (5): BUG-002, 005, 006, 017, 026.
**Stripe** (5): BUG-001, 003, 004, 012, 015.
**API/UX** (8): BUG-009, 010, 011, 016, 020, 023, 025, 027, 028.
**Admin/Operatività** (8): BUG-029, 030, 031, 038, 039, 041, 045, 046.
**User flow** (7): BUG-032, 033, 034, 035, 036, 037, 042, 043, 044.
**NOT-A-BUG**: BUG-019 (singleton supabase-admin), BUG-022 (`revalidatePath` pre-Stripe).

**Totale**: 46 bug aperti, 44 chiusi (✅), 1 parcheggiato (⏳ BUG-040 Resend), 2 NOT-A-BUG.

---

## 📝 Convenzioni per scrivere un bug report

> Vedi [[Memoria-AI]] §Convenzioni Vault per il template completo.

In sintesi: ogni bug nuovo va in **questo file** (sezione "Bug aperti") con:
- **ID progressivo** (BUG-NNN)
- **Sintomo** osservabile (cosa vede l'utente)
- **Causa root** (post-debug)
- **Fix** (file + righe + migration se DB)
- **Stato**: 🔴 aperto / ⏳ parcheggiato / ✅ risolto

Quando un bug è **chiuso da una settimana** o segna la fine di una sessione, lo si **sposta in `_archive/Bug-Risolti-Storico.md`** mantenendo solo una riga di summary qui (categoria + ID).
