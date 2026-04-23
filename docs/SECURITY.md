# Sicurezza — note per l'amministratore

Questo documento descrive le misure di sicurezza implementate e le
operazioni che vanno fatte **manualmente** nella dashboard di Supabase
(quelle che non possono vivere nel codice).

---

## 1. Variabili d'ambiente

Il progetto usa **solo** due variabili pubbliche:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

La `service_role` key **non deve mai** essere messa in `.env.local`
ne' in variabili `NEXT_PUBLIC_*`. Tutte le operazioni privilegiate
passano dalla RLS + dalla sessione dell'utente admin autenticato,
quindi non serve la service key in questa app.

Se in futuro si aggiunge, tenerla in:
- `SUPABASE_SERVICE_ROLE_KEY` (niente prefisso `NEXT_PUBLIC_`)
- Leggibile solo in route handler / server component, mai nel client.

## 2. RLS (Row Level Security)

Abilitata su: `events`, `stalls`, `bookings`, `vendors`, `waitlist`,
`audit_log`. Policy riassuntive:

- **events**: lettura pubblica (solo `active=true`), admin vede tutto,
  scrittura solo admin.
- **stalls**: lettura pubblica, scrittura solo admin.
- **bookings**: lettura al proprietario o admin; insert solo vendor con
  `user_id = auth.uid()` o admin; update/delete solo admin.
- **vendors**: self-read/self-update; admin puo' cancellare profili.
- **waitlist**: self-read/self-insert/self-delete; admin puo' cancellare.
- **audit_log**: lettura solo admin; scritture via trigger SECURITY DEFINER.

Per ri-verificare nella dashboard Supabase:
Table Editor → tabella → tab "Authentication/RLS" → controlla che
"RLS enabled" sia ON e che le policy compaiano.

## 3. 2FA per l'admin

Passi da fare **una volta** nella dashboard Supabase:

1. Vai su *Authentication* → *Policies* → *Multi-Factor Authentication*
2. Abilita **TOTP** (Time-Based One-Time Password)
3. Effettua il logout e rieffettua il login come admin: Supabase chiedera'
   di collegare un'app TOTP (Google Authenticator, 1Password, Authy...)
4. Salva i codici di recupero in un posto sicuro

Finche' non c'e' una UI custom, l'enrollment 2FA va fatto dalla
Supabase Dashboard alla prima sessione.

## 4. Rate limiting

Implementato in [`lib/rate-limit.js`](../lib/rate-limit.js) con finestra
scorrevole in-memory:

| Endpoint                   | Limite                | Finestra |
| -------------------------- | --------------------- | -------- |
| POST /api/book             | 10 per IP + 5 per utente | 60s     |
| POST /api/events           | 10 per IP             | 60s      |
| PATCH /api/events/[id]     | 30 per IP             | 60s      |
| DELETE /api/events/[id]    | 20 per IP             | 60s      |
| PATCH /api/stalls/[id]     | 30 per IP             | 60s      |
| DELETE /api/bookings/[id]  | 30 per IP             | 60s      |
| POST /api/waitlist         | 10 per IP             | 60s      |
| DELETE /api/waitlist/[id]  | 20 per IP             | 60s      |

> Nota: Vercel serverless ha processi separati, quindi il limite effettivo
> puo' essere leggermente piu' permissivo. Per una protezione forte
> contro DDoS distribuito conviene aggiungere Upstash Redis o
> Vercel Edge Config.

## 5. Security headers HTTP

Configurati in `next.config.js`:
- **Content-Security-Policy** (restrittiva, permette solo `self` + Supabase)
- **X-Frame-Options: DENY** (anti-clickjacking)
- **X-Content-Type-Options: nosniff**
- **Strict-Transport-Security** (HSTS 2 anni + preload)
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** (camera/microfono/geo bloccati)
- **poweredByHeader: false** (rimuove `x-powered-by: Next.js`)

## 6. HTTPS

Vercel termina TLS al proprio edge. Il middleware in `middleware.js`
aggiunge un redirect `http -> https` di ridondanza in produzione
(`x-forwarded-proto`).

## 7. Audit log

Ogni INSERT/UPDATE/DELETE su `events`, `stalls`, `bookings` e' registrato
nella tabella `audit_log` via trigger. La pagina admin `/admin/audit`
mostra le ultime 200 azioni, filtrate per tabella e utente.

## 8. Doppia prenotazione

Oltre al trigger `enforce_booking_limit` (max 2 prenotazioni per
venditore per evento), un **partial unique index**
`bookings_one_confirmed_per_stall` impedisce a livello DB che lo stesso
posteggio abbia due prenotazioni `confirmed` in contemporanea, anche
sotto race condition.

## 9. Validazione + sanitizzazione

Tutte le API passano l'input attraverso i validatori in
[`lib/validate.js`](../lib/validate.js): tipo, lunghezza,
enum chiuso per goods_type, UUID per gli id, regex per date ISO.
La sanitizzazione rimuove tag HTML e caratteri di controllo per
ridurre il rischio di XSS stored.

## 10. Password requirements

La registrazione (`/registrati`) richiede:
- minimo 10 caratteri
- almeno una maiuscola, una minuscola, un numero

Supabase aggiunge il suo check (lunghezza minima) lato server.
