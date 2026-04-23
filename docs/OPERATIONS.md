# Operations

Operazioni di gestione post-deploy: backup, monitoring, performance.
Pensato per chi gestisce il sito senza essere sviluppatore.

---

## 1. Backup automatico del database (Supabase)

### Cosa succede di default (piano free)

Supabase sul piano gratuito esegue **un backup automatico al giorno**
degli ultimi 7 giorni. Non serve configurare nulla per averlo attivo:
e' acceso out-of-the-box. Il restore e' manuale e si richiede via
Dashboard.

### Come verificare che i backup esistano

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard).
2. Apri il progetto `soresina-mercati` (o come lo hai chiamato).
3. Menu laterale: **Database** → **Backups**.
4. Dovresti vedere una riga per ogni giorno degli ultimi 7 giorni,
   ciascuna con dimensione e timestamp.

Se la pagina dice "No backups" o "Upgrade to enable", significa che
qualcosa non e' allineato con il piano: apri un ticket a Supabase.

### Come ripristinare (worst case)

Non serve farlo mai in condizioni normali. In caso di disastro
(dati cancellati per errore, SQL andato male, compromissione):

1. Supabase Dashboard → **Database** → **Backups**.
2. Scegli il backup giornaliero piu' vicino al momento pre-disastro.
3. Clicca **Restore**. Supabase scrive sopra lo stato attuale.
   **Attenzione**: tutte le modifiche dopo quel backup vengono perse.

Per recuperi piu' granulari (point-in-time) serve il piano Pro.
Per il nostro volume di traffico (piccolo mercato cittadino) il
giornaliero e' piu' che sufficiente.

### Backup manuale mensile (raccomandato)

Una volta al mese e' buona pratica scaricare un dump locale. Cosi'
hai una copia indipendente anche in caso di problemi seri col
fornitore.

**Modo semplice — da Dashboard**:

1. Supabase Dashboard → **Database** → **Backups**.
2. Ogni riga ha un bottone "Download" o "Restore" di fianco.
3. Click su "Download", salva il `.sql` in una cartella (es.
   `backups/` sul tuo computer).

**Modo tecnico — da terminale** (opzionale):

```bash
# Ottieni il Database URL da Supabase Dashboard > Project Settings > Database
pg_dump "postgres://postgres.<ref>:<password>@<host>:5432/postgres" \
  --schema=public --no-owner --no-privileges \
  -f backup-$(date +%Y%m%d).sql
```

Conserva i dump degli ultimi 6 mesi su Google Drive o simile.

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
