---
tipo: roadmap-master
progetto: soresina-mercati
data: 2026-04-25
ultimo-aggiornamento: 2026-04-25T23:25
tags: [roadmap, checklist, sprint, obiettivi]
---

# 🗺️ Master Roadmap & Checklist (Pro Loco)

> **Ultimo riallineamento**: 25 aprile 2026 (Antigravity). I task [x] sono verificati nel codice e nei devlog di Opus.

---

## 🎯 Prossimi Obiettivi — Sprint Pro Loco

### 🔴 Bloccanti per la consegna
| # | Obiettivo | Chi | Effort |
|---|-----------|-----|--------|
| 1 | **Onboarding Stripe live** (KYC + IBAN + P.IVA Pro Loco) | Salandra | 1-2h |
| 2 | **Live keys Stripe** → Vercel Production | Opus | 15min |
| 3 | **Merge staging → main** | Opus | 10min |
| 4 | **Email conferma prenotazione** al venditore (Resend) | Opus | 4-6h |
| 5 | **Email notifica admin** per ogni pagamento | Opus | 2h |
| 6 | **Checkbox consenso GDPR** nel form prenotazione | Opus | 1h |
| 7 | **Dominio personalizzato** (mercati-soresina.it) | Salandra | 30min |

### 🟠 Alta priorità (post-merge)
| # | Obiettivo | Effort |
|---|-----------|--------|
| 8 | Fix BUG-015: prezzo 0 non supportato (\|\| → ??) | 15min |
| 9 | Fix BUG-016: DELETE/PATCH non verificano righe toccate | 1h |
| 10 | Fix BUG-014: rimuovere debugLog() hardcoded | 30min |
| 11 | Fix BUG-017: coordinate mappa parziali in PATCH eventi | 30min |
| 12 | evalidatePath dopo prenotazione | 30min |
| 13 | UX errore concorrenza (posteggio già preso) | 2h |

### 🟡 Nice-to-have (post-consegna)
| # | Obiettivo | Effort |
|---|-----------|--------|
| 14 | Realtime sync mappa (Supabase Realtime lato client) | 2h |
| 15 | Test E2E Playwright (3 flussi critici) | 4h |
| 16 | Refactor componenti monolitici (StallMap, BookingForm) | 4h |
| 17 | Rate limiting Redis (Vercel KV / Upstash) | 2h |
| 18 | Gestione rimborsi via Stripe | 4h |

---

## 🛡️ Sicurezza
- [x] **Rate limiting sulle API** — in-memory, sufficiente per volumi Pro Loco (lib/rate-limit.js)
- [x] **Validazione input server-side** — lib/validate.js con sanitizzazione XSS
- [/] **Protezione doppia prenotazione** — constraint unique ookings_one_confirmed_per_stall attivo; manca UX feedback real-time → vedi obiettivo #13
- [x] **HTTPS obbligatorio** — middleware esteso a tutto il sito (commit 7cc6866)
- [x] **Variabili d'ambiente MAI esposte lato client** — service_role key solo server
- [x] **RLS (Row Level Security)** — abilitato e schema consolidato (commit 7cc6866)
- [x] **Headers di sicurezza HTTP** — CSP, X-Frame-Options, HSTS in 
ext.config.js
- [x] **Sanitizzazione input XSS** — lib/validate.js
- [ ] **Password admin con requisiti minimi + 2FA Supabase**
- [x] **Audit log** — tabella udit_log + trigger su tutte le tabelle

## 💳 Pagamenti
- [x] **Integrazione Stripe Checkout** — validato end-to-end su staging
- [x] **Webhook Stripe** — idempotency + service role + eventi expired/async
- [ ] **Gestione rimborsi** — non implementata → obiettivo #18
- [x] **Prenotazione temporanea** (stato pending) — GC pg_cron ogni 5 min attivo
- [ ] **Ricevuta/fattura automatica** via Stripe
- [ ] **Partita IVA Pro Loco** su Stripe — richiede onboarding live
- [ ] **Notifica admin** per ogni pagamento — obiettivo #5
- [ ] **Dashboard incassi** filtrabili
- [ ] **Pagamento parziale o acconto**

