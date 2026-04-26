---
tipo: bug-report
aperto-da: Codex 5.3
data: 2026-04-26T16:34
severita: "🔴 CRITICA (build bloccata)"
stato: APERTO
tags: [build, nextjs, opengraph, vercel-og, runtime-evidence]
---

# BUG-027 — `next build` fallisce su `/opengraph-image` con `TypeError: Invalid URL`

## Sintomo

La build produzione fallisce in fase prerender:

- `Error occurred prerendering page "/opengraph-image"`
- `TypeError: Invalid URL`
- stack in `node_modules/next/dist/compiled/@vercel/og/index.node.js`
- export error finale: `/opengraph-image/route: /opengraph-image`

## Evidenza runtime (sessione debug `055679`)

### Run 1 (prima strumentazione)

Comando:

```bash
npm run build
```

Output chiave:

```text
Error occurred prerendering page "/opengraph-image".
TypeError: Invalid URL
    at new URL (node:internal/url:827:25)
    at fileURLToPath (node:internal/url:1608:12)
    at .../@vercel/og/index.node.js:18984:32
```

### Run 2 (dopo strumentazione in `app/opengraph-image.js`)

Comando:

```bash
npm run build
```

Output chiave:

```text
Error occurred prerendering page "/opengraph-image".
TypeError: Invalid URL
    at new URL (node:internal/url:827:25)
    at fileURLToPath (node:internal/url:1608:12)
    at .../@vercel/og/index.node.js:18984:32
```

Esito log debug:

- file atteso: `debug-055679.log`
- risultato: **File not found** (nessuna entry scritta)

## Ipotesi valutate con evidenza

1. **H1 — crash prima dell'esecuzione del modulo route**: **PROBABILE/QUASI CONFERMATA**
   - evidenza: build stack entra in `@vercel/og` e non compare nessuna entry in `debug-055679.log` nonostante log top-level nel file route.
2. **H2 — crash dentro `OpenGraphImage()`**: **REJECTED**
   - evidenza: assenza totale di log entry inserite all'ingresso funzione.
3. **H3 — crash su costruzione `new ImageResponse(...)`**: **REJECTED**
   - evidenza: assenza totale di log entry immediatamente prima della chiamata.
4. **H4 — incompatibilita path/URL in ambiente build Windows + `@vercel/og`**: **INCONCLUSIVE (alta priorita di verifica)**
   - evidenza: stack concentra il fault su `new URL`/`fileURLToPath` in runtime OG.

## Impatto

- blocca `npm run build`
- blocca release/CI di produzione

## Prossimo passo suggerito

- isolare variabile ambientale/path che OG tenta di parseare come URL invalido (strumentando un wrapper o minimizzando il route OG a un payload ancora piu semplice), poi applicare fix con conferma runtime.

---

Correlato: [[backlog]]
