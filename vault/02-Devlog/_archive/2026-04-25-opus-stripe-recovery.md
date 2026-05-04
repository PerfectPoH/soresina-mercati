---
tipo: devlog
progetto: soresina-mercati
data: 2026-04-25
agente: Antigravity
---

# DevLog: Stripe Recovery

Questo documento traccia l'esecuzione del [[Plan-Stripe-Recovery]].

## Fase 1 — Fix codice (sintassi + webhook RLS)
**Stato: Completata ✅**

- `app/api/book/route.js`: Risolto l'errore di sintassi sull'import di `@/lib/validate`. Aggiunto check lazily caricato per inizializzare `Stripe` senza rompere la build se la var d'ambiente manca.
- `lib/supabase-admin.js`: Creato nuovo client server-only che utilizza `SUPABASE_SERVICE_ROLE_KEY` bypassando la RLS.
- `app/api/webhooks/stripe/route.js`: Riscritto usando `supabase-admin`, aggiunta idempotenza con check sulla tabella `stripe_events_seen`, e implementata gestione di `checkout.session.expired` per rimettere in gioco i posteggi pendenti o scaduti.

Il build locale non ha più errori su API e Route. L'errore isolato su `/opengraph-image` è un noto bug di `import.meta.url` su Next.js/Windows ed è svincolato da Stripe.

In attesa di approvazione per procedere con la Fase 2 (Schema riallineamento).
