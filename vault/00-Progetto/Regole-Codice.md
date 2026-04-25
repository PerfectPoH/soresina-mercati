---
tipo: regole
progetto: soresina-mercati
ultimo-aggiornamento: 2026-04-25
tags: [regole, frontend, nextjs, react, tailwind]
---

# Regole di Codice: Frontend & Core

Queste regole definiscono lo standard di sviluppo per l'applicazione React/Next.js.

## 1. Struttura dei Componenti
- Usa componenti funzionali e Hooks.
- I componenti UI riutilizzabili vanno in `/components/ui/` (se si usa un pattern tipo shadcn) o `/components/`.
- Mantieni i componenti piccoli e focalizzati su una singola responsabilità.

## 2. Styling (TailwindCSS)
- Usa esclusivamente classi utility di Tailwind. Non creare file `.css` custom se non strettamente necessario (es. index.css globale).
- Assicurati che l'UI rispetti un design moderno e pulito, con feedback visivi (hover state) usando `framer-motion` per micro-animazioni.

## 3. Next.js App Router
- Usa **Server Components** di default.
- Usa `'use client'` solo quando necessiti di interattività (Hooks di stato/effetto, event listeners).
- Gestisci il data fetching principalmente dal lato server (es. in `page.tsx`) passandolo come props ai client components.

## 4. Mappe (Leaflet)
- Isola la logica della mappa in componenti dedicati (es. `<MapComponent />`), disabilitando il SSR tramite caricamento dinamico di Next.js se sorgono conflitti con l'oggetto `window` di Leaflet.

## 5. Pattern Vietati
- Evita prop drilling profondo (valuta Zustand o React Context se necessario, al momento non presenti in dipendenze).
- Non ignorare gli errori Sentry in produzione.

---

*Vedi anche: [[Architettura]] · [[Regole-Backend]] · [[Memoria-AI]] · [[Protocollo-Collaborazione]]*
