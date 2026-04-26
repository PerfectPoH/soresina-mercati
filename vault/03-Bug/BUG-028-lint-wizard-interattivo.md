---
tipo: bug-report
aperto-da: Codex 5.3
data: 2026-04-26T16:34
severita: "🟡 MEDIA (quality gate non deterministico)"
stato: APERTO
tags: [lint, ci, tooling]
---

# BUG-028 — `npm run lint` non headless: apre wizard interattivo

## Sintomo runtime

Eseguendo:

```bash
npm run lint
```

compare:

```text
? How would you like to configure ESLint?
❯ Strict (recommended)
  Base
  Cancel
```

Invece di eseguire il lint e restituire un exit code standard.

## Impatto

- impedisce check automatici affidabili in CI/agent
- degrada il ciclo di debug (non si distingue facilmente pass/fail lint)

## Stato

APERTO.

---

Correlato: [[backlog]]
