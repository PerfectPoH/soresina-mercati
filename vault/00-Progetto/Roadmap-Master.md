---
tipo: roadmap-master
progetto: soresina-mercati
data: 2026-04-25
---

# 🗺️ Master Roadmap & Checklist (Pro Loco)

Questa è la checklist completa del progetto per la consegna alla Pro Loco. 
I task sono stati analizzati dall'AI (Antigravity) e spuntati `[x]` se già implementati e verificati nel codice, oppure `[/]` se implementati parzialmente.

## 🛡️ Sicurezza
- [ ] **Rate limiting sulle API** (max X prenotazioni/minuto per IP) - *CRITICO* *(ATTENZIONE: Attualmente è in RAM, va spostato su Redis/KV)*
- [ ] **Validazione input server-side** su tutti i campi (non solo client) - *CRITICO*
- [ ] **Protezione doppia prenotazione** — lock ottimistico su Supabase (constraint unique) - *CRITICO* *(Suggerita implementazione Realtime)*
- [x] **HTTPS obbligatorio** (Vercel lo fa automatico) - *CRITICO*
- [x] **Variabili d'ambiente MAI esposte lato client** (service_role key solo server) - *CRITICO*
- [/] **RLS (Row Level Security)** abilitato e testato su tutte le tabelle - *CRITICO* *(Da unificare nel `schema.sql`)*
- [x] **Headers di sicurezza HTTP**: CSP, X-Frame-Options, HSTS (middleware Next.js) - *IMPORTANTE* *(Configurati in `next.config.js`)*
- [ ] **Sanitizzazione input** per prevenire XSS - *IMPORTANTE*
- [ ] **Password admin con requisiti minimi + 2FA Supabase** - *IMPORTANTE*
- [ ] **Audit log**: chi ha cancellato/modificato cosa e quando - *NICE TO HAVE*

## 💳 Pagamenti
- [x] **Integrazione Stripe Checkout** (uso Stripe hosted) - *CRITICO*
- [x] **Webhook Stripe** per confermare la prenotazione SOLO dopo pagamento - *CRITICO*
- [ ] **Gestione rimborsi**: cancellazione entro X giorni → rimborso automatico via Stripe - *CRITICO*
- [x] **Prenotazione temporanea** (stato `pending` durante il checkout) - *CRITICO* *(Manca il cron-job per liberarle dopo 15 min)*
- [ ] **Ricevuta/fattura automatica** via Stripe - *IMPORTANTE*
- [ ] **Partita IVA Pro Loco** configurata su Stripe - *IMPORTANTE*
- [ ] **Notifica admin** per ogni pagamento ricevuto - *IMPORTANTE*
- [ ] **Dashboard incassi** filtrabili per evento / periodo - *NICE TO HAVE*
- [ ] **Pagamento parziale o acconto** - *NICE TO HAVE*

## 📧 Email e notifiche
- [ ] **Email di conferma prenotazione al venditore** (con Resend/SendGrid) - *CRITICO*
- [ ] **Email di promemoria** 3 giorni prima dell'evento - *IMPORTANTE*
- [ ] **Email di cancellazione** con motivazione - *IMPORTANTE*
- [ ] **Notifica email all'admin** per ogni nuova prenotazione - *IMPORTANTE*
- [ ] **Template email brandizzato Pro Loco** - *IMPORTANTE*
- [ ] **WhatsApp/SMS opzionale** tramite Twilio - *NICE TO HAVE*

## ⚖️ Legale e GDPR
- [ ] **Privacy policy** - *CRITICO*
- [x] **Cookie banner conforme** - *CRITICO*
- [ ] **Checkbox esplicita "accetto trattamento dati"** nel form - *CRITICO*
- [ ] **Termini e condizioni d'uso del servizio** - *CRITICO*
- [ ] **Diritto alla cancellazione dati (GDPR Art. 17)** - *IMPORTANTE*
- [ ] **Dati personali MAI nei log di sistema** - *IMPORTANTE*
- [ ] **Data retention policy** (cancellazione automatica vecchi log) - *NICE TO HAVE*

