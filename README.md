# Mercati Soresina — Pro Loco
per testare: https://soresina-mercati-git-staging-barakatabed687-8047s-projects.vercel.app/evento/51d7d363-3941-4413-8ded-8ddbf6367a23

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

## Prossimi sviluppi (roadmap)

- [ ] Autenticazione admin (Supabase Auth)
- [ ] Pagamento online con Stripe
- [ ] Notifica email/SMS alla prenotazione
- [ ] Creazione eventi dall'admin
- [ ] Cancellazione prenotazioni
- [ ] Export CSV delle prenotazioni
