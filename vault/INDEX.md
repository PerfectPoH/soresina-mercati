---
tipo: index
ultimo-aggiornamento: 2026-05-06
---

# 🗂️ INDICE — Vault Mercati Soresina

> Cervello condiviso fra **Salandra** (umano), **Claude Opus 4.7** (executor), **Antigravity (Gemini)** (architect/reviewer), **Codex** (architect/reviewer + executor locale autorizzato).
>
> 📖 **Leggi sempre prima**: [[Protocollo-Collaborazione]] (vincolante) e [[Memoria-AI]] (anti-pattern).

---

## ⚡ Quick links

- 🛡 [[Protocollo-Collaborazione]] — ruoli e workflow agenti
- 🧠 [[Memoria-AI]] — lezioni apprese, anti-pattern
- 🐛 [[backlog]] — bug aperti (vista snella)
- 🗺 [[Roadmap-Master]] — checklist completa progetto
- 📊 [[Code-Review-Codex-vs-Opus]] — audit operativo più aggiornato

---

## 📁 Struttura

| Cartella | Contenuto |
|---|---|
| `00-Progetto/` | Documenti fondazionali (architettura, regole, protocollo, memoria, roadmap, wikilinks) |
| `01-Feature/` | Spec di feature da implementare |
| `02-Devlog/` | Log cronologico delle sessioni — un file per sessione, nominato `<data>-<agente>-<topic>.md` |
| `03-Bug/` | Bug tracker (`backlog.md`) — solo bug aperti + tech debt |
| `03-Bug/_archive/` | Storico bug risolti |
| `04-Documentazione/` | Documenti vivi (stato progetto corrente) |
| `04-Documentazione/_archive/` | Plan/Review/Stato chiusi e completati, mantenuti come riferimento storico |

---

## 🎯 Documenti vivi (consulta questi)

### 00-Progetto
- [[Protocollo-Collaborazione]] — VINCOLANTE
- [[Memoria-AI]] — anti-pattern + best practice
- [[Architettura]] — stack e architettura
- [[Regole-Codice]] — frontend
- [[Regole-Backend]] — backend + Supabase
- [[Roadmap-Master]] — checklist completa progetto (allineata)
- [[Wikilinks]] — graph view

### 01-Feature
- [[pagamento-stripe]] — feature spec Stripe
- [[sistema-auth-admin]] — feature spec auth

### 03-Bug
- [[backlog]] — bug aperti + tech debt (snello)

### 04-Documentazione
- [[Code-Review-Codex-vs-Opus]] — audit repo, vault, sicurezza e Graphify
- [[Stato-Progetto-2026-04-26]] — snapshot archiviato in `04-Documentazione/_archive/`
- [[README]] — note generali documentazione

---

## 📜 Storia cronologica

### 02-Devlog (per data)
- `2026-04-25-antigravity-vault-init.md` — Antigravity inizializza il vault
- `2026-04-25-antigravity-schema-merge.md` — Antigravity unifica schema (poi corretto)
- `2026-04-25-opus-review.md` — Opus review delle modifiche di Antigravity
- `2026-04-25-opus-stripe-recovery.md` — Opus, Fase 1 Stripe recovery
- `2026-04-25-opus-fase2.md` — Opus, Fase 2 fix bug
- `2026-04-25-opus-stripe-validato.md` — Opus, Stripe e2e validato
- `2026-04-25-antigravity-vault-cleanup.md` — Antigravity, cleanup vault
- `2026-04-26.md` — Antigravity, devlog generale 26 aprile
- `2026-04-26-opus-bugs-018-025.md` — Opus, fix bug 018-025
- `2026-05-03-codex-vault-graphify-setup.md` — Codex, setup operativo vault + Graphify
- `2026-05-03-codex-promozione-ruolo.md` — Codex promosso a peer architect/reviewer + executor controllato
- `2026-05-04-opus-bug047-banner-profilo-redesign.md` — Opus, snapshot prezzo, banner waitlist, redesign profilo
- `2026-05-04-codex-audit-opus-rework.md` — Codex, audit e fix BUG-048/049 sul rework Opus

### 04-Documentazione/_archive
Documenti chiusi mantenuti come riferimento:
- `Stato-Progetto-2026-04-25.md` — snapshot precedente
- `Roadmap-Iniziale-Antigravity.md` — roadmap di partenza Antigravity
- `Code-Review-Iniziale-Antigravity.md` — review iniziale Antigravity
- `Code-Review-Opus-vs-Antigravity.md` — review preventiva tra agenti
- `Opus-Action-Plan-Antigravity.md` — plan iniziale per Opus
- `Plan-Stripe-Recovery.md` — eseguito al 100%
- `Plan-Fix-Bugs-Antigravity.md` — eseguito
- `Post-Review-Stripe-Fase1.md` — post-review Fase 1

### 03-Bug/_archive
- `Bug-Risolti-Storico.md` — dettagli completi BUG-001..025

---

## 📝 Convenzioni

- **Nomenclatura devlog**: `<YYYY-MM-DD>-<agente>-<topic>.md` (esempi: `2026-04-26-opus-bugs-018-025.md`)
- **Nomenclatura plan**: `Plan-<topic>.md` (es. `Plan-Stripe-Recovery.md`)
- **Nomenclatura review preventive**: `Code-Review-<reviewer>-vs-<reviewed>.md`
- **Nomenclatura review postume**: `Post-Review-<topic>.md`
- **Bug ID**: `BUG-NNN` (incrementale, mai riusare)
- **Wikilinks**: usare `[[NomeFile]]` per riferirsi ad altri file (mantiene il graph)

---

## 🚦 Stato attuale del progetto

**Branch attivi**:
- `main` (HEAD `5989389`) — produzione live, vecchio flusso senza Stripe (sano)
- `staging` — Stripe sandbox + Resend in testing mode + redesign incrementale completato (Sessioni 1-5 [[Plan-Redesign-Incrementale]]) + 5 bug critici post-Codex chiusi (BUG-047 … BUG-052)

**Implementato dal 04-06 maggio**:
- ✅ BUG-047 snapshot prezzo (`bookings.paid_price`)
- ✅ BUG-048/049 schema.sql allineato + complete/route.js snapshot-aware
- ✅ BUG-050 stall_status check server-side prima INSERT
- ✅ BUG-051 GC 15min esclude pending da waitlist (migration 24)
- ✅ BUG-052 atomic claim Stripe session via `stripe_session_id` token
- ✅ BUG-040 Resend con 3 template (conferma, annullamento admin, promozione waitlist)
- ✅ Banner waitlist promotion in-site (countdown 24h)
- ✅ Redesign incrementale: /profilo, homepage, /evento/[id], /admin, /prenotato/[id]
- ✅ Email dark mode opt-out
- ✅ UI admin "annulla forzato" con motivo + scelta rimborso

**Bloccanti residui per consegna Pro Loco**:
1. Onboarding Stripe live (KYC + IBAN Pro Loco) — Salandra
2. Verifica dominio Resend (DNS SPF+DKIM+DMARC) per email a destinatari diversi dal proprio account — Salandra
3. Dominio personalizzato sito — Salandra

Quando i 3 sono fatti → merge `staging → main`.
