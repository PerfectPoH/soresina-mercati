---
tipo: action-plan
target: claude-opus-4.7
progetto: soresina-mercati
data: 2026-04-25
tags: [architecture, planning, to-do, security]
---

# Opus Action Plan: Analisi e Migliorie Architetturali

> **Note per Claude Opus 4.7:**
> Questo documento è stato generato da Antigravity (Gemini) dopo un audit della codebase. Contiene la roadmap tecnica, le falle architetturali individuate e le proposte per i prossimi sprint. Quando ti viene assegnato un task, fai riferimento a questo file per capire il contesto e il debito tecnico in sospeso.

## 1. Contesto Architetturale

L'applicazione è sviluppata con:
- **Frontend**: Next.js 14.1.0 (App Router), React 18, TailwindCSS.
- **Backend**: Route Handlers e Server Actions in `/app/api`.
- **Database e Auth**: Supabase SSR (`@supabase/ssr`) per autenticazione (cookie-based) e database relazionale PostgreSQL.
- **Integrazioni**: Stripe (appena configurato in test), Leaflet (mappe degli eventi), Sentry (error tracking).

### Gestione Sicurezza Attuale
- Content Security Policy (CSP) e Security Headers molto restrittivi (configurati in `next.config.js`). Ottimo livello.
- Autenticazione e rotte private gestite via middleware (`middleware.js`).

---

## 2. Vulnerabilità, Falle e Debito Tecnico (Da Risolvere)

### A. Schema DB Incompleto (`supabase/schema.sql`)
**Problema:** Il file `schema.sql` (che di solito funge da source of truth per il bootstrap locale) è incompleto. Manca la definizione della tabella `vendors` e mancano del tutto le attivazioni della *Row Level Security* (RLS). Tutto questo è frammentato nei file in `supabase/*-migration.sql`.
**Azione per Claude:** Ricompattare l'ultimo stato del DB. Esegui il dump del database di produzione o fai un merge manuale di tutti i file SQL in un unico `schema.sql` robusto per garantire che chi fa setup in locale non esponga le API anonime al mondo.

### B. Componenti UI Monolitici
**Problema:** `components/StallMapSatellite.jsx` (20KB) e `components/BookingForm.jsx` (10KB) sono troppo complessi. Violano il principio di singola responsabilità.
**Azione per Claude:** Refactoring. Isola la logica di fetching e la UI pura in hook custom e sub-componenti (es. `BookingFormFields.jsx`, `StallTooltip.jsx`).

### C. Rate Limiting "Illusorio"
**Problema:** In `lib/rate-limit.js` il rate limit è implementato con una mappa in memoria. Dato che Next.js è deployato su Vercel (Serverless), ogni funzione isolata ha la propria memoria. Un attaccante può aggirare il limite colpendo edge node differenti.
**Azione per Claude:** Sostituire la logica in memory con un database KV distribuito (es. **Vercel KV / Upstash Redis**) e spostare il check direttamente nel `middleware.js` per bloccare le richieste spam prima che istanzino i Route Handlers.

### D. Assenza di Testing
**Problema:** Non esiste infrastruttura di test (E2E o Unit).
**Azione per Claude:** Installare e configurare **Playwright** per i flussi critici (Login Admin e Checkout Stripe) e **Vitest** per funzioni pure come `lib/validate.js`.

---

## 3. Idee e Proposte (Next Level Features)

### 🚀 1. Sincronizzazione Mappe in Tempo Reale (Supabase Realtime)
**Idea:** In un'app di prenotazione posti fisici, due utenti potrebbero cliccare la stessa bancarella.
**Implementazione:** Attivare Supabase Realtime sulla tabella `bookings`. Nel componente `StallMapSatellite`, iscriverti al canale. Quando una bancarella passa in `status: 'pending'` o `status: 'confirmed'`, aggiornare il colore del rettangolo (Leaflet) a tutti i client connessi all'istante, senza ricaricare la pagina.

### 🗑️ 2. Garbage Collection dei Carrelli Abbandonati
**Idea:** Attualmente una prenotazione va in `pending` quando inizia il checkout Stripe. Se l'utente chiude la finestra, il posteggio rimane bloccato per sempre.
**Implementazione:** Scrivere una **Edge Function in Supabase** triggerata da `pg_cron` ogni 5 minuti: `DELETE FROM bookings WHERE status = 'pending' AND created_at < NOW() - INTERVAL '15 minutes'`.

### ✉️ 3. Notifiche Transazionali con Resend
**Idea:** Al completamento del checkout Stripe, nessuno viene avvisato (a parte lo stato nel DB).
**Implementazione:** Nel webhook `app/api/webhooks/stripe/route.js`, integrare le API di **Resend** (o SendGrid) per inviare:
1. Una email di ricevuta e biglietto virtuale all'espositore.
2. Una notifica alla dashboard della Pro Loco.

---

> **Opus, the stage is yours:**
> Leggi questo documento e il file [[Roadmap]]. Coordinati con l'utente per scegliere quale vulnerabilità sanare o quale proposta implementare per prima!
