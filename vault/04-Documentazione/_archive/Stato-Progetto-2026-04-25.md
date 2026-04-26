---
tipo: stato-progetto
progetto: soresina-mercati
data: 2026-04-25
agente: Antigravity
tags: [stato, completamento, roadmap, analisi]
---

# 📊 Stato di Avanzamento Progetto — Mercati Soresina
**Data analisi:** 25 Aprile 2026  
**Analista:** Antigravity (lettura codice + vault completo)

---

## 🎯 Completamento Globale: ~70%

> Stima basata su analisi diretta del codice sorgente, incrocio con `Roadmap-Master.md` e verifica delle feature realmente presenti nel repo.

---

## ✅ Cosa è completato e funzionante (in produzione o staging)

### Infrastruttura & DevOps (~95% completa)
- [x] **Hosting**: Vercel con deploy automatico su push (`main` → prod, `staging` → preview)
- [x] **Database**: Supabase PostgreSQL, due ambienti separati (prod `ddqwutxocznggfmrzzkw` + staging `yctfshlwgouhppadptgy`)
- [x] **CI/CD**: pipeline Vercel operativa
- [x] **Error tracking**: Sentry configurato con DSN su Vercel (prod + preview)
- [x] **Analytics**: Vercel Analytics montato in `layout.js`
- [x] **Security Headers**: CSP, HSTS, X-Frame-Options, Referrer-Policy configurati in `next.config.js`
- [x] **HTTPS**: redirect automatico in `middleware.js` (solo /admin per ora, BUG-008 in fix)
- [x] **Ambienti separati**: env vars split prod/preview su Vercel

### Frontend & UX (~85% completa)
- [x] **Homepage**: lista eventi con card, conteggio posteggi liberi/occupati, hero editoriale
- [x] **Pagina evento**: mappa interattiva Leaflet con posteggi (`/evento/[id]`)
- [x] **Mappa satellite**: `StallMapSatellite.jsx` + `StallMap.jsx` operativi
- [x] **Form prenotazione**: `BookingForm.jsx` con redirect a Stripe checkout
- [x] **Pagina conferma prenotazione**: `/prenotato/[id]` esistente
- [x] **Dark mode**: implementata con anti-FOUC script in `layout.js`
- [x] **Font**: Inter + Fraunces via `next/font` (GDPR-safe, no Google Fonts runtime)
- [x] **Accessibilità (a11y)**: skip-link, ARIA roles, label su input
- [x] **SEO**: metadata, viewport, OpenGraph, Twitter Card in `layout.js`
- [x] **Favicon / OG image**: presenti (`app/icon.svg`, `app/opengraph-image.js`)
- [x] **404 personalizzata**: `app/not-found.js`
- [x] **Pagina errore**: `app/error.js` + `app/global-error.js`
- [x] **Cookie banner**: `CookieBanner.jsx` presente
- [x] **Loading spinner**: `Spinner.jsx` presente
- [x] **Toast notifications**: `ToastProvider.jsx` presente
- [x] **Theme toggle**: `ThemeToggle.jsx` presente
- [ ] **Animazioni di transizione tra pagine** (Framer Motion già installato, ma non utilizzato per page transitions)
- [ ] **Logo Pro Loco Soresina** nell'header (usa testo per ora)
- [ ] **Feedback visivo real-time** quando un altro utente prenota (Realtime non attivato lato client)

### Autenticazione & Admin (~90% completa)
- [x] **Login admin**: `/admin/login` con Supabase Auth
- [x] **Protezione route /admin**: middleware verifica sessione + ruolo `admin` in tabella `vendors`
- [x] **Dashboard admin**: KPI, lista eventi, pannello prenotazioni con ricerca e filtro
- [x] **Creazione eventi**: form completo in `/admin/eventi/nuovo`
- [x] **Modifica eventi**: `AdminEventCard.jsx` con azioni inline
- [x] **Blocco manuale posteggio**: `AdminStallPanel.jsx` presente
- [x] **Audit log**: tabella `AuditLogTable.jsx` + pagina `/admin/audit`
- [x] **Statistiche**: `/admin/statistiche` con occupazione per evento, merce più prenotata, venditori fedeli
- [x] **Lista d'attesa**: `/admin/lista-attesa` + `WaitlistWidget.jsx`
- [x] **Privacy GDPR admin**: `/admin/privacy` con `RetentionActions.jsx`
- [x] **Registrazione vendor**: `/registrati` presente
- [x] **Profilo utente**: `/profilo` con cancellazione account (`DeleteAccountButton.jsx`)
- [ ] **Ricerca prenotazioni per nome** nella dashboard (BookingsPanel ha filtro ma limitato)
- [ ] **Stampa lista posteggi** (PrintButton.jsx presente ma da verificare completezza)
- [ ] **Notifica admin** per ogni pagamento ricevuto (email)

