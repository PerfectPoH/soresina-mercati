# Agent Bootstrap - Soresina Mercati

This repository uses two persistent context layers:

- `vault/` is the human-readable project memory: rules, lessons learned, devlogs, backlog, reviews.
- `graphify-out/` is the generated code knowledge graph: graph report, graph JSON, HTML view, cache.

Before code or architecture work, do this in order:

1. Read `vault/INDEX.md`.
2. Read `vault/00-Progetto/Protocollo-Collaborazione.md`.
3. Read `vault/00-Progetto/Memoria-AI.md`.
4. Read `vault/03-Bug/backlog.md`.
5. Read the latest relevant file in `vault/02-Devlog/` or `vault/04-Documentazione/`.
6. Read `graphify-out/GRAPH_REPORT.md` before broad search or architecture answers.

Graphify commands should go through the project wrapper so agents do not depend on a global PATH setup:

```bash
npm run graph:update
npm run graph:query -- "how does booking connect to Stripe?"
npm run graph:path -- "POST()" "createSupabaseAdminClient()"
npm run graph:explain -- "createSupabaseServerClient()"
npm run graph:check
```

Use raw search/read after graph orientation, especially for exact code edits and verification. After changing code files, run `npm run graph:update` and then `npm run graph:check`.

Do not commit generated graph cache or duplicate graph artifacts under `vault/`. The canonical generated graph location is `graphify-out/`; the canonical human memory location is `vault/`.

Codex role note: since 2026-05-03, Codex is an architect/reviewer peer of Antigravity and may execute local repo changes when Salandra explicitly authorizes it in chat. Keep changes scoped, verified, and documented in the vault when substantial.
