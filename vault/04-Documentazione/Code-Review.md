---
tipo: review
progetto: soresina-mercati
data: 2026-04-25
agente: Antigravity
---

# Code Review: Mercati Soresina

Ho effettuato un'analisi completa della base di codice e dell'architettura del progetto. Ecco i risultati.

## 🟢 Cosa va molto bene (Punti di forza)

1. **Ottima Accessibilità (a11y) e SEO**
   - L'implementazione in `app/layout.js` usa in modo magistrale i metadati Next.js 14, esportando separatamente `viewport` come da best practice.
   - Presenza dello "Skip link" e attributi ARIA per supportare gli screen reader (es. `role="contentinfo"`, `aria-hidden`).
   - Uso corretto e performante dei Web Fonts (`next/font`) per evitare problemi GDPR e prevenire i FOUC (flash of unstyled text).
   
2. **Architettura Frontend Moderna**
   - Utilizzo massiccio e corretto dell'App Router.
   - Distinzione chiara tra Server Components (di default) e Client Components (es. form e interazioni).
   - Buona gestione della UI per l'utente, inclusi banner cookie e dark mode (con script inline anti-FOUC).

3. **Sicurezza di Base (Next.js)**
   - Il `middleware.js` fa il suo dovere: gestisce i redirect HTTPS in Vercel e protegge efficacemente la cartella `/admin` verificando che l'utente loggato esista nella tabella `vendors` con il ruolo di amministratore.
   - Gestione delle Server Route con controlli di sessione.

---

## 🔴 Cosa c'è da migliorare (Debito Tecnico e Sicurezza)

1. **Schema Supabase Frammentato (`schema.sql`)**
   - **Problema:** Il file `supabase/schema.sql` è incompleto. Contiene `events`, `stalls`, e `bookings`, ma **manca la tabella `vendors`**! La tabella `vendors` e le policy RLS sono state sparpagliate in molti file di migrazione separati (es. `auth-migration.sql`, `rls.sql`).
   - **Perché è critico:** Se un nuovo sviluppatore clona la repo ed esegue solo `schema.sql` (come indicato nel README), l'app crasherà al login e sarà completamente vulnerabile (senza RLS).
   - **Soluzione:** Fondere l'ultimo stato del database in un unico `schema.sql` (usando `supabase db dump`) per facilitare l'onboarding e documentare tutte le tabelle (inclusa `vendors`) in un unico punto.

2. **Componenti React Troppo Grandi**
   - **Problema:** Componenti come `StallMapSatellite.jsx` (20 KB) e `BookingForm.jsx` (10 KB) sono monolitici.
   - **Perché è critico:** Diventano difficili da manutenere, testare e leggere per agenti o sviluppatori umani.
   - **Soluzione:** Suddividere questi file in sotto-componenti più piccoli. Ad esempio, estrarre la mappa da `StallMapSatellite.jsx` o isolare la logica del submit rispetto al markup dei campi in `BookingForm.jsx`.

3. **Rate Limiting Localizzato**
   - **Problema:** Il Rate Limit attualmente viene effettuato all'interno dei Route Handlers (es. `api/book/route.js`).
   - **Perché è critico:** Se l'app è deployata su Vercel Serverless Functions, la memoria (e quindi il rate limiting basato su di essa) è frammentata e isolata per ogni richiesta/istanza. Non funzionerà bene per mitigare attacchi DDoS distribuiti.
   - **Soluzione:** Spostare il rate limit nel `middleware.js` e/o utilizzare un servizio Edge (es. Upstash Redis / Vercel KV) per il rate limiting distribuito.

4. **Mancanza di Test Automatizzati**
   - **Problema:** Non vedo configurati né Playwright/Cypress per i test End-to-End, né Vitest/Jest per gli Unit test.
   - **Soluzione:** Introdurre una pipeline di testing, specialmente per il flusso di autenticazione e per il calcolo del checkout appena introdotto con Stripe.

## Conclusione
Il progetto è estremamente solido dal punto di vista dell'esperienza utente e dell'implementazione Next.js. I colli di bottiglia sono prevalentemente sul lato della Developer Experience (schema DB frammentato) e sulla sicurezza su larga scala (rate limiting in memory su serverless).

---

*Vedi anche: [[backlog]] · [[Code-Review-Opus-vs-Antigravity]] · [[Opus-Action-Plan]] · [[Plan-Fix-Bugs-Antigravity]] · [[Stato-Progetto-2026-04-25]]*
