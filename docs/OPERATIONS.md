# Operations

Operazioni di gestione post-deploy: backup, monitoring, performance.
Pensato per chi gestisce il sito senza essere sviluppatore.

---

## 1. Backup del database (Supabase)

### Importante: il piano free NON ha backup automatici

Sul piano gratuito Supabase **non** include backup automatici
giornalieri con restore one-click. Quelli sono una feature del
piano Pro ($25/mese), che include 7 giorni di Point-In-Time
Recovery.

Per un mercato cittadino con volumi bassi, il Pro e' eccessivo.
La soluzione e' un **dump manuale periodico** che scarichi tu e
conservi in un posto sicuro.

### Piano raccomandato per il free tier

Scarica un dump **ogni settimana** (o almeno ogni mese) e tienilo
in un cloud che non sia Supabase (Google Drive, Dropbox, disco
esterno). Conserva gli ultimi 6 mesi di dump in rotazione.

### Come fare un dump manuale

**Opzione A — da terminale con `pg_dump`** (consigliata):

1. Vai su Supabase Dashboard → **Project Settings** → **Database**.
2. In "Connection string" copia la stringa **Transaction pooler**
   (porta 6543) o **Direct connection** (porta 5432). Scegli
   "URI" come formato.
3. Sostituisci `[YOUR-PASSWORD]` con la password del DB.
4. Installa `pg_dump` se non ce l'hai:
   - Windows: scarica PostgreSQL da postgresql.org (basta scegliere
     "Command Line Tools" durante l'installazione).
   - Mac: `brew install postgresql`
   - Linux: `sudo apt install postgresql-client`
5. Lancia:

```bash
pg_dump "postgres://postgres.<ref>:<password>@<host>:5432/postgres" \
  --schema=public --no-owner --no-privileges \
  -f backup-$(date +%Y%m%d).sql
```

Ti crea un file `backup-20260423.sql` (o simile) con tutto lo
schema e i dati pubblici. Salvalo fuori da Supabase.

**Opzione B — export CSV per tabella** (piu' semplice, meno
completo):

1. Supabase Dashboard → **Table Editor**.
2. Per ogni tabella importante (`events`, `stalls`, `bookings`,
   `vendors`) click sui tre puntini accanto al nome → "Export data
   as CSV".
3. Scarica e archivia tutti i CSV insieme.

L'opzione B ti salva i dati ma **non** lo schema ne' le policy
RLS ne' i trigger. Se devi ricostruire da zero il progetto, il
`pg_dump` ti salva tutto; i CSV solo i dati.

### Se vuoi Point-In-Time Recovery

Se un giorno il sito cresce e un disastro di 24h fa diventa
inaccettabile, valuta l'upgrade al **piano Pro** ($25/mese):

- PITR fino a 7 giorni indietro (default) o 14/28 con add-on.
- Restore cliccando su un punto temporale dal Dashboard.
- Backup logici giornalieri conservati per 7 giorni.

Fino ad allora, il dump manuale settimanale e' l'alternativa che
costa zero.

---

## 2. Uptime monitoring

### Perche' ti serve

Se il sito va giu' (Vercel deploy rotto, Supabase down, bug runtime),
vuoi saperlo tu prima che un venditore non riesca a prenotare e ti
chiami al telefono.

### Setup raccomandato: UptimeRobot (gratuito)

UptimeRobot offre 50 monitor ogni 5 minuti gratis, con notifica email.

1. Registrati su [uptimerobot.com](https://uptimerobot.com).
2. Dashboard → **Add New Monitor**.
3. Compila:
   - **Monitor Type**: `HTTPS`
   - **Friendly Name**: `Mercati Soresina - health`
   - **URL**: `https://soresina-mercati.vercel.app/api/health`
   - **Monitoring Interval**: `5 minutes`
   - **Keyword Monitoring** (opzionale): keyword `"ok"` — cosi'
     il monitor segnala downtime anche se il sito risponde 200 ma
     ha il DB rotto (il payload conterrebbe `"status":"degraded"`).
4. **Alert Contacts**: aggiungi la tua email.
5. Crea. Dopo 5 min dovresti vedere la prima freccia verde.

### Cosa controlla

L'endpoint [`/api/health`](../app/api/health/route.js) ritorna:

- `200 ok` se l'app Vercel risponde + Supabase risponde in <5s.
- `503 degraded` se l'app risponde ma il DB e' giu' o lento.
- Nessuna risposta / timeout → il monitor scatta downtime.

### Vercel built-in

Vercel mostra gia' uptime base in **Dashboard → Project → Observability
→ Logs**. Non manda alert ma e' utile per diagnosi post-fatto.

---

## 3. Performance monitoring

### Lighthouse (test manuale)

Target: **> 90 su mobile** per la home.

**Come testarlo:**

1. Apri Chrome.
2. Vai su `https://soresina-mercati.vercel.app/`.
3. Apri DevTools (F12) → tab **Lighthouse**.
4. Scegli:
   - **Mode**: Navigation
   - **Device**: Mobile
   - **Categories**: Performance, Accessibility, Best Practices, SEO
5. Click **Analyze page load**.

Oppure usa [PageSpeed Insights](https://pagespeed.web.dev/) che gira
Lighthouse su server Google (piu' realistico del tuo PC).

### Cosa guardare

- **Performance**: LCP (Largest Contentful Paint) < 2.5s.
  Se fallisce: servire la home da cache Vercel (gia' fatto tramite
  rendering statico dove possibile).
- **Accessibility**: minimo 95. Abbiamo gia' skip link, focus-visible,
  touch target 44px, contrast AA.
- **Best Practices**: HTTPS forzato (middleware), HSTS (via Vercel
  auto), CSP configurato in `next.config.js`.
- **SEO**: meta description, og image, robots.txt (se serve).

### Metriche Vercel in produzione

Vercel ha gratis Web Analytics e Speed Insights (basic). Attivali da
Vercel Dashboard → Project → Analytics. Mostrano LCP/CLS/FID reali
dagli utenti veri, non simulati.

---

## 4. Quando intervenire

| Situazione | Chi se ne accorge | Cosa fare |
|---|---|---|
| Vercel deploy fallito | Email Vercel a te | Guarda build log, probabile errore in codice: ripristina commit precedente |
| Sito restituisce 500 | UptimeRobot ti manda email | Controlla Vercel logs; se DB giu', guarda Supabase status |
| `/api/health` ritorna degraded | UptimeRobot (con keyword) | Supabase probabilmente lento o in manutenzione |
| Venditore non riesce a prenotare un posteggio gia' preso | Realtime UI aggiorna + nessun errore | Funzionamento corretto — il messaggio "posteggio appena preso" e' previsto |
| Admin riceve "RLS bloccato" sblocco posteggio | Tu, come admin | Esegui `supabase/security-migration.sql` in SQL Editor |

---

Ultimo aggiornamento: aprile 2026.
