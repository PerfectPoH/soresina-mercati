---
tipo: stato-progetto
progetto: soresina-mercati
data: 2026-04-26
agente: Antigravity
tags: [stato, completamento, roadmap, analisi]
---

# 📊 Stato di Avanzamento Progetto — Mercati Soresina
**Data analisi:** 26 Aprile 2026  
**Analista:** Antigravity (lettura vault + codice completo)

---

## 🎯 Completamento Globale: ~70%

> Invariato rispetto al 25 aprile. Il blocco principale è l'**onboarding Stripe live** (KYC + IBAN + P.IVA Pro Loco) da parte di Salandra.

---

## ✅ Bug risolti ieri (25 Apr) — tutti in branch staging

Tutti i 17 bug aperti (BUG-001 → BUG-017) risultano **risolti** nei commit `12521ed` e `7cc6866`. Smoke test E2E validato: booking `244dc29f` → `confirmed` in 39s.

---

## 🔴 Bloccanti per la consegna

| # | Task | Chi | Stato |
|---|------|-----|-------|
| 1 | Onboarding Stripe live (KYC + IBAN + P.IVA) | **Salandra** | ⏳ in attesa |
| 2 | Live keys Stripe → Vercel Production | Opus | dipende da #1 |
| 3 | Merge staging → main | Opus | dipende da #1 |
| 4 | **Email conferma prenotazione** (Resend) | Opus/Antigravity | 🔴 non iniziata |
| 5 | **Email notifica admin** per ogni pagamento | Opus/Antigravity | 🔴 non iniziata |
| 6 | **Checkbox consenso GDPR** nel form prenotazione | — | ✅ già presente in BookingForm.jsx |
| 7 | **Dominio personalizzato** (mercati-soresina.it) | **Salandra** | ⏳ in attesa |

> **Nota**: Il task #6 è già implementato — `BookingForm.jsx` ha il checkbox GDPR a riga 257-270. La roadmap lo marcava come aperto per errore.

---

## 🐛 Nuovi bug individuati (26 Apr — audit Antigravity)

Vedi [[backlog]] per i dettagli aggiornati.

| ID | Severità | File | Problema |
|----|----------|------|---------|
| BUG-018 | 🔴 CRITICA | `app/prenotato/[id]/page.js` | Nessun check che la prenotazione appartenga all'utente loggato — chiunque può vedere i dettagli di qualunque booking se indovina l'UUID |
| BUG-019 | 🟠 ALTA | `lib/supabase-admin.js` | Singleton `_admin` condiviso tra richieste serverless: potenziale leak di session state cross-request |
| BUG-020 | 🟠 ALTA | `app/api/book/route.js` | `stalls_with_status` query usa `.single()` senza gestire `null` — se la stall non esiste, `stallData` è null e `amountToPay` diventa `35.00` silenziosamente |
| BUG-021 | 🟠 ALTA | `app/registrati/page.js` | Validazione password solo lato client: nessuna policy server-side su Supabase Auth — password deboli potrebbero passare da API Supabase diretta |
| BUG-022 | 🟡 MEDIA | `app/api/book/route.js` | `revalidatePath` chiamato prima della creazione della sessione Stripe — se l'utente torna alla pagina evento nei ~500ms tra il revalidate e il redirect, vede il posteggio come "pending" bloccato |
| BUG-023 | 🟡 MEDIA | `components/BookingForm.jsx` | `GOODS_TYPES` duplicato in frontend e backend (`lib/validate.js`) — rischio desync se uno dei due viene aggiornato senza l'altro |
| BUG-024 | 🟡 MEDIA | `app/api/waitlist/route.js` | `waitlist` non ha rate limit per-utente (solo per IP): un utente può iscriversi infinite volte allo stesso evento da IP diversi |
| BUG-025 | 🟡 BASSA | `app/prenotato/[id]/page.js` | Pagina mostra "Riceverai conferma via email" ma le email non sono ancora implementate — messaggio fuorviante per l'utente |

---

## 📈 Completamento per area (invariato)

```
Infrastruttura & DevOps   ████████████████████░  95%
Autenticazione & Admin    ████████████████████░  90%
Frontend & UX             ████████████████░░░░░  85%
Database & Backend        ████████████████░░░░░  80%
GDPR & Legale             ██████████████░░░░░░░  70%
Pagamenti Stripe          █████████████░░░░░░░░  65%
Email & Notifiche         ██░░░░░░░░░░░░░░░░░░░  10%
Test automatizzati        ░░░░░░░░░░░░░░░░░░░░░   0%
─────────────────────────────────────────────────
TOTALE STIMATO            ████████████████░░░░░  ~70%
```

---

*Vedi anche: [[backlog]] · [[Roadmap-Master]] · [[Stato-Progetto-2026-04-25]] · [[Plan-Fix-Bugs-Antigravity]]*
