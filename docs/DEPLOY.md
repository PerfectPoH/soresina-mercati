# Deploy e DevOps — Mercati Soresina

Guida operativa per tenere separati i dati di test e produzione, tracciare gli
errori e capire come l'app viene rilasciata.

## Architettura degli ambienti

| Ambiente      | Branch git  | URL                                                   | Supabase                | Vercel env  |
|---------------|-------------|-------------------------------------------------------|-------------------------|-------------|
| Development   | qualsiasi   | `http://localhost:3000`                               | staging (o dev locale)  | Development |
| Staging       | `staging`   | `https://soresina-mercati-git-staging-*.vercel.app`   | progetto Supabase #2    | Preview     |
| Production    | `main`      | `https://soresina-mercati.vercel.app`                 | progetto Supabase #1    | Production  |

Il deploy su Vercel e' gia' integrato via l'app GitHub: ad ogni push su `main`
va in produzione, ad ogni push su `staging` (o su qualsiasi altro branch / PR)
viene creato un **Preview deploy** con un URL dedicato.

## 1. Creare il progetto Supabase di staging

Il free tier di Supabase consente **fino a 2 progetti per organizzazione**: uno
viene gia' usato per la produzione, il secondo lo useremo per staging.

1. Apri https://app.supabase.com e clicca **New project**.
2. Nome: `soresina-mercati-staging`. Region: **Frankfurt (eu-central-1)** (stessa
   della prod, per coerenza di latenza). Password DB: generane una forte e
   salvala nel tuo password manager.
3. Aspetta che il progetto sia attivo (~2 minuti), poi vai su **Settings -> API**
   e copia:
   - `URL`  -> lo useremo come `NEXT_PUBLIC_SUPABASE_URL` di staging
   - `anon public key`  -> `NEXT_PUBLIC_SUPABASE_ANON_KEY` di staging
4. Applica le migrazioni SQL. Apri **SQL Editor** sul progetto staging e lancia
   in ordine tutti i file in `supabase/migrations/` del repo. In alternativa,
   dalla CLI Supabase:
   ```bash
   supabase link --project-ref <staging-project-ref>
   supabase db push
   ```
5. Crea l'utente admin di staging: **Authentication -> Users -> Add user**.
   Usa una email diversa da quella di produzione per non confonderti.

> I dati di staging sono **completamente separati** dalla prod. Puoi fare
> prenotazioni di prova, cancellare eventi, reset completi — non tocca nulla di
> reale.

## 2. Configurare Vercel: variabili per ambiente

Vercel ha tre "scope" per ogni env var: `Production`, `Preview`, `Development`.
Le variabili Supabase devono avere **valori diversi** per Production e Preview.

Vai su **Vercel -> soresina-mercati -> Settings -> Environment Variables** e
configura:

| Variabile                         | Production                  | Preview                          | Development |
|-----------------------------------|-----------------------------|----------------------------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL`        | URL progetto prod           | URL progetto staging             | (opzionale) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | anon key prod               | anon key staging                 | (opzionale) |
| `NEXT_PUBLIC_SITE_URL`            | `https://<dominio-prod>`    | lasciare vuoto (usa VERCEL_URL)  | (opzionale) |
| `NEXT_PUBLIC_SENTRY_DSN`          | DSN Sentry                  | DSN Sentry (stesso)              | vuoto       |
| `SENTRY_ORG`                      | slug org                    | slug org                         | -           |
| `SENTRY_PROJECT`                  | `soresina-mercati`          | `soresina-mercati`               | -           |
| `SENTRY_AUTH_TOKEN`               | token con scope `project:releases` | stesso token               | -           |

Dopo aver aggiunto le variabili di Preview, lancia un redeploy del branch
`staging` (Deployments -> ultimo di staging -> Redeploy) per farle attivare.

> Se Sentry non e' configurato, lasciare `NEXT_PUBLIC_SENTRY_DSN` vuoto: il
> codice e' no-op quando il DSN e' assente, la build non si rompe.

