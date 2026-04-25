---
tipo: architettura
progetto: soresina-mercati
ultimo-aggiornamento: 2026-04-25
tags: [architettura, stack, database, supabase, nextjs]
---

# Architettura: Mercati Soresina — Pro Loco

## 1. Stack Tecnologico

- **Framework**: Next.js 14.1.0 (App Router)
- **Styling**: TailwindCSS
- **Animazioni**: Framer Motion
- **Mappe**: React Leaflet / Leaflet (per la mappa delle bancarelle)
- **Database & Auth**: Supabase (@supabase/ssr, @supabase/supabase-js)
- **Monitoraggio/Errori**: Sentry
- **Analytics**: Vercel Analytics
- **Hosting**: Vercel

## 2. Architettura Frontend (UI)

- Utilizzo dell'App Router (`/app`) per il routing.
- Pagine principali previste:
  - `/` -> Eventi pubblici.
  - `/evento/[id]` -> Mappa dinamica bancarelle e form di prenotazione.
  - `/admin` -> Dashboard privata per la Pro Loco.

## 3. Architettura Backend & Database

Basato interamente su Supabase:
- **Autenticazione**: Supabase Auth (pianificata per l'admin).
- **Database**: PostgreSQL (gestito da Supabase).
- **Integrazioni future**: Pagamenti online tramite Stripe.

## 4. Decisioni Tecniche Chiave

- **SSR/SSG**: Utilizzo di Next.js App Router per ottimizzare SEO (eventi pubblici) e fornire dashboard protette.
- **Gestione Mappa**: Uso di React Leaflet per rappresentare visivamente la planimetria del mercato, per permettere la selezione interattiva dei posteggi.

---

*Vedi anche: [[Regole-Codice]] · [[Regole-Backend]] · [[Roadmap-Master]] · [[Memoria-AI]]*
