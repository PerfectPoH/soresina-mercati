---
tipo: memoria-ai
ultimo-aggiornamento: 2026-04-25
tags: [apprendimento, regole, feedback-loop]
---

# 🧠 Memoria Condivisa AI (Lessons Learned)

> **[ISTRUZIONE DI SISTEMA PER ANTIGRAVITY E CLAUDE]**
> PRIMA di iniziare qualsiasi task, dovete leggere questo file per non ripetere errori passati e seguire le convenzioni corrette di questo specifico progetto.
> INOLTRE, ogni volta che risolvete un bug insidioso o trovate una soluzione particolarmente elegante in questo progetto, **è vostro dovere aggiornare questo file** aggiungendo la nuova lezione imparata.
> 
> 🤖 **[DIRETTIVA SPECIALE PER CLAUDE DESKTOP: INTEGRAZIONE ECC]**
> Sul sistema dell'utente è installato il framework "Everything Claude Code". Le tue *Skill* avanzate, le regole di TDD, e i pattern architetturali si trovano fisicamente in:
> - `C:\Users\barak\.claude\rules\`
> - `C:\Users\barak\.claude\skills\`
> Prima di scrivere codice complesso, **sei autorizzato e incoraggiato** ad accedere in sola lettura a quelle cartelle per applicare i pattern di ECC (es. `typescript`, `frontend-patterns`), simulando di fatto il comportamento che avresti da CLI.
> 
> 🛑 **[PROTOCOLLO DI DOPPIA APPROVAZIONE OBBLIGATORIO]**
> ⚠️ **DAL 2026-04-25 il protocollo di collaborazione vincolante è in [[Protocollo-Collaborazione]]**. Questa sezione è un riassunto. In caso di conflitto, prevale il file di protocollo.
>
> **Ruoli (definiti in [[Protocollo-Collaborazione]] §1):**
> - **Opus = Executor** — esegue commit Git, modifiche al codice, configurazioni online (Vercel/Supabase/Stripe/Sentry). Ha accesso a token e API.
> - **Antigravity = Architect/Reviewer** — propone idee, scrive Implementation Plan, fa code-review preventiva e post-implementazione. **Non scrive codice** né esegue comandi online: tutto va delegato a Opus.
>
> **Regole di approvazione:**
> 1. Prima di una modifica, l'agente che propone scrive un "Implementation Plan" in `04-Documentazione/Plan-*.md`.
> 2. L'altro agente fa Code-Review preventiva nella sezione dedicata di `04-Documentazione/Code-Review-*.md`.
> 3. Solo Salandra dà l'OK esplicito in chat ("Ok procedi"). Niente auto-approvazione.
> 4. Se il revisore RIFIUTA il piano, deve elencare i motivi tecnici (es. "Viola RLS", "Crea race condition").
> 5. Ogni modifica completata viene documentata in `02-Devlog/<data>-<agente>-<topic>.md`.
>
> 📖 **REGOLA DI LETTURA OBBLIGATORIA**: prima di rispondere a qualsiasi messaggio di Salandra che richieda un'azione, entrambi gli agenti DEVONO leggere [[Protocollo-Collaborazione]], questo file, gli ultimi devlog e i piani aperti in `04-Documentazione/`. Vedi [[Protocollo-Collaborazione]] §4.

---

## 🔴 Errori da NON ripetere (Anti-pattern)

- **[25 Aprile 2026] Regola operativa Codex (audit-only):** Su richiesta esplicita di Salandra, Codex lavora in modalità **solo analisi**: non modifica file di codice (`app/`, `components/`, `lib/`, `supabase/`) e non applica fix. Deve limitarsi a trovare bug/problemi e documentarli nel vault (es. `03-Bug/backlog.md` o documenti correlati).
- **[25 Aprile 2026] Prima di ogni azione leggere tutto il vault:** Prima di agire su una richiesta, Codex deve rileggere integralmente il vault per allinearsi allo stato reale del progetto e alle decisioni più recenti degli altri agenti.
- **[25 Aprile 2026] Database Local Setup:** Non fare affidamento solo su `schema.sql` per ricreare il database locale. Il file non contiene le policy RLS e la tabella `vendors`. Prima di testare query in locale, assicurarsi di aver lanciato tutte le migrazioni in `supabase/*-migration.sql` (vedi [[Code-Review]]).
- **[25 Aprile 2026] Rate Limiting:** Non implementare limitatori di traffico "in-memory" per proteggere le route API (es. `lib/rate-limit.js`). Su Vercel Serverless la memoria è frammentata e inutile per i DDoS. Usare sempre Vercel KV (Redis) o spostare la logica nel Middleware se si necessita di protezioni globali.

### Lezioni dalla review Opus → Antigravity (2026-04-25)

- **[25 Aprile 2026] Consolidamento schema SQL — non cancellare lo storico:** Quando si unifica più migration files in un unico `schema.sql`, **archiviare** i file storici (in `migrations-archive/`) anziché cancellarli. Lo storico serve per audit, ricostruzione di ambienti specifici, e per capire perché certe scelte sono state fatte. L'eliminazione di 8 file di migrazione nella sessione del 25 aprile ha causato BUG-002.
- **[25 Aprile 2026] View `stalls_with_status` deve usare SECURITY DEFINER:** Mai fare `LEFT JOIN bookings` diretto in una view pubblica. La policy `bookings_vendor_select` blocca la SELECT per utenti anonimi → il join restituisce NULL → tutti i posteggi appaiono `free`. Pattern corretto: funzioni `stall_status_of(uuid)` e `stall_vendor_name(uuid)` con `SECURITY DEFINER` + `set search_path = public` che bypassano RLS in modo controllato e ritornano solo dati non sensibili (stato + nome venditore).
- **[25 Aprile 2026] Webhook server-to-server NON usano `createSupabaseServerClient`:** Quel client legge cookie httpOnly per `auth.uid()`. Stripe (e in generale qualsiasi caller server-to-server) non manda cookie → `auth.uid()` è null → RLS scarta tutte le righe → UPDATE silenziosamente non aggiorna nulla. Pattern corretto: client dedicato `createSupabaseAdminClient()` con `SUPABASE_SERVICE_ROLE_KEY`, da usare **solo** in webhook e cron jobs lato server. Mai esposto al browser. La var `SUPABASE_SERVICE_ROLE_KEY` non deve mai avere prefisso `NEXT_PUBLIC_`.
- **[25 Aprile 2026] Pinare l'API version di Stripe SDK:** `new Stripe(secret)` senza `apiVersion` segue il default che cambia nel tempo → comportamento drift fra build. Sempre passare `apiVersion: '2024-06-20'` (o quella corrente al momento dello sviluppo).
- **[25 Aprile 2026] Webhook Stripe — gestire idempotency:** Stripe può rinviare lo stesso evento (timeout di rete, retry policy). Implementare deduplica via `stripe-signature` event ID + tabella `stripe_events_seen` o `ON CONFLICT DO NOTHING` per evitare double-update.
- **[25 Aprile 2026] Edit di file: verificare il risultato dopo modifiche multi-line:** L'incidente in `app/api/book/route.js` (BUG-001) è un import statement spaccato a metà con `const` inserito in mezzo. Tipico errore di edit malfatto. Dopo qualsiasi modifica a file con import block, **rileggere le prime 30 righe del file** prima di considerare il task chiuso.
- *(Aggiungi qui i futuri errori...)*

---

## 🟢 Cose fatte bene da ricordare (Best Practices)

- **[25 Aprile 2026] Protezione Rotte:** Per proteggere le aree riservate (es. `/admin`), usiamo SEMPRE il `middleware.js` che interroga Supabase SSR per verificare il ruolo dell'utente (`role === 'admin'`). Questo pattern è solido e va mantenuto.
- **[25 Aprile 2026] A11y e SEO:** Ogni nuova pagina creata deve esportare l'oggetto `metadata` e includere sempre `viewport` e `themeColor` separatamente come fatto in `app/layout.js`. Mantenere sempre lo *skip-link* per l'accessibilità da tastiera.
- **[25 Aprile 2026] Utilizzo dei Font:** Per non infrangere il GDPR, usiamo esclusivamente `next/font` (es. Inter e Fraunces). Vietato importare script esterni di Google Fonts.
- **[25 Aprile 2026] Flusso Pagamenti Stripe:** Lo stato di una prenotazione va sempre settato su `pending` quando si genera la `checkout.session`. Solo il webhook in `/api/webhooks/stripe/route.js` ha il permesso di spostare lo stato a `confirmed`. Non confermare mai la prenotazione lato client.
- *(Aggiungi qui le future soluzioni brillanti...)*

---
*PS per gli Agenti AI: Usate sempre i [[Wikilinks]] quando menzionate altri file per mantenere integro il Graph View di Obsidian.*
