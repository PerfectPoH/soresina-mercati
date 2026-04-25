---
tipo: feature-spec
stato: completata
assegnata-a: Antigravity
priorità: media
tags: [stripe, pagamenti, backend, api]
---

# Feature: Pagamento online con Stripe

## Obiettivo
Implementare il flusso di checkout con Stripe in modo che gli espositori possano pagare e confermare la prenotazione del posteggio durante gli eventi.

## Requisiti
- Integrazione con la dashboard di Stripe (Checkout Sessions).
- Un espositore, dopo aver selezionato la bancarella e compilato il form, viene reindirizzato al checkout di Stripe.
- Implementare un Webhook (`/api/webhooks/stripe/route.js`) per ascoltare l'evento `checkout.session.completed` e segnare la bancarella come `pagata/confermata` nel database Supabase.
- Aggiornare lo stato della prenotazione in tempo reale.

## Vincoli tecnici
- Le chiavi segrete di Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) non devono mai essere esposte lato client.
- L'aggiornamento su Supabase deve essere fatto tramite il webhook in modo sicuro.

## Criteri di accettazione
- [ ] L'utente riesce a completare il checkout in modalità Test.
- [ ] Il Webhook aggiorna il campo `status` della prenotazione in Supabase su `confermato` al termine del pagamento.
- [ ] Aggiunta libreria `stripe` al `package.json`.
- [ ] Documentazione webhook creata in `/04-Documentazione`.

---

*Vedi anche: [[Regole-Backend]] · [[Plan-Stripe-Recovery]] · [[backlog]] · [[Post-Review-Stripe-Fase1]] · [[Memoria-AI]]*
