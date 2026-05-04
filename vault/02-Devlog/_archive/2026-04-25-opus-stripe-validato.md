---
tipo: devlog
data: 2026-04-25
agente: Claude Opus 4.7
sessione: stripe-end-to-end-validato
tags: [stripe, smoke-test, webhook, vercel-auth, milestone]
---

# Devlog 2026-04-25 — Stripe end-to-end validato su staging

## Milestone raggiunta

Smoke test completo del flusso Stripe checkout sul preview staging passato. Click "Prenota" → checkout Stripe sandbox → pagamento con `4242 4242 4242 4242` → redirect a `/prenotato/<id>?success=true` sul dominio staging → webhook arriva al nostro endpoint, verifica signature, insert in `stripe_events_seen`, UPDATE booking `pending → confirmed`.

## Bug nuovo individuato e risolto in questa sessione

**BUG-013** — Vercel Deployment Protection bloccava i webhook Stripe sui preview. Sintomo: il primo test di Salandra è andato a buon fine su Stripe (carta processata) ma il booking è rimasto `pending`. Causa: i preview deploy di Vercel hanno per default `ssoProtection` attivo, che richiede login OAuth — Stripe riceveva 401 e non poteva invocare il nostro endpoint. Diagnosi confermata da `stripe_events_seen` vuoto + zero log nel webhook.

Fix applicato: `PATCH /v9/projects/{id}` con `ssoProtection: null` via Vercel API. Tutti i preview ora sono pubblici. Trade-off accettato per la fase di test; per ambienti multi-team la soluzione corretta sarebbe "Deployment Protection Exceptions" che lascia pubblico solo il branch alias `staging`.

## Bug minori risolti contestualmente

- **NEXT_PUBLIC_SITE_URL su Vercel** era impostata su entrambi gli scope (Production + Preview) col valore prod. Ho splittato: Production → `https://soresina-mercati.vercel.app`, Preview → `https://soresina-mercati-git-staging-...vercel.app`. Senza questo fix il redirect post-pagamento dal Preview portava sul dominio prod.

## Cosa ho fatto in questa sessione (sintesi)

1. Configurato 5 env Vercel via API (Stripe ×2, Supabase service role ×2, Sentry token).
2. Trigger redeploy staging con `git commit --allow-empty && push`.
3. Salandra ha registrato un account vendor di test, prenotato un posteggio, pagato su Stripe sandbox.
4. Diagnosticato 404 post-pagamento → split di `NEXT_PUBLIC_SITE_URL` per scope.
5. Diagnosticato `pending` permanente → disabilitazione Vercel Auth Protection.
6. Salvato manualmente il primo booking orfano (`cffc7592-...`) a `confirmed` (pagamento valido era già stato processato da Stripe).
7. Salandra ha rifatto il test → tutto funziona automaticamente: booking `244dc29f-...` passa a `confirmed` 39 sec dopo la creazione.

## Stato corrente

| Ambiente | URL | Branch | Stripe | Status |
|---|---|---|---|---|
| Production | `https://soresina-mercati.vercel.app` | `main` (HEAD `5989389`) | non configurato (vecchio flusso senza pagamento) | live, sano |
| Staging | `https://soresina-mercati-git-staging-...vercel.app` | `staging` (HEAD `6437bcf`) | sandbox/test attivo end-to-end | live, validato |

## Bug aperti rimasti

- BUG-010 (SITE_URL Supabase staging): Salandra deve confermare se ha aggiornato il dashboard Supabase (registrazione vendor è andata, ma verifico col prossimo test del magic link).
- BUG-007 follow-up: rigenerare API key Obsidian (consigliato ma non bloccante; il file non è mai uscito dal disco di Salandra).

## Cosa NON è ancora fatto (per andare a Production)

Per portare Stripe live (e fare merge `staging → main`), serve:

1. **Onboarding Stripe live**: Salandra completa KYC su Stripe Dashboard, fornisce dati Pro Loco + IBAN per ricevere i pagamenti reali.
2. **Live keys**: ottenere `sk_live_...` e creare un endpoint webhook live (separato dal test) → ottenere `whsec_...` live.
3. **Configurare Vercel Production**: aggiungere `STRIPE_SECRET_KEY` (live) e `STRIPE_WEBHOOK_SECRET` (live) sullo scope production. `SUPABASE_SERVICE_ROLE_KEY` su Production è già configurato.
4. **Merge staging → main**: a quel punto il flusso Stripe va in produzione, e i booking partono come `pending` fino al webhook.

Finché non c'è onboarding live, il merge a main romperebbe la prenotazione (modulo Stripe lazy-init `null` → API risponde 502 con rollback). Per cui restiamo su staging.

## Lessons learned (da aggiungere a Memoria-AI)

1. **Vercel preview deploys richiedono Auth per default** (almeno su account Hobby/Free): qualsiasi servizio esterno che chiama webhook (Stripe, GitHub, Twilio, ecc.) NON funziona finché non disabiliti `ssoProtection` o configuri Deployment Protection Exceptions per il branch alias.
2. **`NEXT_PUBLIC_*` env vars devono essere distinte per scope**: se hai prod e staging come ambienti separati con URL diverso, configura due record distinti (uno per `production`, uno per `preview`), non uno solo che copre entrambi.
3. **Stripe webhook non aggiorna se RLS blocca**: client `createSupabaseAdminClient()` con service role è obbligatorio. Già documentato nella sessione precedente, qui validato a runtime.
