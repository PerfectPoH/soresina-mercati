---
tipo: devlog
data: 2026-05-04
agente: opus
topic: sessioni3-4-5-redesign-evento-admin-prenotato
---

# Sessioni 3-4-5 — Redesign /evento + /admin + /prenotato

## Contesto
Salandra ha confermato che la Sessione 2 (homepage Kenya Hara) funziona e ha chiesto di fare "tutto il resto" del [[Plan-Redesign-Incrementale]]. Procediamo con le 3 sessioni in cascata.

## Cosa ho fatto

### Sessione 3 — `/evento/[id]` (Müller-Brockmann)
- **Header split-grid**: data XL Fraunces "12 / MAG" col-span-2 a sinistra, titolo + descrizione + meta-date col-span-10 a destra. Border-bottom invece di hero immagine.
- **Image_url demoted**: era hero overlay scuro (h-72/h-80/h-26rem). Ora va SOTTO l'header come "evidence" (h-56/h-72), niente overlay.
- **Info grid disciplinata**: nuova `<dl>` 2x2/4x1 con celle bianche su griglia stone gap-px (Data / Luogo / Prezzo / Posti). Label uppercase tracking-wider mini, value medium.
- **Occupancy bar**: warm gradient amber-300→amber-500 sopra le pill di stato posteggi. Lettura sintetica prima della mappa.
- **Banner past + waitlist**: invariati ma class refresh.
- **Mappa stalls**: resta l'eroe della pagina (non toccata, focus su layout intorno).

### Sessione 4 — `/admin` (Pentagram density)
- **Header split**: H1 Fraunces "Dashboard" + kicker uppercase tracking-wider "Gestione mercati · Pro Loco Soresina", CTA "+ Nuovo evento" a destra. Sostituito mb-8 + flex flat con header dedicato + border-b sub-nav.
- **Nav sub-header orizzontale**: link semplici con divider sottile (era pill bordate per ognuno). "Cancellazioni" diventa rosso semantica + badge contatore se `cancelRequests > 0`.
- **Banner urgente**: card rossa subito sotto l'header se `cancelRequests > 0`. Mostra "N richieste da gestire" + CTA "Gestisci →". Pentagram principle: information hierarchy = visual hierarchy.
- **KPI strip Linear-style**: tile su griglia stone con gap-px (era pill bordate gap-3). Numeri 2xl-3xl Fraunces tabular, label uppercase mini. Accent ambra solo su "Incasso stimato".
- **Sezioni eventi/booking**: label uppercase tracking-wider, archivio collassabile invariato.

### Sessione 5 — `/prenotato/[id]` (Sagmeister micro-celebration)
- **Hero ariosa**: padding 8/10 (era 6/8). Titolo Fraunces 3xl-4xl con punto finale ("Prenotazione confermata."). Sottotitolo max-w-md leading-relaxed.
- **Indicator dot ring**: emoji ⏳ ✓ × sostituite con cerchio outer 80x80 a opacity 60% + cerchio inner 48x48 con SVG inline (check/clock/cross stroke 2-3px). Pi&ugrave; "design" e meno "Material UI".
- **Codice prenotazione**: spostato sotto l'hero in font-mono tracking-wider, "Codice {refCode}" inline-flex.
- **Riepilogo card**: header con price tabular nell'angolo destro come quick-glance ("Riepilogo · 35€"). Label uppercase tracking-wider mini su tutte le row.
- **Bottoni azione**: emoji 📅 🗺 sostituite con SVG inline (calendar/map). 16x16, stroke 2px, gap-2.
- **Box "Cosa fare ora"**: label uppercase mini header, leading-relaxed sui list items.

## Lezioni applicate
- **No function across RSC boundary** (BUG-050): dove possibile passo solo dati pre-formattati. La maggior parte di queste pagine sono server component pure, niente client child con function-prop.
- **No emoji come icona-decoro**: tutte sostituite da SVG inline (Müller-Brockmann + Pentagram preferiscono linee geometriche pulite).
- **Density gerarchica**: spaziatura ridotta del 25% su `/admin` (mb-8 → mb-6, gap-6 → gap-4), aumentata del 30% su `/prenotato` (p-6 → p-10) — admin = strumento, conferma = momento.

## Verifiche
- `node --check` su tutti i 3 file → SYNTAX_OK.
- `npm run lint` → no warnings/errors.
- `npm run graph:update && graph:check` → tutti gli OK passano.

## Files toccati
- `app/evento/[id]/page.js` (riscritto, ~280 righe).
- `app/admin/page.js` (riscritto, ~195 righe).
- `app/prenotato/[id]/page.js` (riscritto, ~282 righe).
- `vault/04-Documentazione/Plan-Redesign-Incrementale.md` (Sessioni 3, 4, 5 marcate FATTE).
- `vault/03-Bug/backlog.md` (sezione redesign aggiornata).
- `vault/02-Devlog/2026-05-04-opus-sessioni3-4-5-redesign-completo.md` (questo).

## Note per la prossima sessione
1. Push staging per preview Vercel.
2. Smoke test:
   - `/evento/[id]` con e senza image_url (varianti hero).
   - `/admin` con e senza richieste cancellazione (banner urgente).
   - `/prenotato/[id]` per i 3 variant: confirmed, pending (waitlist 24h e Stripe 15min), cancelled.
3. **Plan-Redesign-Incrementale completato al 100%**. Le prossime sessioni di redesign sono opzionali (es. polish minore di componenti esistenti).
4. **Prossimi step macroscopici** ([[backlog]] e [[Roadmap-Master]]):
   - **BUG-040 / Resend onboarding** (ultimo bug parcheggiato, sblocca email transazionali).
   - **TECH-DEBT** non bloccanti: helper UTC date, GDPR `consent_at`, refactor monolitici.
   - **Test E2E Playwright** sui 3 flussi critici.
