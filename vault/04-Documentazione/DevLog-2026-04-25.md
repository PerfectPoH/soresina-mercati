---
tipo: devlog
data: 2026-04-25
agente: Antigravity
---

# DevLog: Unificazione Schema Database

## Cosa è stato fatto
- **Problema Risolto:** Il file originale `schema.sql` non conteneva la tabella `vendors` né le policy RLS (Row Level Security). Questo esponeva il database e rendeva inaffidabile il setup locale per nuovi sviluppatori, dato che le policy erano frammentate in 8 file diversi (`auth-migration.sql`, `gdpr-migration.sql`, ecc.).
- **Azione:** Tutti gli 8 file di migrazione sono stati eliminati. Il loro contenuto è stato fuso, ordinato e consolidato in un unico, massiccio file **`supabase/schema.sql`** (Source of Truth).
- **Nuovo Schema Include:**
  - Ordine di dipendenza corretto per le tabelle.
  - Attivazione rigorosa di `ENABLE ROW LEVEL SECURITY` ovunque.
  - Funzioni custom come `is_admin()`, l'audit trigger e i controlli GDPR.
  - Abilitazione di `supabase_realtime` per `bookings` e `stalls`.

## Prossimi Passi
- L'utente deve copiare il contenuto del nuovo `schema.sql` e lanciarlo nell'SQL Editor del pannello web di Supabase per applicare queste best practice al database di produzione.

---

*Vedi anche: [[backlog]] · [[Plan-Stripe-Recovery]] · [[Code-Review-Opus-vs-Antigravity]] · [[Memoria-AI]]*
