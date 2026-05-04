# Soresina Mercati - Agent Bootstrap

This project has two persistent context layers:

- `vault/` is the project memory for agents and humans.
- `graphify-out/` is the generated Graphify knowledge graph for code navigation.

## Required Startup

Before architecture, debugging, or code work:

1. Read `vault/INDEX.md`.
2. Read `vault/00-Progetto/Protocollo-Collaborazione.md`.
3. Read `vault/00-Progetto/Memoria-AI.md`.
4. Read `vault/03-Bug/backlog.md`.
5. Read the latest relevant devlog/review in `vault/02-Devlog/` or `vault/04-Documentazione/`.
6. Read `graphify-out/GRAPH_REPORT.md` before broad raw search.

## Graphify

Do not rely on a global `graphify` command being in PATH. Use the project wrapper:

```bash
npm run graph:update
npm run graph:query -- "how does booking connect to Stripe?"
npm run graph:path -- "POST()" "createSupabaseAdminClient()"
npm run graph:explain -- "createSupabaseServerClient()"
npm run graph:check
```

For cross-module questions, prefer `graph:query`, `graph:path`, or `graph:explain` first, then inspect exact source files.

After modifying code files, run:

```bash
npm run graph:update
npm run graph:check
```

Generated graph files belong in `graphify-out/`. Do not duplicate generated graph cache or HTML inside `vault/`.

## Codex Role Note

Since 2026-05-03, Codex is an architect/reviewer peer of Antigravity and may execute local repo changes when Salandra explicitly authorizes it in chat. Substantial work should be verified and documented in the vault.
