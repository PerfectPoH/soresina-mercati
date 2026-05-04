---
tipo: bug-report
aperto-da: Antigravity
data: 2026-04-26T14:20
severità: 🔴 CRITICA (blocca prenotazioni su staging)
stato: APERTO
tags: [regression, book, stalls_with_status, bug-020]
---

# BUG-026 — Regressione: prenotazione bloccata su staging con "Errore nel verificare il posteggio"

## Segnalazione di Salandra

> Testato su staging: quando prenoto un posteggio, appare l'errore:
> **"Errore nel verificare il posteggio"**
>
> — Salandra, 2026-04-26 14:20

## Analisi causa (Antigravity)

L'errore è una **regressione introdotta dal fix BUG-020** (commit di Opus, 26 Apr mattina).

### Percorso del codice

`app/api/book/route.js` righe 109-121:

```js
const { data: stallData, error: stallErr } = await supabase
  .from('stalls_with_status')
  .select('price, default_price, event_title, label, event_id')  // ← event_id aggiunto
  .eq('id', stall_id)
  .eq('event_id', event_id)  // ← filtro aggiunto
  .maybeSingle()

if (stallErr) {
  // ← Qui ci finisce l'utente. stallErr NON è null.
  return NextResponse.json(
    { error: 'stall_lookup_failed', message: 'Errore nel verificare il posteggio.' },
    { status: 500 }
  )
}
```

L'errore corrisponde al ramo `stallErr` (500), non al ramo `!stallData` (404, "Posteggio non trovato").

### Causa probabile #1 (alta probabilità)

**`event_id` non è una colonna esposta dalla view `stalls_with_status`** con quel nome esatto.

Il fix BUG-020 ha aggiunto `event_id` sia nella `.select()` che come filtro `.eq('event_id', event_id)`. PostgREST su Supabase restituisce un errore (code `42703` o simile) quando si seleziona o si filtra su una colonna che non esiste nella view. Il client Supabase ritorna `stallErr` non-null → il codice risponde con 500 "Errore nel verificare il posteggio".

La view `stalls_with_status` è ricostruita tramite LATERAL join in `supabase/schema.sql`. Il campo `event_id` è sulla tabella `stalls` base ma potrebbe non essere proiettato con quel nome nella view, oppure la view usa già un alias diverso (es. `stalls.event_id` dentro un join LATERAL può non essere selezionato di default).

### Causa probabile #2 (media probabilità)

Il filtro `.eq('event_id', event_id)` funziona ma la **colonna `event_id` nella select** causa l'errore (colonna non accessibile nella view via PostgREST). Il filtro `.eq()` su colonne non in select potrebbe funzionare diversamente rispetto alla select esplicita della stessa colonna.

### Come verificare

Su Supabase SQL editor (staging `yctfshlwgouhppadptgy`):

```sql
-- Verifica che event_id esista nella view
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'stalls_with_status'
ORDER BY ordinal_position;

-- Test query simile a quella del codice
SELECT price, default_price, event_title, label, event_id
FROM stalls_with_status
LIMIT 1;
```

## Fix proposto (Opus esegue)

### Opzione A — Rimuovere `event_id` dalla select (fix minimo)

Il campo `event_id` nella select è stato aggiunto per completezza ma **non viene usato** nel codice dopo la query (la variabile `stallData.event_id` non viene mai letta). Rimuoverlo dalla select risolve il potenziale problema di colonna non disponibile, mantenendo il filtro `.eq('event_id', event_id)` che è il punto critico del fix BUG-020.

```js
// PRIMA (codice attuale — rotto):
.select('price, default_price, event_title, label, event_id')

// DOPO (fix):
.select('price, default_price, event_title, label')
```

Il filtro `.eq('event_id', event_id)` rimane invariato — è quello che impedisce la cross-event injection.

### Opzione B — Se anche il filtro `.eq('event_id', event_id)` non funziona sulla view

Verificare che `event_id` sia filtrable sulla view. Se la view usa alias o la colonna si chiama diversamente, aggiornare il nome nel filtro `.eq()`. Verificare con:

```sql
SELECT stall_id, event_id FROM stalls_with_status LIMIT 5;
-- oppure
\d stalls_with_status
```

### Opzione C — Fallback sicuro se event_id non è nella view

Aggiungere una query separata per verificare la corrispondenza stall↔event:

```js
const { data: stallData } = await supabase
  .from('stalls_with_status')
  .select('price, default_price, event_title, label')
  .eq('id', stall_id)
  .maybeSingle()

// Cross-check ownership manuale
if (stallData && /* colonna event della stall */ !== event_id) {
  return 404
}
```

Ma questa è una soluzione più invasiva — preferire Opzione A.

## Impatto

- **Staging**: ogni tentativo di prenotazione fallisce con 500. Il flusso Stripe è completamente bloccato.
- **Production** (`main`): non impattata — il fix BUG-020 non è ancora in `main` (HEAD `5989389`, pre-merge da staging).

## Priorità

🔴 **Fix urgente su staging prima di qualsiasi altro test o merge → main**.

---

*Aperto da: [[2026-04-26]] devlog Antigravity · Correlato a: [[backlog]] BUG-020 · Segnalato da: Salandra in chat*