### Database & Backend (~80% completa)
- [x] **Schema PostgreSQL**: tabelle `vendors`, `events`, `stalls`, `bookings`, `waitlist`, `audit_log`, `stripe_events_seen`
- [x] **RLS**: attivo su tutte le tabelle
- [x] **Funzioni SECURITY DEFINER**: `is_admin()`, `stall_status_of()`, `stall_vendor_name()` (da ripristinare in schema.sql via BUG-002)
- [x] **API Routes**: `/api/book`, `/api/events`, `/api/stalls`, `/api/bookings`, `/api/account`, `/api/waitlist`, `/api/health`, `/api/admin`
- [x] **Rate limiting**: `lib/rate-limit.js` (in-memory, sufficiente per il volume Pro Loco)
- [x] **Validazione input server-side**: `lib/validate.js` con sanitizzazione XSS
- [x] **Webhook Stripe**: `/api/webhooks/stripe/route.js` con idempotency + service role
- [x] **Client Supabase**: browser, server, admin (service role) separati correttamente
- [x] **Realtime**: publication attiva su `bookings` e `stalls` (solo lato DB, non ancora consumata dal client)
- [ ] **Schema.sql consolidato**: BUG-002, in attesa di Fase 2
- [ ] **Cron GC pending bookings**: `pg_cron` da installare (BUG-006 fix parziale)

### Pagamenti Stripe (~65% completa)
- [x] **Checkout Session**: creazione in `book/route.js` con `status: pending`
- [x] **Webhook**: ricezione `completed` + `expired` + async payment events
- [x] **Idempotency**: tabella `stripe_events_seen` creata su prod e staging
- [x] **Rollback booking**: se Stripe fallisce, booking viene cancellato
- [x] **Lib supabase-admin**: client con service role per webhook
- [x] **Env vars Stripe su Vercel staging**: configurate (test keys) — BUG-004 risolto per staging
- [x] **Webhook endpoint Stripe staging**: registrato e funzionante
- [x] **Smoke test end-to-end**: ✅ VALIDATO (booking `244dc29f` → `confirmed` in 39s)
- [ ] **Live keys Stripe su Vercel Production**: richiede onboarding KYC Pro Loco
- [ ] **Gestione rimborsi**: non implementata
- [ ] **Ricevuta/fattura automatica**: non implementata
- [ ] **Partita IVA Pro Loco su Stripe**: da configurare con onboarding live

### GDPR & Legale (~70% completa)
- [x] **Privacy policy**: `/privacy` presente
- [x] **Cookie policy**: `/cookie` presente
- [x] **Termini e condizioni**: `/termini` presente
- [x] **Cookie banner**: conforme
- [x] **Diritto cancellazione GDPR**: `delete_my_account()` + UI in `/profilo`
- [x] **Anonymize old bookings**: funzione DB presente
- [x] **Audit log**: trigger su tutte le modifiche
- [ ] **Checkbox "accetto trattamento dati"** nel form di prenotazione: non trovata
- [ ] **Data retention policy automatica**: funzione presente ma non schedulata

---

## ❌ Cosa manca per la consegna alla Pro Loco (critico)

