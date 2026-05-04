---
tipo: documentazione
data: 2026-05-04
agente: opus
oggetto: Skill huashu-design come reference di design
---

# Skill huashu-design — Reference per Soresina-Mercati

## Cos'è

Skill creata da [alchaincyf](https://github.com/alchaincyf/huashu-design): collezione di pattern di design (HTML hi-fi prototypes, animazioni, slide, App mockup) basata su 20 filosofie di designer leggendari. Pensata per workflow di prototipazione rapida, **non è una libreria React/Tailwind drop-in**.

## Cosa è utile per noi

Soresina-Mercati è Next.js 14 + Tailwind con palette warm (cream/amber/stone) e font Inter+Fraunces già definiti. Non vogliamo importare codice della skill, ma **riusare i principi** delle filosofie compatibili con il nostro tone of voice.

### Filosofie applicabili

#### Stamen Design (data poetry)
- Warm palette terracotta/sage/deep blue → già coerente con cream/amber.
- Algoritmi che generano pattern organici → utile per micro-decorations sul profilo (es. progress bar morbide).
- Layered information come mappe topografiche → applicabile alla lista prenotazioni (livelli: passate → attive → in attesa).

#### Pentagram (Michael Bierut)
- 60%+ whitespace.
- Una sola accent color (per noi: amber-700 #BA7517).
- Tipografia come linguaggio principale → useremo Fraunces per H1/H2 nel profilo.
- Niente decorazioni gratuite.

#### Müller-Brockmann (Swiss grid)
- Precise mathematical spacing (rems multipli di 4).
- Griglia 12-col (ce l'abbiamo gia' tramite Tailwind).
- Sfondi neutri, contenuto è il decoro.

#### Kenya Hara (minimalismo giapponese)
- "Empty fullness" — più spazio = più valore percepito.
- Tipografia leggera, no bold abuse.
- Foto/elementi singoli alla volta, mai grappoli.

### Pattern UX da copiare

Da `references/animations.md`:
- **Stagger reveal**: list items appaiono con delay 80-120ms uno dopo l'altro (Framer Motion `staggerChildren: 0.08`).
- **Hover lift sottile**: `translateY(-2px)` + ombra morbida, mai più di 2px.
- **Number tick**: contatori che si animano (utile per "Totali" / "Confermate" sul profilo).
- **Status pill morph**: i badge cambiano colore con transizione 200ms invece di flip secco.

Da `references/cinematic-patterns.md`:
- **Hero "establishing shot"**: titolo grande Fraunces + sottotitolo Inter regular, niente immagine sopra.
- **Sezione "moments of pause"**: 64-96px di vertical breathing tra blocchi, mai meno.

## Come la useremo

Per il redesign incrementale (vedi [[Plan-Redesign-Incrementale]]):
1. **/profilo** → Pentagram + Stamen (questa sessione).
2. **/** (homepage) → Kenya Hara hero + Stamen card.
3. **/evento/[id]** → Müller-Brockmann grid per la mappa + dati.
4. **/admin** → Pentagram (massima densità, zero decoro).

Non scaricheremo la skill nel repo: il SKILL.md è 800+ righe e gli `assets/` sono GB di immagini di showcase. Conserviamo solo questo file di riferimento.

**Path locale (clone temporaneo, non versionato):** `/tmp/huashu-design/` — può essere ricloned in qualsiasi momento da https://github.com/alchaincyf/huashu-design.

## Note critiche

- La skill è scritta in cinese (mandarino). Le references hanno parti tradotte ma SKILL.md no.
- Approccio "agentico": dice di interrogare WebSearch per ogni asset di brand. Per Soresina-Mercati non serve (siamo brand owner della Pro Loco).
- Punta forte sull'export video (MP4/GIF) di animazioni HTML: per noi non rilevante.

## Wikilinks
- [[Plan-Redesign-Incrementale]] — piano di applicazione concreto
- [[Memoria-AI]] — convenzioni vault e best practice
