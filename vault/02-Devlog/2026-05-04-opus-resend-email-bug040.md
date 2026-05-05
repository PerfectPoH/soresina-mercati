---
tipo: devlog
data: 2026-05-04
agente: opus
topic: resend-email-transazionali-bug040
---

# Sessione — Resend onboarding + email transazionali (BUG-040 chiuso)

## Contesto
Salandra ha creato l'account Resend e fornito API key. Implementiamo le 3 email critiche: conferma prenotazione, annullamento admin, promozione waitlist.

## Cosa ho fatto

### 1. Setup `lib/email.js` (wrapper Resend)
- Singleton lazy: se `RESEND_API_KEY` manca al build (es. preview senza env), il modulo non esplode.
- `sendEmail({ to, subject, html, text?, replyTo? })` returns `{ ok, id?, error? }` — fail-safe: niente throw.
- Plain-text fallback automatico via `htmlToText()` semplice (regex strip tag, decode entities base).
- Default mittente: `Pro Loco Soresina <onboarding@resend.dev>` (testing). Override via `RESEND_FROM_EMAIL`.

### 2. Templates `lib/email-templates.js` (3 critiche)
JSX-to-string inline con shell condivisa:
- Layout 600px centrato, palette warm (cream-50 background, white card, amber CTA).
- Header con logo "Pro Loco Soresina" + kicker uppercase.
- Footer con link privacy/cookie/termini.
- Preheader hidden per anteprima inbox.
- System fonts (-apple-system, Segoe UI, Roboto…) per compat Outlook.
- Plain-text fallback ben strutturato.

**Email 1 — `bookingConfirmedEmail`** (post Stripe success): titolo Fraunces serif "Prenotazione confermata.", riepilogo data/luogo/posteggio/costo/codice, CTA "Vedi prenotazione".

**Email 2 — `bookingCancelledByAdminEmail`** (admin cancel con/senza rimborso): badge "RIMBORSO EMESSO" verde o "SENZA RIMBORSO" rosso, motivo in italic, CTA "Vedi dettagli".

**Email 3 — `waitlistPromotedEmail`** (waitlist promotion 24h): badge ambra "Hai 24 ore", titolo "Si e' liberato un posto.", CTA dinamica ("Conferma prenotazione" se gratuito, "Completa il pagamento" se paid).

### 3. Hook negli endpoint
- **`app/api/webhooks/stripe/route.js`** `handleCheckoutCompleted`: l'UPDATE pending→confirmed ora ha `.select(...).maybeSingle()` per idempotency (no doppio invio email su retry Stripe). Se il return e' null (booking gia' confermato), skip email.
- **`app/api/admin/bookings/[id]/cancel/route.js`**: dopo UPDATE invia email all'utente (motivo + rimborso). Se la cancellazione promuove un utente da waitlist, invia ANCHE l'email "si e' liberato un posto" al promosso.
- **`app/api/admin/waitlist/[id]/promote/route.js`** (promote manuale admin): invia email "si e' liberato un posto" al promosso dopo creazione del booking pending.

### 4. `.env.local.example`
Aggiunta sezione Resend con istruzioni complete (signup, dominio verifica, API key separati prod/preview, mittenti, reply-to).

## Verifiche
- `node --check` su tutti i file → SYNTAX_OK.
- `npm run lint` → no warnings/errors.
- `npm install resend` → 58 packages added (resend@6.12.2).

## Lezioni applicate
- **Email fail-safe nei webhook**: invio email NON deve rollare back state DB. Logghiamo via `safeLogError` ma non throw.
- **Idempotency per email**: dopo UPDATE critico (pending→confirmed) usare `.select(...).maybeSingle()` per detection del "no row updated" → skip email. Coerente con la deduplica su `stripe_events_seen`.
- **Lazy init del client**: niente `new Resend()` top-level. Se la key manca, il modulo non esplode all'import.
- **Plain-text fallback**: utile per spam filter (alcuni penalizzano email senza text/plain).

## Files toccati
- `lib/email.js` (nuovo, ~95 righe).
- `lib/email-templates.js` (nuovo, ~285 righe).
- `app/api/webhooks/stripe/route.js` (import + idempotent select + send email).
- `app/api/admin/bookings/[id]/cancel/route.js` (import + select extended + 2 email send: cancel + promoted).
- `app/api/admin/waitlist/[id]/promote/route.js` (import + send email post-promote).
- `.env.local.example` (sezione Resend con istruzioni).
- `package.json` + `package-lock.json` (resend@6.12.2).
- `vault/00-Progetto/Memoria-AI.md` (lezione email fail-safe).
- `vault/03-Bug/backlog.md` (BUG-040 chiuso).

## Note importanti per Salandra

⚠️ **Sicurezza API key**: la chiave incollata in chat va REVOCATA su https://resend.com/api-keys e sostituita con una nuova.

⚠️ **Dominio Resend**: per inviare email a destinatari diversi dal proprio account Resend, va verificato un dominio (DNS records SPF + DKIM + DMARC). Finche' il dominio non e' verificato, **le email partiranno solo verso barakatabed687@gmail.com** (limite 100/day di `onboarding@resend.dev`).

### Setup deploy
1. **Locale (`.env.local`)**: copia da `.env.local.example` e inserisci `RESEND_API_KEY=re_...` (chiave nuova!). Per testing lascia vuoto `RESEND_FROM_EMAIL` (usa onboarding@resend.dev).
2. **Vercel** (Settings → Environment Variables): aggiungi `RESEND_API_KEY` per Production E Preview separatamente. Quando hai dominio verificato aggiungi anche `RESEND_FROM_EMAIL` e `RESEND_REPLY_TO`.
3. **Smoke test**:
   - Fai una prenotazione test → verifica arrivo email "Prenotazione confermata" al tuo indirizzo.
   - Annulla la prenotazione da admin con motivo + rimborso → verifica email "Annullata · Rimborso emesso".
   - Iscriviti a waitlist su evento pieno, libera un posto da admin → verifica email "Si e' liberato un posto".

## Note per la prossima sessione
- Verifica dominio Resend (Salandra-side, fuori scope codice).
- Quando il dominio e' verde, aggiorna `RESEND_FROM_EMAIL` su Vercel.
- Eventuali email aggiuntive non implementate in questa sessione: cancellazione utente approvata, scadenza waitlist 24h (cron). Possono andare in sessione successiva su richiesta.
