# Mercati Soresina — Pro Loco

App per la gestione dei posteggi dei mercati di Soresina.

## Setup rapido

### 1. Installa le dipendenze
```bash
npm install
```

### 2. Crea il progetto Supabase
1. Vai su [supabase.com](https://supabase.com) e crea un account gratuito
2. Crea un nuovo progetto (nome: `soresina-mercati`)
3. Vai su **SQL Editor** e incolla il contenuto di `supabase/schema.sql`
4. Clicca **Run** — crea le tabelle e inserisce i dati di esempio

### 3. Configura le variabili d'ambiente
```bash
cp .env.local.example .env.local
```
Poi apri `.env.local` e inserisci le credenziali Supabase:
- **URL**: Settings → API → Project URL
- **Anon key**: Settings → API → Project API keys → anon public

### 4. Avvia in sviluppo
```bash
npm run dev
```
Apri [http://localhost:3000](http://localhost:3000)

---

## Struttura pagine

| URL | Descrizione |
|-----|-------------|
| `/` | Lista eventi pubblici |
| `/evento/[id]` | Mappa bancarelle + prenotazione |
| `/admin` | Dashboard Pro Loco |

## Deploy su Vercel (gratis)

```bash
npx vercel
```
Aggiungi le variabili d'ambiente nel pannello Vercel → Settings → Environment Variables.

---

## Funzionalità implementate

- [x] **Autenticazione admin** (Supabase Auth, password policy server-side)
- [x] **Registrazione vendor** (magic link / password)
- [x] **Pagamento online con Stripe** (Checkout + webhook + idempotency + rimborsi via API admin)
- [x] **Creazione/modifica/archiviazione eventi** dall'admin (rows/cols editabili, posizioni satellitari ereditate)
- [x] **Cancellazione prenotazioni** con flusso utente → admin approve → refund Stripe automatico
- [x] **Export CSV** prenotazioni
- [x] **Lista d'attesa** generale o per posto specifico, con promozione automatica al cancel/rimborso
- [x] **Mappa satellitare** dei posteggi (Leaflet + Esri World Imagery, gratis, no API key)
- [x] **Auto-archiviazione** eventi passati (cron `pg_cron`)
- [x] **GDPR**: cancellazione dati utente (Art. 17), anonimizzazione bookings vecchi, audit log su tutte le mutazioni
- [x] **Sentry** error tracking + Vercel Analytics (cookie-less, GDPR-friendly)
- [x] **Staging environment** completo (branch + Supabase project + Vercel preview env)

## Roadmap aperta

- [ ] **Email transazionali** (Resend) — conferma prenotazione, notifica admin, promozione waitlist
- [ ] **Dominio personalizzato** (es. mercati-soresina.it)
- [ ] **Notifica admin** per ogni pagamento ricevuto

## Bootstrap database (nuovo project Supabase)

1. Esegui `supabase/schema.sql` nell'SQL Editor (stato consolidato: tabelle, view, funzioni, RLS, realtime)
2. Esegui in ordine i file in `supabase/migrations/` (numerati 13 → 21)
3. `supabase/migrations-archive/` contiene lo storico 02-09 già assorbito in `schema.sql` — riferimento, non rieseguire
4. Configura le env Vercel come da `.env.example`
5. Imposta Supabase Auth → Email provider: min length 10, lowercase + uppercase + digits + symbols
6. Imposta Supabase Auth → URL Configuration: Site URL = dominio app, Redirect URLs = `<dominio>/**`
