---
tipo: plan
progetto: soresina-mercati
agente: Antigravity
data: 2026-04-25
priorita: ALTA
stato: APPROVATO ✅
tags: [security, bugfix, stripe, database, rls]
---

# Plan: Fix Nuovi Bug (Analisi Antigravity) & Fase 2 Stripe

> **Azione delegata a: Claude Opus (Executor)**
> Nota per Opus: Salandra ha dato approvazione automatica a questo piano. Puoi procedere immediatamente con l'esecuzione.

## Contesto

In seguito alla lettura dei log e all'analisi del branch `staging` contenente il tuo commit `12521ed` (Fase 1 Stripe Recovery), ho validato il tuo lavoro e individuato ulteriori vulnerabilità. Seguendo il [[Protocollo-Collaborazione]], in quanto *Architect/Reviewer*, delego a te la stesura del codice e i commit per le seguenti fix.

## 1. Security Misconfiguration (BUG-008 & BUG-007)

### 1.1 Middleware limitato ad admin
Il `middleware.js` esegue un redirect fondamentale (HTTP -> HTTPS) che attualmente viene applicato solo alla route `/admin` a causa del `matcher`.
**Azione:** Aggiorna `middleware.js` sostituendo l'export in fondo con:
```javascript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### 1.2 Secret Leak in Obsidian (BUG-007)
Il file `data.json` del plugin REST API contiene chiavi private ed è tracciato da Git.
**Azione:** 
1. Aggiungi `vault/.obsidian/plugins/obsidian-local-rest-api/data.json` al file `.gitignore`.
2. Esegui `git rm --cached vault/.obsidian/plugins/obsidian-local-rest-api/data.json` per rimuoverlo dal repository senza cancellarlo in locale dal disco di Salandra.

## 2. Refactoring (BUG-009)

### 2.1 ES Module Import in `lib/rate-limit.js`
A riga 70 c'è un import di `NextResponse`.
**Azione:** Sposta `import { NextResponse } from 'next/server'` in cima al file, ad esempio a riga 17, sotto i commenti.

## 3. Stripe Recovery (Fasi 2 e Completamento GC)

### 3.1 Consolidamento DB (`schema.sql` e archivio) - BUG-002
Riprendiamo la Fase 2 del tuo piano originario.
**Azione:**
1. Sposta le 8 migrazioni storiche in `supabase/migrations-archive/`.
2. Usando Supabase MCP (su staging o prod), esegui un dump completo dello schema per ricreare `supabase/schema.sql` affinché contenga tutte le colonne reali (es. `lat`, `lng`, `image_url`), le funzioni (`stall_status_of`, ecc.) e la nuova `stripe_events_seen`.

### 3.2 Garbage Collection Bookings Pending (BUG-006 correlato)
Hai aggiunto il rollback su fail di Stripe, ma serve un GC periodico per chi abbandona la pagina senza pagare.
**Azione:**
Crea una nuova migration `supabase/migrations/14_stripe_gc.sql` per schedulare la pulizia su DB:
```sql
create extension if not exists pg_cron;
select cron.schedule(
  'stripe-gc-pending-bookings',
  '*/5 * * * *',
  $$ delete from bookings where status = 'pending' and created_at < now() - interval '15 minutes' $$
);
```
*(Se preferisci usare una Edge Function triggerata via cron invece di `pg_cron` per ragioni di costo/limiti, sentiti libero di modificare l'approccio)*.

## 4. Deploy & Merge

Dopo aver applicato queste correzioni sul branch `staging`:
1. Crea un devlog.
2. Committa con messaggi convenzionali (es. `fix(security): expand middleware matcher scope`).
3. Gestisci autonomamente anche **BUG-004** (env vars Stripe su Vercel) e **BUG-010** (SITE_URL Supabase Auth su staging) — Salandra ha confermato che hai pieno accesso e puoi procedere in autonomia.
4. Notifica Salandra quando il branch `staging` è pronto per il testing end-to-end.

---

## ✅ Approvazione Salandra

> **Data**: 2026-04-25T19:13 (ora locale)
> **Approvazione**: Esplicita in chat — "do l'ok ad opus"
> **Nota**: Opus ha pieno accesso e può gestire autonomamente anche BUG-004 (env Vercel) e BUG-010 (SITE_URL Supabase staging), senza ulteriore intervento di Salandra.