## 3. Branch workflow

```bash
# Development normale: lavori su main e pusha
git checkout main
git pull
# ...modifiche...
git push origin main        # -> deploy produzione

# Test prima di andare in prod: merge main -> staging
git checkout staging
git merge main
git push origin staging     # -> preview Vercel

# Su staging controlli:
#   - build passa (Vercel mostra READY)
#   - dati di test (Supabase #2) non sporchi la prod
#   - errori in Sentry taggati "preview"
```

Se hai un fix grosso o rischioso, apri un PR su GitHub da un feature branch
verso `main`: Vercel genera automaticamente un deploy di Preview collegato al
PR con i valori Supabase di staging.

## 4. Sentry: error tracking

1. Crea un account/project su https://sentry.io (free tier = 5k errori/mese).
2. Progetto: **Next.js**. Nome: `soresina-mercati`.
3. Copia il **DSN pubblico** (Settings -> Client Keys (DSN)).
4. Incollalo su Vercel come `NEXT_PUBLIC_SENTRY_DSN` (scope: Production + Preview).
5. (Opzionale, per source map leggibili nello stack trace):
   - Settings -> Auth Tokens -> New internal integration
   - Scope: `project:releases`, `project:write`
   - Copia il token in `SENTRY_AUTH_TOKEN` su Vercel
   - Imposta `SENTRY_ORG` (slug dell'org, es. `pro-loco-soresina`)
   - Imposta `SENTRY_PROJECT` (slug del progetto, es. `soresina-mercati`)
6. Redeploy. Al primo errore in produzione vedrai l'evento su Sentry
   dashboard, taggato con environment = `production` e release = SHA commit.

Filtri utili gia' attivi nel codice (`sentry.client.config.js`):
- Ignora `AbortError`, `ResizeObserver loop`, `NEXT_REDIRECT`, `NEXT_NOT_FOUND`
- Scrub automatico di `token`, `access_token`, `refresh_token`, `code` dalle URL
- `sendDefaultPii: false` -> niente IP address

## 5. Vercel Analytics

Gia' integrato via `@vercel/analytics/react` in `app/layout.js`. Nessuna env
var richiesta. Caratteristiche:

- Cookie-less: niente banner aggiuntivo, compatibile con GDPR out-of-the-box
- Funziona solo su deploy Vercel (no-op in dev locale)
- Dashboard: **Vercel -> soresina-mercati -> Analytics** (visibile dopo la
  prima visita in produzione)
- Free tier: 2.5k eventi/mese — abbondante per un sito di prenotazioni locali.

## 6. Primo deploy: checklist

Quando configuri tutto da zero per la prima volta:

1. Progetto Supabase di staging creato + migrazioni applicate
2. Env vars Vercel configurate (Production e Preview separate per Supabase)
3. Branch `staging` creato e pushato: `git push -u origin staging`
4. Account Sentry creato + DSN in Vercel
5. Un push di test su `staging` -> controllare che il deploy di Preview vada
   in READY e che punti al Supabase di staging
6. Merge in `main` -> controllare che produzione sia READY e punti al Supabase
   di produzione
7. Aprire la Analytics in Vercel dashboard per confermare che gli eventi
   arrivino

## 7. Rollback

Se un deploy di produzione rompe qualcosa:

- Vercel -> Deployments -> trovare l'ultimo deploy OK -> **"..."** -> **Promote
  to Production**. Istantaneo, nessun rebuild.
- In parallelo: `git revert <bad-sha> && git push origin main` cosi' il
  codice torna coerente con cio' che e' live.

## Riferimenti

- `.env.local.example` — lista completa env vars con descrizione
- `docs/OPERATIONS.md` — operations runbook (backup, monitoring)
- `docs/SECURITY.md` — threat model, RLS, rate limiting
- `next.config.js` — CSP headers, wrapping Sentry build plugin
- `sentry.{client,server,edge}.config.js` — init per i 3 runtime Next.js
