# GDPR — note operative

Checklist operativa per stare conformi GDPR con questa app. Integra il
file [`SECURITY.md`](./SECURITY.md).

---

## 1. Ruoli

- **Titolare del trattamento**: Pro Loco Soresina
- **Responsabili del trattamento** (art. 28 GDPR):
  - Supabase (hosting DB + auth)
  - Vercel (hosting sito)

Per contatti privacy: `privacy@prolocosoresina.it`
(aggiornare nelle pagine `/privacy` e `/termini` se cambia).

## 2. Dati trattati

| Dato               | Dove            | Scopo                                         |
| ------------------ | --------------- | --------------------------------------------- |
| nome + cognome     | `vendors`       | Identificare il venditore                     |
| email              | `auth.users` + `vendors` | Autenticazione, contatto               |
| telefono           | `vendors`       | Comunicazioni urgenti (annullamento mercato)  |
| partita IVA        | `vendors`       | Opzionale                                     |
| primary_goods_type | `vendors`       | Default per tipo merce                        |
| consent_at         | `vendors`       | Timestamp del consenso                        |
| bookings.*         | `bookings`      | Storia delle prenotazioni                     |
| audit_log.*        | `audit_log`     | Tracciabilita' modifiche (admin-only)         |
| IP rate-limit      | in-memory       | Rate limiting (mai persistito)                |

## 3. Consenso

- Checkbox esplicita in `/registrati` e in `BookingForm`
  (non pre-selezionata, bloccante per il submit).
- Timestamp in `vendors.consent_at` (va valorizzato al primo login
  dopo la registrazione — da aggiungere in `ensureVendorProfile` se
  serve tracciare il momento esatto).

## 4. Pagine utente

- `/privacy` — informativa GDPR
- `/termini` — Termini e condizioni d'uso
- `/cookie` — Cookie policy (solo cookie tecnici)
- `/profilo` — area venditore con dati e bottone "cancella account"

## 5. Diritti dell'interessato (art. 15-22)

| Diritto            | Come                                                        |
| ------------------ | ----------------------------------------------------------- |
| Accesso            | Dalla pagina `/profilo` vede tutti i suoi dati              |
| Rettifica          | Al momento via email (form di modifica non ancora in UI)    |
| Cancellazione      | Bottone in `/profilo` -> chiama `delete_my_account()` RPC   |
| Limitazione        | Via email a privacy@...                                     |
| Portabilita'       | Via email: esportare righe `vendors` + `bookings` in JSON   |
| Opposizione        | Via email                                                   |
| Reclamo            | Garante Privacy (`garanteprivacy.it`)                       |

## 6. Retention

Implementata in `supabase/gdpr-migration.sql`:

- `public.anonymize_old_bookings(interval)` — default 24 mesi.
  Sostituisce nome/phone/email/notes dei bookings collegati a eventi
  vecchi con `vendor_name='Anonimizzato'` e campi PII a NULL.
- `public.purge_old_audit_log()` — cancella voci di audit > 90 giorni.

### Come eseguirle

- **A mano**: Pagina admin `/admin/privacy` ha due bottoni
  (Anonimizza / Purga) che chiamano `/api/admin/retention`.
- **Schedulato (consigliato)**: GitHub Action mensile o Supabase
  Scheduled Function che lancia:

  ```sql
  select public.anonymize_old_bookings();
  select public.purge_old_audit_log();
  ```

  Esempio GitHub Action (`.github/workflows/retention.yml`):

  ```yaml
  name: Monthly retention
  on:
    schedule:
      - cron: '0 3 1 * *'    # alle 03:00 del 1 di ogni mese
  jobs:
    run:
      runs-on: ubuntu-latest
      steps:
        - name: Run retention
          run: |
            curl -X POST "${SUPABASE_URL}/rest/v1/rpc/anonymize_old_bookings" \
              -H "apikey: ${SUPABASE_KEY}" \
              -H "Authorization: Bearer ${SUPABASE_KEY}"
            curl -X POST "${SUPABASE_URL}/rest/v1/rpc/purge_old_audit_log" \
              -H "apikey: ${SUPABASE_KEY}" \
              -H "Authorization: Bearer ${SUPABASE_KEY}"
          env:
            SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
            SUPABASE_KEY: ${{ secrets.SUPABASE_ADMIN_KEY }}
  ```

  (Serve una session key di un account admin, non la service_role key;
  oppure configurare una schedulata function nativa Supabase.)

## 7. Log

- Nessuna email/nome/telefono nei log di produzione.
- Wrapper in `lib/log.js` (`safeLogError`) che in produzione filtra
  campi sensibili (`details`, `hint`, stack) e sostituisce email/phone
  nel messaggio.
- In sviluppo (`NODE_ENV=development`) i log sono completi per
  comodita'.

## 8. Data Breach

In caso di violazione dei dati:

1. Entro **72 ore** dalla scoperta: notifica al Garante Privacy
   (`garanteprivacy.it`) con i dettagli dell'incidente.
2. Se la violazione comporta un rischio elevato per i diritti degli
   interessati: comunicazione individuale ai venditori coinvolti.
3. Registrare l'incidente nel log interno delle violazioni (anche un
   semplice file su drive condiviso con data, portata, azioni prese).

## 9. Cookie

Il sito usa SOLO cookie tecnici (auth Supabase + cookie di
"acknowledgement" del banner). Non e' richiesto consenso preventivo
ai sensi delle linee guida del Garante del 10 giugno 2021.

Se in futuro si introducono analytics o tracking:

- Cambia `CookieBanner.jsx` in un banner con scelte granulari
  (Accetta / Rifiuta / Personalizza).
- Blocca gli script di tracking fino al consenso esplicito.
- Aggiorna `/cookie` e `/privacy`.

## 10. Checklist di deploy

Prima della messa in produzione:

- [ ] Esegui `supabase/gdpr-migration.sql` nell'SQL Editor.
- [ ] Aggiorna `privacy@prolocosoresina.it` con l'email reale della
      Pro Loco nelle pagine `/privacy`, `/termini`, `/cookie` e qui.
- [ ] Configura lo scheduler per la retention (vedi punto 6).
- [ ] Verifica che il deploy su Vercel abbia `NODE_ENV=production`
      per attivare il PII scrub nei log.
