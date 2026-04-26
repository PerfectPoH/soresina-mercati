---
tipo: roadmap
progetto: soresina-mercati
ultimo-aggiornamento: 2026-04-25
tags: [roadmap, pianificazione]
---

# Roadmap & Backlog

Questa è la roadmap ufficiale estrapolata dal README originario, ordinata per priorità suggerita.

## Priorità Alta (Core System)
- [x] **Autenticazione Admin (Supabase Auth)**
  - Implementazione login per la Pro Loco.
  - Protezione della rotta `/admin`.
- [x] **Creazione eventi dall'admin**
  - CRUD (Create, Read, Update, Delete) per gli eventi dei mercati.

## Priorità Media (Business Logic & UX)
- [x] **Pagamento online con Stripe**
  - Flusso di acquisto/prenotazione del posteggio da parte degli espositori.
- [ ] **Notifica email/SMS alla prenotazione**
  - Invio di ricevuta e conferma tramite provider (es. Resend per le email).

## Priorità Bassa (Gestione Operativa)
- [ ] **Cancellazione prenotazioni**
  - Flusso admin e utente per annullare e (eventualmente) rimborsare.
- [ ] **Export CSV delle prenotazioni**
  - Generazione di liste per controlli fisici in piazza.

---

*Vedi anche: [[Roadmap-Master]] · [[backlog]] · [[Stato-Progetto-2026-04-25]] · [[Architettura]]*
