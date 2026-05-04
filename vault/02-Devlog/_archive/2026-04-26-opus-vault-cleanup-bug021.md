---
tipo: devlog
data: 2026-04-26
agente: Claude Opus 4.7
sessione: vault-reorg + bug021-via-browser
tags: [vault, organization, supabase-auth, browser-automation]
---

# Devlog 2026-04-26 (sera) — Opus, vault cleanup + BUG-021 via browser

## Contesto

Salandra ha:
1. Installato l'estensione Claude in Chrome → posso operare il suo browser
2. Loggato su Supabase → mi ha chiesto di chiudere io BUG-021 (Password Policy) via UI
3. Chiesto di riorganizzare il vault che era diventato confuso

## Cosa ho fatto

### BUG-021 — Password Policy Supabase Auth

Eseguito via Claude in Chrome (browser automation):

1. Navigato `https://supabase.com/dashboard/project/yctfshlwgouhppadptgy/auth/providers?provider=Email` (staging)
2. Aperto drawer Email provider, settato:
   - **Minimum password length**: `10`
   - **Password requirements**: `Lowercase, uppercase letters, digits and symbols (recommended)`
3. Click Save → toast "Successfully updated settings" ✅
4. Ripetuto identico per produzione (`ddqwutxocznggfmrzzkw`)
5. Verificato persistenza riaprendo il drawer su entrambi gli ambienti

Da questo momento Supabase **rifiuta lato server** signUp con password debole (anche se chiamato direttamente via API senza passare dal nostro form React).

[[backlog]] aggiornato: BUG-021 ora ✅ RISOLTO.

### Vault cleanup

Il vault era cresciuto a 28 file con devlog, plan, review, stato sparsi tra `02-Devlog` e `04-Documentazione`. Ho riorganizzato secondo logica vivo/archivio.

**Movimenti principali**:

- `04-Documentazione/DevLog-2026-04-25.md` → `02-Devlog/2026-04-25-antigravity-schema-merge.md`
- `04-Documentazione/DevLog-Opus-Stripe-Recovery.md` → `02-Devlog/2026-04-25-opus-stripe-recovery.md`
- `02-Devlog/2026-04-25.md` → `02-Devlog/2026-04-25-antigravity-vault-init.md` (rinominato per coerenza)
- `00-Progetto/Roadmap.md` → `04-Documentazione/_archive/Roadmap-Iniziale-Antigravity.md` (manteniamo solo Roadmap-Master)
- `Wikilinks.md` (root) → `00-Progetto/Wikilinks.md`

**Spostati in `04-Documentazione/_archive/`** (chiusi/completati):
- `Stato-Progetto-2026-04-25.md`
- `Code-Review.md` (review iniziale Antigravity)
- `Opus-Action-Plan.md`
- `Plan-Stripe-Recovery.md`
- `Plan-Fix-Bugs-Antigravity.md`
- `Code-Review-Opus-vs-Antigravity.md`
- `Post-Review-Stripe-Fase1.md`

**Backlog snellito**:
- Storia completa BUG-001..025 spostata in `03-Bug/_archive/Bug-Risolti-Storico.md`
- Nuovo `backlog.md` mostra: 0 bug aperti, 4 tech-debt, riassunto risolti per categoria
- Apertura: si vede subito che non c'è niente di critico aperto

**Nuovo navigation hub**:
- Creato `vault/INDEX.md` come homepage del vault con quick links, struttura cartelle, convenzioni nomenclatura, stato attuale del progetto
- Aggiornato `00-Progetto/Wikilinks.md` con tabelle pulite e riferimenti corretti ai file rinominati

### Risultato finale

**Struttura attuale**:
```
vault/
├── INDEX.md                          ← homepage
├── 00-Progetto/                      ← documenti vivi fondazionali
│   ├── Architettura.md
│   ├── Memoria-AI.md
│   ├── Protocollo-Collaborazione.md
│   ├── Regole-Backend.md
│   ├── Regole-Codice.md
│   ├── Roadmap-Master.md
│   └── Wikilinks.md
├── 01-Feature/
│   ├── pagamento-stripe.md
│   └── sistema-auth-admin.md
├── 02-Devlog/                        ← cronologia delle sessioni
│   ├── 2026-04-25-antigravity-vault-init.md
│   ├── 2026-04-25-antigravity-schema-merge.md
│   ├── 2026-04-25-opus-review.md
│   ├── 2026-04-25-opus-stripe-recovery.md
│   ├── 2026-04-25-opus-fase2.md
│   ├── 2026-04-25-opus-stripe-validato.md
│   ├── 2026-04-25-antigravity-vault-cleanup.md
│   ├── 2026-04-26.md
│   ├── 2026-04-26-opus-bugs-018-025.md
│   └── 2026-04-26-opus-vault-cleanup-bug021.md  (questo file)
├── 03-Bug/
│   ├── backlog.md                    ← solo aperti + tech debt
│   └── _archive/
│       └── Bug-Risolti-Storico.md
└── 04-Documentazione/
    ├── README.md
    ├── Stato-Progetto-2026-04-26.md  ← snapshot vivo
    └── _archive/                     ← chiusi/completati
        ├── (8 file)
```

## Stato bug post-sessione

- **Bug aperti**: 0
- **Bug chiusi totali**: 23 risolti + 2 NOT-A-BUG = 25
- **Tech debt**: 4 (tutti non bloccanti)

## Cosa rimane per la consegna Pro Loco

1. **Onboarding Stripe live** (KYC + IBAN) — Salandra
2. **Email transazionali Resend** — io quando vuoi
3. **Dominio personalizzato** — Salandra

Tutto il resto è in piedi e funzionante. Quando vuoi proseguire dimmi su cosa.