## 📧 Email e notifiche
- [ ] **Email conferma prenotazione** al venditore (Resend) — obiettivo #4 🔴
- [ ] **Email promemoria** 3 giorni prima evento
- [ ] **Email cancellazione** con motivazione
- [ ] **Notifica email admin** — obiettivo #5 🔴
- [ ] **Template email brandizzato Pro Loco**
- [ ] **WhatsApp/SMS** (Twilio) — nice-to-have

## ⚖️ Legale e GDPR
- [x] **Privacy policy** — /privacy presente
- [x] **Cookie banner conforme**
- [ ] **Checkbox accetto trattamento dati** nel form — obiettivo #6 🔴
- [x] **Termini e condizioni** — /termini presente
- [x] **Diritto cancellazione GDPR Art.17** — delete_my_account() + /profilo
- [/] **Dati personali MAI nei log** — safeLogError usato; BUG-014 debugLog da rimuovere
- [/] **Data retention policy** — funzioni DB presenti, scheduling non attivo

## 📱 UX e accessibilità
- [x] **Mobile-first** — mappa usabile su smartphone
- [x] **Stato di caricamento** — Spinner.jsx
- [x] **Gestione errori visibile** — ToastProvider.jsx
- [x] **Pagina 404 personalizzata** — pp/not-found.js
- [ ] **Feedback visivo real-time** — Realtime DB pronto, client non iscritto → obiettivo #14
- [x] **Accessibilità base** — skip-link, ARIA, label su input
- [x] **Favicon e meta tag Open Graph**
- [x] **Pagina successo post-prenotazione** — /prenotato/[id]
- [ ] **Zoom sulla mappa** per eventi grandi
- [x] **Dark mode** — layout.js

## ⚡ Performance e affidabilità
- [/] **Gestione concorrenza** — constraint unique attivo; manca UX di retry → obiettivo #13
- [ ] **Revalidazione pagina evento** dopo prenotazione — obiettivo #12
- [x] **Backup automatico database** — documentato in docs/OPERATIONS.md
- [x] **Monitoring uptime** — Vercel
- [ ] **Ottimizzazione immagini** (<Image>)
- [ ] **Lighthouse score > 90 su mobile**

## 💼 Business e vendita
- [ ] **Dominio personalizzato** — obiettivo #7 🔴
- [ ] **Contratto/accordo scritto** con la Pro Loco
- [ ] **Modello di prezzo chiaro**
- [ ] **Onboarding guidato per l'admin Pro Loco**
- [ ] **Manuale utente PDF** per l'admin
- [ ] **SLA**: responsabilità in caso di down
- [ ] **Scalabilità multi-tenant**
- [ ] **Landing page di marketing**

## ⚙️ Funzionalità admin
- [x] **Modifica/archiviazione evento** — AdminEventCard.jsx
- [x] **Blocco manuale posteggio** — AdminStallPanel.jsx
- [/] **Ricerca prenotazioni per nome** — BookingsPanel con filtro, da migliorare
- [/] **Filtro prenotazioni per evento** — presente, da verificare completezza
- [/] **Stampa lista posteggi** — PrintButton.jsx, da verificare
- [x] **Statistiche storiche** — /admin/statistiche
- [x] **Gestione lista d'attesa** — /admin/lista-attesa

## 🎨 Estetica e branding
- [ ] **Logo Pro Loco Soresina** nell'header
- [x] **Palette colori coerente** — TailwindCSS configurato
- [x] **Font** — 
ext/font (Inter + Fraunces)
- [/] **Foto/immagine evento** — colonna events.image_url esiste; UI da completare
- [x] **Mappa geografica** — Leaflet integrato
- [ ] **Animazioni transizione pagine** — Framer Motion già installato

## 🚀 Deploy e DevOps
- [x] **Ambiente staging separato** — branch staging + DB yctfshlwgouhppadptgy
- [x] **Variabili .env separate** per dev/staging/prod — split per scope su Vercel
- [x] **CI/CD** — deploy automatico su Vercel
- [x] **Error tracking Sentry** — DSN + source maps configurati
- [x] **Analytics** — Vercel Analytics in pp/layout.js

---

*Vedi anche: [[Roadmap]] · [[backlog]] · [[Stato-Progetto-2026-04-25]] · [[Architettura]] · [[Protocollo-Collaborazione]] · [[Memoria-AI]]*
