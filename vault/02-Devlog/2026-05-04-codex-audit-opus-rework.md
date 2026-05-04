---
data: 2026-05-04
tipo: devlog
autore: Codex
---

# Audit Codex rework Opus BUG-047 / banner / profilo

## Contesto

Salandra ha chiesto a Codex di verificare il rework esteso fatto da Opus su:
- snapshot prezzo `bookings.paid_price`;
- banner in-site per promossi da waitlist;
- redesign incrementale della pagina profilo;
- aggiornamento vault/documentazione.

## Verifiche

- `npm run lint` iniziale: OK.
- `npm run build` iniziale: OK, solo warning Sentry legacy.
- Audit mirato su migration 23, `supabase/schema.sql`, endpoint complete booking, webhook Stripe, admin dashboard, profilo, pagina prenotato e banner waitlist.

## Problemi trovati

### BUG-048

`supabase/schema.sql` aveva la colonna `paid_price`, ma la funzione consolidata `promote_next_waitlist` era ancora vecchia: insert senza `paid_price` e senza controllo evento attivo/futuro.

### BUG-049

`app/api/bookings/[id]/complete/route.js` non selezionava `paid_price`, quindi ricalcolava il prezzo live e poteva sovrascrivere lo snapshot gia' creato dalla promozione waitlist.

### Banner waitlist

`WaitlistPromotionBanner.jsx` commentava il filtro degli eventi passati, ma il filtro reale controllava solo che `events.date` esistesse.

## Fix applicati

- `supabase/schema.sql` riallineato alla funzione della migration 23:
  - `v_event_ok`;
  - `v_price`;
  - insert booking con `paid_price`.
- `app/api/bookings/[id]/complete/route.js`:
  - seleziona `paid_price`;
  - calcola `amountToCharge = b.paid_price ?? livePrice`;
  - non riscrive snapshot esistenti;
  - snapshottizza solo booking vecchi senza `paid_price`;
  - usa `amountToCharge` per Stripe/free flow;
  - gestisce errore e race sullo snapshot update.
- `components/WaitlistPromotionBanner.jsx`:
  - seleziona `created_at`;
  - filtra eventi passati;
  - usa `waitlist_promoted_at || created_at` come fallback.
- `scripts/graphify.mjs`:
  - dopo `graph:update` normalizza `graphify-out/.graphify_root` sul workspace corrente;
  - evita che `graph:check` fallisca per un marker stale generato dal tool.
  - follow-up post-review Opus: wrapper riscritto completo e robusto, con fallback ordinati (`graphify`, `py -m graphify`, `python -m graphify`, `python3 -m graphify`) e report finale dei candidati provati.
- `vault/03-Bug/backlog.md` aggiornato: BUG-048 e BUG-049 risolti.
- `vault/04-Documentazione/Code-Review-Codex-vs-Opus.md` aggiornato con audit e follow-up.

## Esito post-fix

- `npm run lint`: OK.
- `npm run build`: OK.
- `npm run graph:update`: OK.
- `npm run graph:check`: OK.
- Dev server `http://localhost:3000`: OK.
- Smoke HTTP:
  - `/`: 200;
  - `/privacy`: 200;
  - `/api/health`: 200 con DB OK.

## Nota residua

Il banner waitlist e' montato in `app/layout.js`, quindi puo' rendere dinamiche anche pagine pubbliche semplici. Non e' un blocco, ma e' una scelta da rivedere se si vuole recuperare caching/static rendering su privacy, termini e pagine pubbliche.

## Review successiva: bug aperti booking/waitlist

Dopo un secondo passaggio di review, senza modifiche al codice applicativo, Codex ha aperto tre bug nel vault:

- **BUG-050 / P1**: `/api/book` non seleziona ne' controlla `stall_status`, quindi puo' creare booking pending su posteggi blocked/booked/pending se la richiesta e' stale o manuale.
- **BUG-051 / P1**: `release_expired_pending_bookings()` cancella tutti i pending dopo 15 minuti, inclusi i pending da waitlist che dovrebbero durare 24h.
- **BUG-052 / P2**: `/api/bookings/[id]/complete` puo' creare piu' Stripe Checkout session per lo stesso booking pending.

Tracciati in:
- `vault/03-Bug/backlog.md`;
- `vault/04-Documentazione/Code-Review-Codex-vs-Opus.md`;
- `vault/00-Progetto/Memoria-AI.md`.
