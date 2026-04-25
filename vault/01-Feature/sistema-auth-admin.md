---
tipo: feature-spec
stato: completata
assegnata-a: Antigravity
priorità: alta
tags: [auth, supabase, admin, feature]
---

# Feature: Sistema di Autenticazione Admin

## Obiettivo
Implementare il login per la Pro Loco al fine di accedere alla dashboard amministrativa protetta (`/admin`).

## Requisiti
- Utilizzare **Supabase Auth** (Email + password).
- Implementare pagina di login dedicata (es. `/login` o `/admin/login`).
- Proteggere la rotta `/admin` e le sue sottopagine: redirect automatico al login se l'utente non è autenticato.
- Assicurare che il middleware aggiorni correttamente i token SSR.

## Vincoli tecnici
- → Vedi [[Regole-Backend]] per l'uso obbligatorio di `@supabase/ssr`.
- Il form di login deve comunicare feedback visivi di errore (credenziali errate, rate limit).

## Criteri di accettazione
- [ ] La UI di login rispetta lo standard estetico Tailwind definito per il progetto.
- [ ] Un utente non loggato che naviga su `/admin` viene reindirizzato.
- [ ] Login e Logout funzionano correttamente lato server e client.
- [ ] Documentazione aggiornata in `04-Documentazione/` relativa all'autenticazione.

---

*Vedi anche: [[Regole-Backend]] · [[Architettura]] · [[Memoria-AI]] · [[backlog]]*
