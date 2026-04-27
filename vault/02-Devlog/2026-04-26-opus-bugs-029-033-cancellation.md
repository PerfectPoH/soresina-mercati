---
tipo: devlog
data: 2026-04-26
agente: Claude Opus 4.7
sessione: bugs-029-033 + cancellation-flow + template-positions
tags: [stripe, refund, cancellation, slots, dashboard, admin]
---

# Devlog 2026-04-26 (notte) — Opus, sessione lunga: 5 bug + cancellation flow + template posizioni

## Contesto

Salandra ha testato la prenotazione su staging dopo i fix BUG-026 e ha riportato 5 problemi:
1. Incasso stimato sbagliato (70€ con 2 da 3€)
2. Limite 2 prenotazioni bypassato (paga la 3a, resta in pending)
3. Modifica numero slot evento disabilitata
4. Profilo utente mostra solo numeri, non dettagli
5. Manca flusso "richiesta cancellazione utente → admin approva → rimborso Stripe"

In più: domanda su "lista d'attesa" + nuova feature "salva posizioni satellitari per riuso fra eventi".

## Cosa ho fatto

### BUG-029 — Incasso stimato hardcoded
`app/admin/page.js`: nuova funzione `calcolaIncasso(bookings)` che somma `stalls.price ?? events.price_per_stall` per ogni booking confirmed. Query aggiornata.

### BUG-030 — Bypass limite 2 prenotazioni via Stripe
**Problema critico di sicurezza**: il trigger contava solo confirmed. Sequenza buggy:
1. Utente A ha 2 confirmed
2. Inizia 3° checkout → INSERT pending → trigger non blocca (count confirmed = 2)
3. Stripe addebita
4. Webhook UPDATE pending→confirmed → trigger ora vede 2 confirmed esistenti + sta per fare 1 confirmed → **blocca silenziosamente**
5. Booking resta pending per sempre, utente ha pagato

Migration `16_booking_limit_includes_pending`: trigger ora conta `confirmed + pending`, escludendo l'id corrente. L'INSERT del 3° viene bloccato PRIMA del checkout. Applicato su prod e staging.

### BUG-031 — Modifica rows/cols evento + template posizioni
- `EventForm.jsx`: rimosso `disabled={isEdit}` dai campi rows/cols
- `app/api/events/[id]/route.js` PATCH: accetta rows/cols con check "solo aumento" (diminuzione → 400 esplicito), legge eventCurrent prima della validazione
- Quando rows/cols aumentano: chiama `generate_stalls()` (ON CONFLICT DO NOTHING preserva posteggi vecchi) + `copy_stall_positions_from_template()` per i nuovi
- Pagina modifica: testo aggiornato

### Feature template posizioni satellitari (nuova richiesta Salandra)
- Migration `17_copy_stall_positions_template`: funzione `copy_stall_positions_from_template(p_event_id)` SECURITY DEFINER
- Cerca l'ultimo evento alla stessa `location` con stalls che hanno latitude/longitude valorizzate
- Copia per label match (A01, A02, ecc.) solo se la stall destinazione non ha già coordinate
- Chiamata da `POST /api/events` (nuovo evento) e da `PATCH /api/events/[id]` (aumento rows/cols)
- Best-effort: se fallisce, l'evento è creato comunque

### BUG-032 — Profilo utente con dettagli
`app/profilo/page.js` riscritto: lista completa con evento, data, posteggio, prezzo, badge stato (Attiva / In attesa / Passata / Annullata), link a `/prenotato/[id]`, bottone "Richiedi cancellazione" per active/pending.

### BUG-033 — Flusso cancellazione utente + admin + rimborso
Implementazione completa:

**DB** (migration `18_booking_cancellation_request`):
- Colonne nuove su bookings: `cancellation_requested_at`, `cancellation_reason`, `stripe_session_id`, `stripe_payment_intent_id`
- Funzione `request_booking_cancellation(uuid, text)` SECURITY DEFINER

**Webhook Stripe**: `handleCheckoutCompleted` ora salva `stripe_session_id` + `stripe_payment_intent_id` quando conferma il booking. Necessari per il rimborso futuro.

**API utente**: `POST /api/bookings/[id]/cancellation-request` con body `{ reason }`. Rate limit IP (10/min) + utente (5/min).

**API admin**: 
- `POST /api/admin/bookings/[id]/cancel` con `{ refund: true|false }` → se refund=true e c'è payment_intent: `stripe.refunds.create()`. Aggiorna status=cancelled.
- `DELETE /api/admin/bookings/[id]/cancel` → rifiuta richiesta (clear `cancellation_requested_at`).

**UI utente**: componente `RequestBookingCancellation.jsx` con form motivo + invio.

**UI admin**: pagina `/admin/cancellazioni` con lista richieste pending. Per ogni richiesta mostra evento, data, posteggio, prezzo, venditore con contatti, motivo, payment_intent. Bottoni: "Annulla + rimborsa" (verde, solo se c'è payment_intent), "Annulla senza rimborso" (per booking pre-Stripe o gratuiti), "Rifiuta richiesta".

**Dashboard admin**: link "Cancellazioni" nuovo + badge contatore con numero richieste pending.

### Risposta domanda Salandra: a cosa serve "Lista d'attesa"

La lista d'attesa è una feature di backup quando un evento è esaurito (tutti i posteggi prenotati): un venditore può iscriversi e l'admin la vede in `/admin/lista-attesa`. Oggi è solo una raccolta — l'admin contatta i venditori manualmente quando si libera un posto.

**Possibili miglioramenti futuri** (non implementati ora):
- Notifica automatica email al primo della lista quando un posteggio si libera (dopo annullamento confermato)
- Possibilità per il venditore in lista di "convertire" la sua iscrizione in prenotazione direttamente

## Stato post-sessione

- **Bug aperti**: 0
- **Bug chiusi totali**: 33
- **Tech debt**: 4 (tutti non bloccanti)
- **Nuove feature**: 2 (template posizioni stalls + flusso cancellazione completo)

## Punti di attenzione per smoke test su staging

1. **Rate limit** sulla 3a prenotazione: aspettati `429` o messaggio "Hai raggiunto il limite di 2 posteggi" PRIMA del redirect Stripe.
2. **Flusso cancellazione**:
   - Utente prenota A05, paga
   - Profilo: vede A05 attiva con bottone "Richiedi cancellazione"
   - Click → form motivo → invia
   - Admin: dashboard mostra badge "1" su Cancellazioni
   - Admin clicca → vede richiesta con dettagli + payment_intent
   - Click "Annulla + rimborsa" → status=cancelled + Stripe refund
   - Utente: profilo mostra A05 con badge "Annullata"
3. **Posizioni satellitari**: crea un nuovo evento con stessa location di un evento esistente che ha posteggi posizionati → i posteggi del nuovo evento dovrebbero apparire già piazzati sulla mappa.
4. **Modifica rows/cols**: modifica un evento esistente, aumenta colonne da 8 a 10 → 2 nuove colonne di posteggi appaiono in griglia + sulla mappa (con coordinate ereditate se esistono).

## Cosa rimane

Stesso elenco di prima per la consegna Pro Loco:
1. Onboarding Stripe live (Salandra)
2. Email transazionali Resend (Opus quando vuoi)
3. Dominio personalizzato (Salandra)
