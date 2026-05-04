---
tipo: implementation-plan
data: 2026-05-04
agente: opus
oggetto: redesign incrementale del sito applicando filosofie da huashu-design
---

# Plan: Redesign incrementale del sito

## Obiettivo

Applicare i principi di [[Skill-Huashu-Design]] (Pentagram, Stamen, Müller-Brockmann, Kenya Hara) a tutte le pagine del sito, **una per sessione**, mantenendo la coerenza visiva con la palette warm già esistente (cream/amber/stone + Inter/Fraunces).

Niente big-bang: ogni step è un commit separato, deployabile da solo, rollbackabile.

## Sessione 1 (FATTA — 2026-05-04)
### `/profilo` ✅
- Hero "Ciao, Nome." (Fraunces 4xl, leggero).
- 4 stat tiles con number tick + stagger reveal (Framer Motion).
- 3 sezioni semantiche: "Da fare ora" / "Prossime" / "Storico" (collassabile).
- Card prenotazione ridisegnate: gradient sottile per stato, hover lift -2px, prezzo grande in Fraunces.
- Banner globale waitlist promotion in `app/layout.js`.

**File toccati**: `app/profilo/page.js`, `components/ProfileBookingCard.jsx` (nuovo), `components/ProfileStatTile.jsx` (nuovo), `components/WaitlistPromotionBanner.jsx` (nuovo), `components/WaitlistPromotionBannerClient.jsx` (nuovo).

---

## Sessione 2 (FATTA — 2026-05-04)
### `/` (homepage) — Kenya Hara hero + Stamen card ✅
- Hero ridisegnato: kicker uppercase "Pro Loco Soresina · Bancarelle online", H1 Fraunces 5xl-7xl con `Soresina` italic amber, paragrafo XL, una sola CTA `Vedi i prossimi mercati`. Padding 96-112px verticale, niente badge.
- Event card nuova (`HomeEventCard.jsx`): progress bar warm gradient per posti occupati, contatore `freeCount/totalCount`, stagger reveal Framer Motion.
- Sezione "Sei un venditore?" spostata in fondo come link discreto (pre era CTA hero).
- Border-bottom su section header, empty state Fraunces "In attesa."

**File toccati**: `app/page.js` (riscritto), `components/HomeEventCard.jsx` (nuovo).

---

## Sessione 2 originale (proposta superata)
### `/` (homepage) — Kenya Hara hero + Stamen card
**Filosofia di riferimento**: Kenya Hara minimalism per l'hero, Stamen per le event card.

**Modifiche**:
1. **Hero**: rimuovere il blocco hero attuale (immagine + testo a fianco), sostituire con un grande titolo Fraunces + sottotitolo Inter centrato verticalmente, con SACCO di whitespace sopra/sotto (min 96px). Niente immagine full-width: la "voce" della Pro Loco è la tipografia.
2. **Sezione "Prossimi mercati"**: griglia 2-col (1 mobile) di card con:
   - Data grande Fraunces a sinistra (es. "12 / mag")
   - Titolo + descrizione 1 riga
   - Posteggi disponibili con micro-progress bar (es. "12 / 25 posti liberi")
   - Hover: lift -2px + ombra calda amber-100
   - Stagger delay 0.08s
3. **CTA secondaria**: "Come funziona" — 3-step con icone outline (no emoji) e numerazione discreta.

**File**: `app/page.js`, `components/EventCard.jsx` (rinominare AdminEventCard → estrarre versione pubblica? scelta da fare).

**Stima**: 1 sessione (~2h).

---

## Sessione 3 (PROPOSTA)
### `/evento/[id]` — Müller-Brockmann grid + map focus
**Filosofia di riferimento**: Swiss grid (densità ordinata), Stamen (mappa = elemento centrale).

**Modifiche**:
1. **Header evento**: titolo Fraunces + breadcrumb piccolo, no immagine sopra (la mappa è l'eroe).
2. **Mappa stalls full-width** sotto l'header, con sticky toggle satellite/grid.
3. **Sidebar/bottom info**: griglia 2x2 con data, luogo, prezzo base, posti liberi (numero animato).
4. **BookingForm**: sticky bottom-bar su mobile, sidebar destra su desktop.
5. **Pulse sui posti appena liberati** (Realtime): glow amber 600ms quando un altro utente cancella.

**File**: `app/evento/[id]/page.js`, `components/StallMapTabs.jsx`, `components/BookingForm.jsx`.

**Stima**: 1 sessione (~3h, perché tocca anche la BookingForm).

---

## Sessione 4 (PROPOSTA)
### `/admin` — Pentagram density (massima informazione, zero decoro)
**Filosofia di riferimento**: Pentagram (Bierut/Vignelli) — admin è uno strumento, deve essere denso.

**Modifiche**:
1. **KPI strip esistente** → ridurre dimensioni, allinearli con dashboard "alla Linear".
2. **Sezione Eventi attivi**: tabella compatta invece di card (più dati per riga).
3. **Sezione Cancellazioni in pending**: spostare in alto con badge contatore visibile.
4. **Hover row**: highlight stone-50 (no shadow, no lift).
5. **Spaziatura**: ridotta del 25% rispetto al sito pubblico.

**File**: `app/admin/page.js`, `components/AdminEventCard.jsx` (forse → AdminEventRow).

**Stima**: 1 sessione (~2h).

---

## Sessione 5 (OPZIONALE)
### `/prenotato/[id]` — micro-celebrations
**Filosofia di riferimento**: Sagmeister (momenti emozionali).

**Modifiche**:
1. Hero "Prenotazione confermata!" con confetti subtle (CSS-only, no library).
2. Riepilogo card più ariosa.
3. CTA secondarie con icone consistent.

**Stima**: 30min.

---

## Vincoli generali (mantenere su TUTTE le sessioni)

- **Niente nuove dipendenze**. Usiamo solo: Framer Motion (gia' installato), next/font Inter+Fraunces, Tailwind core.
- **No icone emoji**. Tutto inline SVG da [Lucide](https://lucide.dev) (manualmente in `<svg>` o ascendente da `lucide-react` se voglio importarla — confermare prima).
- **Performance budget**: Lighthouse mobile > 90 (attuale ~92). Non aggiungere immagini grandi sopra la piega senza `<Image priority />`.
- **A11y**: tutti i componenti animati con `prefers-reduced-motion` rispettato (Framer Motion lo fa di default).
- **Backward-compat**: ogni redesign deve coesistere con i componenti vecchi se non li tocca esplicitamente.

## Workflow per sessione

1. Salandra dice "Sessione N: vai".
2. Opus legge questo plan + Memoria-AI + ultimo devlog.
3. Implementa (1 commit per sezione redesignata).
4. `npm run build && npm run lint` per verificare.
5. `npm run graph:update && npm run graph:check`.
6. Devlog in `02-Devlog/2026-XX-XX-opus-redesign-N.md` (template in [[Memoria-AI]]).
7. Push staging, smoke test, merge su main su OK Salandra.

## Decisione finale
**[Salandra]** OK / NO-GO / Modifica priorita' sessioni.

## Wikilinks
- [[Skill-Huashu-Design]] — reference filosofie
- [[Memoria-AI]] — convenzioni vault e best practice tecniche
- [[backlog]] — stato bug aperti
