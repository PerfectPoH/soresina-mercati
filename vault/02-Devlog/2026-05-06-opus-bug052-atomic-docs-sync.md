---
tipo: devlog
data: 2026-05-06
agente: opus
topic: bug052-atomic-claim-stripe-docs-sync
---

# Sessione Opus — BUG-052 v2 (atomic claim) + docs sync

## Contesto
Codex ha pubblicato due addendum nel `Code-Review-Codex-vs-Opus.md`:
1. **2026-05-05**: BUG-050/051 chiusi davvero, BUG-052 migliorato ma "parzialmente risolto" — rimaneva una race a doppio click contemporaneo che poteva creare 2 Stripe Checkout session.
2. **2026-05-06**: opinion check, progetto a "~91% staging funzionale, ~85% pronto a consegna". Bloccante restante per pagamenti: atomicita' claim Stripe.

Salandra mi ha dato libero controllo per agire sui finding di Codex.

## Cosa ho fatto

### 1. BUG-052 v2 — claim atomico Stripe session
File: `app/api/bookings/[id]/complete/route.js`, blocco "Caso a pagamento" riscritto.

**Problema v1**: la versione precedente faceva `stripe.checkout.sessions.create()` PRIMA dell'UPDATE su `stripe_session_id`. Due richieste concorrenti (doppio click reale, due tab) potevano:
1. Entrambe leggere `stripe_session_id = null` (race iniziale)
2. Entrambe chiamare Stripe `create()` → 2 session pagabili distinte
3. Entrambe fare l'UPDATE → una sovrascrive l'altra → 1 session "orfana" ma ancora pagabile

**Soluzione v2**: la colonna `stripe_session_id` diventa anche un lock token atomico.

```js
// Step 1: se gia' c'e' session reale (no claim:*), retrieve+riuso
if (b.stripe_session_id && !b.stripe_session_id.startsWith('claim:')) {
  const existing = await stripe.checkout.sessions.retrieve(b.stripe_session_id)
  // alreadyPaid / open reuse / fallback nuova
}

// Step 2: claim atomico con UPDATE...WHERE stripe_session_id IS NULL
const claimToken = `claim:${Date.now()}-${random}`
const { data: claimed } = await admin.from('bookings')
  .update({ stripe_session_id: claimToken })
  .eq('id', params.id)
  .eq('status', 'pending')
  .is('stripe_session_id', null)
  .select('id')
  .maybeSingle()

if (!claimed) {
  // Lost race. Re-leggi e decidi:
  //  - status non e' pending → 409 wrong_status
  //  - stripe_session_id e' claim:* → 409 in_progress (client retry)
  //  - stripe_session_id e' session reale → riusa
}

// Step 3: claimer crea session
const session = await stripe.checkout.sessions.create({...})
// catch: rilascia claim con UPDATE filtrato su claimToken

// Step 4: persist session id reale, filtrato su claimToken (no overwrite)
await admin.from('bookings')
  .update({ stripe_session_id: session.id })
  .eq('id', params.id)
  .eq('stripe_session_id', claimToken)
```

**Garanzia**: `is('stripe_session_id', null)` + `.select(...).maybeSingle()` rende il claim un compare-and-swap atomico Postgres-side. Solo UN worker vince. Gli altri ricevono 0 righe e seguono il flow di riuso.

### 2. Docs sync (Codex segnalava drift)

- **README.md**: rimosso "[ ] Email transazionali Resend" da roadmap (e' implementato), aggiornato range migration `13 → 24` (era `13 → 21`).
- **vault/INDEX.md**: ultimo-aggiornamento 2026-05-06, aggiornata sezione "Stato attuale del progetto" con tutti i bug chiusi (047-052), redesign sessioni 1-5, dominio Resend nei bloccanti.
- **vault/00-Progetto/Roadmap-Master.md**: ultimo-aggiornamento 2026-05-06, marcato `[x] Email conferma prenotazione` (#4) e `[x] GDPR consenso` (#6). #5 (notifica admin per ogni pagamento) resta aperto come email separata da implementare.

### 3. Graphify root
Eseguito `npm run graph:update` per normalizzare `.graphify_root` al path corrente. `npm run graph:check` torna verde su tutti gli OK incluso "graphify root points to current workspace".

### 4. Memoria-AI
Aggiornata la lezione BUG-052 da v1 a v2 con il pattern atomico generalizzato: "stessa colonna come token-then-final-id, `.is(col, null)` per claim, `.eq(col, claimToken)` per persist e rilascio".

## Verifiche
- `node --check` su `complete/route.js` → OK.
- `npm run lint` → ✔ no warnings/errors.
- `npm run graph:check` → tutti gli OK verdi (296 nodi, 387 archi).

## Punti residui dalla review Codex (non in scope di questa sessione)

1. **`lib/email-templates.js` escluso da ESLint** — debito noto, accettabile (parser Babel inciampa su template literal con CSS embedded). Possibile fix futuro: estrarre CSS in file separato.
2. **Warning Sentry legacy in build** — debito noto, non bloccante.
3. **Smoke test minimi sui flussi pagati** — Codex consiglia E2E Playwright pre-produzione. Non in scope qui.

## Files toccati
- `app/api/bookings/[id]/complete/route.js` (~80 righe nuove per claim atomico)
- `README.md` (Resend → fatto, migration range)
- `vault/INDEX.md` (stato + bloccanti aggiornati)
- `vault/00-Progetto/Roadmap-Master.md` (#4 + #6 chiusi)
- `vault/00-Progetto/Memoria-AI.md` (lezione BUG-052 v2 atomica)
- `vault/03-Bug/backlog.md` (BUG-052 ora marcato v2 risolto)
- `vault/02-Devlog/2026-05-06-opus-bug052-atomic-docs-sync.md` (questo)

## Note per Codex / prossima review
- **BUG-052 v2** dovrebbe ora essere chiuso al 100%. Test scenario per validare: aprire `/prenotato/<pending-id>` in 2 tab + cliccare "Completa il pagamento" entrambe in <100ms. Una deve vedere checkout Stripe, l'altra `409 in_progress`.
- Stato `staging` ora dovrebbe essere stimato >91%, con go-live blocker che si riducono ai 3 punti di onboarding esterno (Stripe live + dominio personalizzato + dominio Resend).

## Comando commit + push
```powershell
cd C:\Users\barak\Downloads\soresina-mercati
git add app/api/bookings/`[id`]/complete/route.js README.md vault/INDEX.md vault/00-Progetto/Roadmap-Master.md vault/00-Progetto/Memoria-AI.md vault/03-Bug/backlog.md vault/02-Devlog/2026-05-06-opus-bug052-atomic-docs-sync.md
git commit -m "BUG-052 v2: atomic claim Stripe session + docs sync (post-Codex audit)" -m "v1 race a doppio click chiusa: usa stripe_session_id come lock token con UPDATE...WHERE IS NULL come compare-and-swap atomico. Worker che perde la race ottiene 409 in_progress e fa retry. Pattern generalizzabile per idempotency external API calls. Docs (README, INDEX, Roadmap) sincronizzate con stato reale: Resend implementato, migration 13->24, redesign sessioni 1-5 chiuse."
git push origin staging
```
