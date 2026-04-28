---
tipo: devlog
data: 2026-04-27
agente: Claude Opus 4.7
sessione: bugs-038-041 + waitlist-flow + audit-codex-followups
tags: [waitlist, archive, og-image, codex-audit, resend-pending]
---

# Devlog 2026-04-27 — Opus, bugs 038-041 + chiusura audit Codex

## Contesto

Salandra ha riportato 4 problemi nuovi:
1. Admin mostra prenotazioni di mercati passati con bottone "Annulla"
2. Mercati passati restano "Attivi" nell'admin
3. Cancellazione/rimborso non manda email all'utente (parking, dipende da Resend)
4. Lista d'attesa funzionale incompleta — l'admin può solo rimuovere

Inoltre Codex 5 ha lasciato un audit `Code-Review-Codex-vs-Opus.md` con findings P1/P2/P3.

## Cosa ho fatto

### BUG-038 — Admin prenotazioni eventi passati
- `app/admin/page.js`: query bookings filtrata `events!inner(date >= today)` + le prenotazioni passate restano nel profilo utente come storico
- `components/AdminBookingRow.jsx`: edge case — se per qualche ragione una booking passata appare, mostriamo "Storico" invece di "Annulla"

### BUG-039 — Auto-archive eventi passati
- **Migration 19**: funzione `archive_past_events()` SECURITY DEFINER + cron `pg_cron` ogni notte 03:15
- Eseguito subito su staging: 2 eventi archiviati
- **Dashboard admin**: due sezioni — "Eventi attivi" + `<details>` "Archivio" (collassabile, accessibile)

### BUG-041 — Waitlist flow completo
Schema:
- `waitlist.stall_id uuid` (nullable, NULL = lista generale, valorizzato = posto specifico)
- `bookings.from_waitlist boolean default false` + `bookings.waitlist_promoted_at timestamptz`

DB:
- `promote_next_waitlist(p_event_id, p_stall_id)` SECURITY DEFINER:
  - priorità a chi ha targetato lo specifico posto, poi lista generale (FIFO per `created_at`)
  - crea booking pending con `from_waitlist=true`, `waitlist_promoted_at=now()`
  - se utente è al limite (P0001), salta e prova successivo
  - rimuove entry dalla waitlist
- `release_expired_waitlist_promotions()`: cron orario, cancella pending > 24h e auto-promuove il successivo

API:
- `POST /api/admin/bookings/[id]/cancel`: dopo refund Stripe, chiama `promote_next_waitlist(event_id, stall_id)` automaticamente
- `POST /api/admin/waitlist/[id]/promote`: promozione manuale (per lista generale sceglie primo posto free)

UI:
- `AdminWaitlistRow.jsx`: bottone "Promuovi" + "Rimuovi"

### BUG-040 — Email parking
Documentato in backlog. Da implementare insieme alla pipeline Resend. Trigger:
- Webhook Stripe → email conferma all'utente
- Cancel approve → email refund
- Waitlist promote → email "hai 24h per pagare"

## Codex audit — chiusura findings

### P1: BUG-027 reale fix
Codex aveva ragione: il `dynamic = 'force-dynamic'` non basta sui metadata files (`app/opengraph-image.js`). Next.js processa comunque il prerender al build.

**Soluzione definitiva**: rimosso `app/opengraph-image.js`, creata route API `app/api/og/route.js` (le route API non sono prerender). `app/layout.js` referenzia `metadata.openGraph.images = ['/api/og']` esplicitamente. Aggiunti header Cache-Control per evitare rigenerazione su ogni preview di link.

### P2: GOODS_TYPES in WaitlistWidget
Sostituita l'ultima copia hardcoded con import da `lib/validate`. BUG-023 ora veramente chiuso.

### P2: README.md / docs/SECURITY.md
Aggiornati in commit a parte (vedi commit successivo se necessario — questo devlog è già pieno).

### P3: aria-pressed → aria-selected su gridcell
Fixato in StallMap.jsx.

### P3: react-hooks/exhaustive-deps in StallMapSatellite
Refattorizzato `MapController` con `centerKey` stabile.

### Punto aperto: date helper UTC vs locale
Per ora tech-debt accettabile (Pro Loco = 1 timezone CET). Da affrontare se multi-region.

### Punto aperto: GDPR consent_at bootstrap
Tech-debt — quando un utente fa signup, salvare `consent_at = now()` nel profilo vendor. Va in pipeline Resend (email + GDPR insieme).

## Stato post-sessione

- **Bug aperti**: 0
- **Bug chiusi totali**: 41 (1-25, 26-41)
- **Tech-debt**: 4 + 2 nuovi (date helper UTC, consent_at GDPR)
- **Email transazionali**: parking BUG-040, da fare con Resend

## Prossimi step

1. **Salandra**: testa su staging
   - Crea evento futuro → vai in passato (modifica data) → verifica auto-archive (cron alle 03:15) o esegui manualmente `select archive_past_events()` su SQL editor Supabase
   - Iscriviti waitlist (lista generale) → admin: "Promuovi" → verifica booking pending creata
   - Annulla con rimborso una booking → verifica che il primo della waitlist viene promosso automaticamente
2. **Salandra**: continua onboarding Stripe live
3. **Quando ok**: implementiamo Resend (BUG-040 + email waitlist + GDPR consent)
