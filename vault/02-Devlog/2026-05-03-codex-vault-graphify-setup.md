---
tipo: devlog
data: 2026-05-03
agente: codex
topic: vault-graphify-setup
tags: [vault, graphify, agenti, setup]
---

# Sessione Codex - Vault e Graphify setup

## Contesto

Salandra ha chiesto di verificare e sistemare il setup di vault e Graphify per renderli utili agli agenti quando il progetto cresce.

## Cosa ho fatto

- Aggiunto `AGENTS.md` come bootstrap per Codex e agenti compatibili.
- Riscritto `CLAUDE.md` come entrypoint unico: prima vault, poi Graphify, poi codice.
- Aggiunta regola Cursor always-on in `.cursor/rules/graphify.mdc`.
- Aggiunti script npm `graph:*` che chiamano Graphify tramite wrapper locale, senza dipendere dal PATH globale.
- Aggiunto `scripts/graphify.mjs`, che prova `graphify`, `py -m graphify`, `python -m graphify`, `python3 -m graphify` e fallback PowerShell/Windows da ambienti Unix.
- Aggiunto `scripts/check-agent-memory.mjs` per verificare grafo, report, bootstrap agenti e assenza di artefatti generati dentro il vault.
- Aggiunto `.graphifyignore` per escludere build, credenziali, cache e duplicati generati.
- Riallineato `graphify-out/.graphify_root` al workspace Windows corrente.
- Aggiornata `00-Progetto/Memoria-AI.md` con i comandi stabili e la nuova policy.
- Riallineati `INDEX.md` e `Wikilinks.md` sui documenti archiviati e sull'audit corrente.

## Problemi incontrati

- Il pacchetto Python `graphifyy` era gia' installato, ma `graphify.exe` non era nel PATH.
- Su Windows `py -m graphify` funziona, mentre `python3` no.
- Gli artefatti Graphify erano duplicati anche dentro `vault/`, confondendo memoria umana e cache generata.

## Note per la prossima sessione

- Dopo modifiche codice: `npm run graph:update`, poi `npm run graph:check`.
- Prima di lavorare: leggere `vault/INDEX.md`, `Protocollo-Collaborazione`, `Memoria-AI`, backlog e `graphify-out/GRAPH_REPORT.md`.
- `graphify-out/` resta la fonte canonica generata; `vault/` resta la memoria leggibile.