| Feature | Priorità | Effort stimato |
|---------|----------|----------------|
| **Stripe funzionante end-to-end** (env vars + smoke test) | 🔴 CRITICA | 1h (Opus) |
| **Email conferma prenotazione** al venditore (Resend) | 🔴 CRITICA | 4-6h |
| **Email notifica admin** per ogni pagamento | 🔴 CRITICA | 2h (integrata con sopra) |
| **Checkbox consenso GDPR** nel form prenotazione | 🔴 CRITICA | 1h |
| **Dominio personalizzato** (mercati-soresina.it o simile) | 🔴 CRITICA | 30min (configurazione DNS) |
| **Gestione concorrenza prenotazioni** (due utenti stessa bancarella) | 🟠 ALTA | 2h (unique constraint + UX error) |
| **Revalidazione pagina evento** dopo prenotazione (`revalidatePath`) | 🟠 ALTA | 30min |
| **Pagina successo post-prenotazione** con riepilogo completo | 🟠 ALTA | 2h |

---

## 🟡 Cosa è nice-to-have (post-consegna)

| Feature | Note |
|---------|------|
| **Realtime sync mappa** (Supabase Realtime lato client) | DB già pronto, manca il subscription nel componente |
| **Email promemoria** 3 giorni prima evento | Richiede job schedulato |
| **Gestione rimborsi** via Stripe | Richiede logica cancellazione |
| **Export CSV prenotazioni** | Admin operativo |
| **Logo Pro Loco** nell'header | Asset da richiedere alla Pro Loco |
| **Animazioni transizione pagine** | Framer Motion già installato |
| **Test E2E Playwright** | 3 flussi critici: signup, prenotazione, admin |
| **Refactor componenti monolitici** | StallMapSatellite, BookingForm |
| **Rate limiting su Redis** | Solo se multi-tenant o volumi alti |

---

## 🐛 Bug aperti post-fix Opus

**Zero bug critici aperti.** I bug aperti sono:

| ID | Severità | Note |
|----|----------|------|
| BUG-014 | 🟡 MEDIA | `debugLog()` hardcoded — da rimuovere (Codex) |
| BUG-015 | 🟠 ALTA | Prezzo `0` trattato come falsy → fallback a 35€ |
| BUG-016 | 🟠 ALTA | DELETE/PATCH non verificano righe toccate — silent fail |
| BUG-017 | 🟡 MEDIA | Coordinate mappa parziali accettate in PATCH eventi |
| TECH-DEBT-001 | ✅ | Roadmap-Master riallineata (25 apr sera) |
| TECH-DEBT-002 | 🟡 | Componenti monolitici (post-consegna) |
| TECH-DEBT-003 | 🟡 | Zero test automatizzati |
| TECH-DEBT-004 | 🟡 | Rate limit in-memory (ok per ora) |

---

## 📈 Completamento per area

```
Infrastruttura & DevOps   ████████████████████░  95%
Frontend & UX             ████████████████░░░░░  85%
Autenticazione & Admin    ████████████████████░  90%
Database & Backend        ████████████████░░░░░  80%
Pagamenti Stripe          █████████████░░░░░░░░  65%
GDPR & Legale             ██████████████░░░░░░░  70%
Email & Notifiche         ██░░░░░░░░░░░░░░░░░░░  10%
Test automatizzati        ░░░░░░░░░░░░░░░░░░░░░   0%
─────────────────────────────────────────────────
TOTALE STIMATO            ████████████████░░░░░  ~70%
```

---

## 🚀 Piano per arrivare al 90%+ (consegna Pro Loco)

1. **Salandra**: Onboarding Stripe live (KYC + IBAN + P.IVA) → sblocca merge staging→main → **+5%**
2. **Opus**: Email con Resend (conferma venditore + notifica admin) → **+8%**
3. **Opus**: Fix BUG-015/016 (business logic critica) → **+2%**
4. **Opus**: Checkbox GDPR nel form prenotazione → **+2%**
5. **Salandra**: Configurare dominio personalizzato → **+2%**

**Totale stimato post-sprint: ~89%** — pronto per consegna MVP alla Pro Loco.

Il restante 11% è composto da: test E2E, realtime sync, refactor componenti, rimborsi (nice-to-have, non bloccanti).

---

*Vedi anche: [[Roadmap-Master]] · [[backlog]] · [[Plan-Fix-Bugs-Antigravity]] · [[Plan-Stripe-Recovery]] · [[Protocollo-Collaborazione]]*
