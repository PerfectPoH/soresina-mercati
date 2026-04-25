---
tipo: regole
progetto: soresina-mercati
ultimo-aggiornamento: 2026-04-25
tags: [regole, backend, supabase, api, sicurezza]
---

# Regole Backend & Sicurezza

L'app utilizza un'architettura ibrida con Next.js (Route Handlers/Server Actions) e Supabase (DB/Auth).

## 1. Gestione Autenticazione (Supabase)
- Usa il pacchetto `@supabase/ssr` per gestire le sessioni in ambiente Next.js App Router (Middleware, Server Components, Client).
- La dashboard `/admin` deve essere protetta. Verifica il token di sessione di Supabase al livello di Middleware (`middleware.js`) o direttamente nei layout server-side.

## 2. Interazione con il Database
- **RLS (Row Level Security)**: Tutte le tabelle di Supabase devono avere policy RLS attive. L'accesso pubblico in lettura va consentito solo per dati sicuri (es. la lista eventi attivi), mentre scrittura o accesso a dati sensibili deve essere limitato ad utenti autenticati (admin).
- Usa le **Server Actions** di Next.js per la mutazione dei dati dal form verso Supabase, mantenendo la Service Role key o i token utente strettamente lato server.

## 3. API & Sicurezza
- Non esporre mai la `SUPABASE_SERVICE_ROLE_KEY` lato client.
- Esegui la validazione dell'input per tutti i dati in ingresso, sia per le prenotazioni che per il login admin.
- Integra Sentry per il logging delle eccezioni lato server.

## 4. Pagamenti (Stripe - Futuro)
- Gestisci la validazione dei webhook di Stripe in endpoint dedicati e protetti nei Route Handlers (`/app/api/webhooks/stripe/route.ts`), assicurandoti di verificare le signature in ingresso.

---

*Vedi anche: [[Architettura]] · [[Regole-Codice]] · [[Memoria-AI]] · [[backlog]] · [[pagamento-stripe]]*
