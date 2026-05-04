---
tipo: devlog
data: 2026-05-04
agente: opus
topic: sessione2-homepage-kenyahara-stamen
---

# Sessione 2 — Redesign homepage Kenya Hara + Stamen

## Contesto
Salandra ha confermato che il fix BUG-050 funziona in preview. Procediamo con la Sessione 2 del [[Plan-Redesign-Incrementale]]: redesign homepage applicando Kenya Hara hero + Stamen event card.

## Cosa ho fatto

### Hero Kenya Hara (`app/page.js`)
- Rimosso badge "Prenotazioni aperte · 2026" (decoro non funzionale).
- Aggiunto kicker uppercase tracking-[0.18em] "Pro Loco Soresina · Bancarelle online" per dare contesto senza rumore.
- H1 ingrandita: 5xl mobile / 6xl tablet / 7xl desktop (era 4xl/5xl/52). `Soresina` resta in italic amber-brand come accent unico.
- Paragrafo cresciuto a `text-lg/text-xl` per coerenza con il titolo.
- CTA secondaria "Sei un venditore?" rimossa dall'hero (era visivamente pesante) e spostata in fondo come link discreto.
- Padding verticale aumentato: pt-12/sm:pt-20 e pb-20/sm:pb-28 (era mb-12/14).

### Event card Stamen (`components/HomeEventCard.jsx` nuovo)
- Client component con Framer Motion stagger reveal (delay 0.08s × index).
- Aggiunta **progress bar warm** dei posti occupati: gradient `from-amber-300 to-amber-500`, altezza 1.5px, animazione `transition-all duration-500`. Sopra il contatore `12 posti liberi · 13/25` tabular-nums.
- Hover lift -0.5 + shadow amber-tinted (gia' presente, aumentato `duration-300`).
- Date chip overlay invariato.

### Sezione eventi
- Border-bottom sulla H2 invece di nudo.
- Contatore eventi a destra in uppercase tracking-wider.
- Empty state ridisegnato: titolo Fraunces "In attesa." invece di una riga grigia.

### Sezione venditori
- Sotto la lista eventi, divisa da `border-t pt-10`.
- "Sei un venditore non ancora registrato?" + link "Crea un account venditore →" ambra.

## Lezioni applicate
- **No function across RSC boundary** (BUG-050): pre-formattazione `chipDate` e `pill` nel server component, passati al client come oggetti/stringhe pure.
- **Snapshot pre-formattato**: il server costruisce `eventCards = [{ event, chipDate, pill, freeCount, totalCount }]` e itera passando solo dati serializzabili.

## Verifiche
- `node --check app/page.js` → OK.
- `npm run lint` → no warnings/errors.
- `npm run graph:update` → 274+ nodi, 339+ archi.
- `npm run graph:check` → tutti gli OK passano.

## Files toccati
- `app/page.js` (riscritto, 173 righe).
- `components/HomeEventCard.jsx` (nuovo, 102 righe).
- `vault/03-Bug/backlog.md` (sezione Sessione 2 redesign aggiunta).
- `vault/04-Documentazione/Plan-Redesign-Incrementale.md` (Sessione 2 marcata FATTA).

## Note per la prossima sessione
1. Push staging per preview Vercel.
2. Smoke test homepage: hero responsive (mobile/tablet/desktop), progress bar dei posti, hover card, empty state.
3. Se OK Salandra, proseguire con **Sessione 3** ([[Plan-Redesign-Incrementale]]): redesign `/evento/[id]` con mappa stalls eroe + Müller-Brockmann grid.