## 📱 UX e accessibilità
- [x] **Mobile-first**: mappa bancarelle usabile su smartphone - *CRITICO*
- [ ] **Stato di caricamento** su tutti i bottoni async (loading spinner) - *CRITICO*
- [ ] **Gestione errori visibile all'utente** (toast/alert) - *CRITICO*
- [ ] **Pagina 404 personalizzata** - *IMPORTANTE*
- [ ] **Feedback visivo prenotazione in tempo reale** (altro utente la prende) - *IMPORTANTE*
- [x] **Accessibilità base**: label su input, skip link - *IMPORTANTE* *(A11y ottima)*
- [x] **Favicon e meta tag Open Graph** - *IMPORTANTE*
- [ ] **Pagina di successo post-prenotazione** con riepilogo - *IMPORTANTE*
- [ ] **Zoom sulla mappa** per eventi grandi - *NICE TO HAVE*
- [x] **Dark mode** - *NICE TO HAVE* *(Configurata in `layout.js`)*

## ⚡ Performance e affidabilità
- [ ] **Gestione concorrenza**: due utenti che prenotano la stessa bancarella - *CRITICO*
- [ ] **Revalidazione pagina evento** dopo ogni prenotazione (`revalidatePath`) - *CRITICO*
- [ ] **Backup automatico database Supabase** - *CRITICO*
- [x] **Monitoring uptime** (Vercel) - *IMPORTANTE*
- [ ] **Ottimizzazione immagini Next.js** (`<Image>`) - *IMPORTANTE*
- [ ] **Lighthouse score > 90 su mobile** - *NICE TO HAVE*

## 💼 Business e vendita
- [ ] **Dominio personalizzato** (es. mercati-soresina.it) - *CRITICO*
- [ ] **Contratto/accordo scritto** con la Pro Loco - *CRITICO*
- [ ] **Modello di prezzo chiaro** - *CRITICO*
- [ ] **Onboarding guidato per l'admin Pro Loco** - *IMPORTANTE*
- [ ] **Manuale utente PDF** per l'admin - *IMPORTANTE*
- [ ] **SLA**: responsabilità in caso di down - *IMPORTANTE*
- [ ] **Scalabilità multi-tenant** (per altre Pro Loco) - *NICE TO HAVE*
- [ ] **Landing page di marketing** - *NICE TO HAVE*

## ⚙️ Funzionalità admin mancanti
- [/] **Modifica/archiviazione evento** dopo la creazione - *CRITICO*
- [ ] **Blocco manuale di una bancarella** - *IMPORTANTE*
- [ ] **Ricerca prenotazioni per nome venditore** - *IMPORTANTE*
- [ ] **Filtro prenotazioni per evento nella dashboard** - *IMPORTANTE*
- [ ] **Stampa lista posteggi con assegnazioni** - *IMPORTANTE*
- [ ] **Statistiche storiche** - *NICE TO HAVE*
- [ ] **Gestione lista d'attesa** - *NICE TO HAVE*

## 🎨 Estetica e branding
- [ ] **Logo Pro Loco Soresina** nell'header - *IMPORTANTE*
- [ ] **Palette colori coerente** - *IMPORTANTE*
- [x] **Font scelto e consistente ovunque** - *IMPORTANTE* *(Usato `next/font`)*
- [ ] **Foto/immagine dell'evento** nella card - *IMPORTANTE*
- [x] **Mappa geografica** (Leaflet è già integrato e migliore di Google Maps per lo scopo) - *NICE TO HAVE*
- [ ] **Animazioni di transizione** tra pagine (Framer Motion) - *NICE TO HAVE*

## 🚀 Deploy e DevOps
- [ ] **Ambiente staging separato** - *CRITICO*
- [ ] **Variabili .env separate** per dev/staging/prod - *CRITICO*
- [x] **CI/CD**: deploy automatico su Vercel - *IMPORTANTE*
- [x] **Error tracking con Sentry** - *IMPORTANTE* *(Avvolto in `next.config.js`)*
- [ ] **Analytics**: Vercel Analytics o Plausible - *NICE TO HAVE*
