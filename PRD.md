# PRD — CrocFit Coach AI

> Documento: Product Requirements Document
> Versione: 1.0 (finale)
> Data: 08 giugno 2026
> Stato: Pronto per implementazione
> Owner: Prodotto CrocFit
> Audience: Gregh + Agent Developer + Team di sviluppo

---

## 0. Convenzioni del documento

- REQ-XXX: requisito funzionale tracciabile
- NFR-XXX: requisito non funzionale
- AC-XXX: acceptance criteria
- OUT-OF-SCOPE: elementi esplicitamente esclusi da MVP
- MUST / SHOULD / COULD secondo priorita di implementazione

---

## 1. Visione e obiettivo prodotto

CrocFit Coach AI e una app mobile-first con coach digitale personale per CrossFit che combina:

- chat intelligente in linguaggio naturale
- gestione programmazione allenamenti
- monitoraggio dati biometrici
- supporto nutrizionale
- pianificazione e analisi performance

L'utente deve poter parlare con il coach in modo libero (come in una chat AI generalista), ma anche ottenere azioni concrete sui propri dati (creare programmazioni, adattare dieta, calcolare carichi, analizzare trend).

### 1.1 Problema da risolvere

Gli atleti amatoriali o semi-competitivi hanno dati dispersi (note, screenshot, app diverse) e poca continuita tra allenamento, recupero e alimentazione.

### 1.2 Outcome target MVP

- centralizzare dati allenamento + biometria + dieta in un unico flusso
- ridurre tempo di pianificazione settimanale
- migliorare aderenza e progressione tramite raccomandazioni contestuali

---

## 2. Tech stack e vincoli architetturali

## 2.1 Stack vincolante

- Frontend app: agent-ui (Expo React Native + web)
- Backend agente/API: agent-core su FastAPI
- Backend dati e servizi managed: Supabase
  - Auth
  - Postgres
  - Storage
  - Realtime
  - (opzionale) Edge Functions

## 2.2 Strategia LLM (cloud-first)

- Niente Ollama locale nel flusso applicativo operativo
- LLM deve essere raggiungibile da mobile in qualunque contesto (rete cellulare inclusa)
- Uso consigliato: LiteLLM come gateway unico multi-provider

### Motivazione

- switch provider/modello senza refactor applicativo
- partenza con provider economico o free tier
- upgrade progressivo a modello premium in produzione

## 2.3 Hosting/deploy

- Frontend: Expo (build distribuzione mobile) + web deployabile
- Backend API agente: deployabile su Vercel (se compatibile runtime) o alternativa server/container
- Dati e storage: Supabase managed

Nota: se limiti runtime impediscono alcune funzioni su Vercel, backend agente va su runtime server pieno (es. container) mantenendo frontend invariato.

---

## 3. Utenti e ruolo prodotto

## 3.1 Persona principale

- Atleta singolo (single-user MVP) con obiettivi di performance e composizione corporea.

## 3.2 Ruoli futuri (non MVP)

- Coach esterno con accesso multi-atleta
- Admin workspace

---

## 4. Esperienza utente target

L'app deve offrire due modalita integrate:

1. Conversazione libera
- utente chiede qualsiasi cosa in ambito allenamento, nutrizione, recupero, pianificazione

2. Operazioni strutturate su dati
- creazione/modifica programmazione
- consultazione storico
- calcoli carico su PR
- aggiornamento dieta
- upload immagini/file e analisi contestuale

---

## 5. Feature MVP

## 5.1 Coach Chat AI

REQ-001 (MUST)
Chat sempre disponibile con streaming risposta.

REQ-002 (MUST)
Contesto memoria su:
- dati atleta
- storico workout
- PR
- biometria
- dieta

REQ-003 (MUST)
Interazione naturale stile chat AI generalista:
- domande aperte
- richieste pratiche
- follow-up multi-turno

REQ-004 (MUST)
Upload allegati in chat:
- immagini (es. foto pasto)
- file (almeno PDF nel MVP)

REQ-005 (SHOULD)
Suggerimenti rapidi in UI (prompt chips):
- Pianifica la mia settimana
- Calcola i carichi di oggi
- Analizza la mia dieta di ieri

## 5.2 Calendario allenamenti

REQ-006 (MUST)
Vista calendario con sessioni pianificate e completate.

REQ-007 (MUST)
Creazione, modifica, duplicazione e completamento sessioni.

REQ-008 (SHOULD)
Creazione sessione da suggerimento AI con conferma utente.

## 5.3 Sessioni workout

REQ-009 (MUST)
Scheda sessione con:
- warm-up
- blocchi lavoro
- esercizi
- serie/ripetizioni
- carico
- note

REQ-010 (MUST)
Log post-workout:
- RPE/fatica percepita
- eventuale dolore/disagio
- commenti

REQ-011 (SHOULD)
Template sessioni riusabili.

## 5.4 PR e calcolo carichi

REQ-012 (MUST)
Registro PR per esercizi principali.

REQ-013 (MUST)
Calcolo percentuali carico su PR selezionato.

REQ-014 (MUST)
Output carichi pratici arrotondati (configurabili).

REQ-015 (SHOULD)
Trend progressione PR nel tempo.

## 5.5 Biometria

REQ-016 (MUST)
Inserimento giornaliero biometria minima:
- peso
- sonno (ore)
- readiness/stanchezza percepita

REQ-017 (SHOULD)
Supporto campi aggiuntivi:
- HR resting
- HRV

REQ-018 (MUST)
Trend 7 e 30 giorni con insight sintetico AI.

## 5.6 Dieta

REQ-019 (MUST)
Gestione target nutrizionali:
- kcal
- macro (proteine, carboidrati, grassi)

REQ-020 (MUST)
Registro pasti testuale e da immagine.

REQ-021 (MUST)
Analisi AI su coerenza dieta vs target.

REQ-022 (SHOULD)
Adattamento suggerito del piano alimentare in base a carico allenamento e trend biometrico.

---

## 6. Agente e orchestrazione

## 6.1 Decisione architetturale

MVP: agente generalista unico con tool verticali.

Motivazione:
- UX semplice e naturale (utente parla con un solo coach)
- minore complessita operativa
- tempi MVP ridotti

## 6.2 Evoluzione prevista

Fase successiva: orchestrator con agenti verticali specialisti, attivati dal router interno:
- CrossFit Coach Specialist
- Nutrition Specialist
- Safety Guard (non diagnosi medica)

## 6.3 Regole safety

REQ-023 (MUST)
Il dominio salute deve usare un profilo Safety Guard con:
- rilevazione red flags
- messaggi di cautela
- invito a consulto professionista in casi sensibili

REQ-024 (MUST)
Nessuna prescrizione medica o diagnosi clinica.

REQ-025 (MUST)
Tutti i consigli su carichi e dieta includono disclaimer operativo.

---

## 7. Data model logico MVP

Entita principali:

- user_profile
- athlete_profile
- workout_session
- workout_block
- workout_exercise
- personal_record
- biometric_entry
- nutrition_target
- meal_log
- coach_thread
- coach_message
- attachment

Relazioni chiave:

- 1 user_profile -> N workout_session
- 1 user_profile -> N personal_record
- 1 user_profile -> N biometric_entry
- 1 user_profile -> N meal_log
- 1 coach_thread -> N coach_message
- 1 coach_message -> N attachment

---

## 8. API e integrazioni MVP

Endpoint minimi (logical contract):

- POST /chat (SSE)
- GET /calendar
- POST /workouts
- PATCH /workouts/{id}
- POST /workouts/{id}/complete
- GET /prs
- POST /prs
- POST /loads/calculate
- GET /biometrics
- POST /biometrics
- GET /nutrition/targets
- PUT /nutrition/targets
- POST /meals
- POST /attachments/upload
- GET /insights/summary

Integrazioni Supabase:

- Auth per sessione utente
- Postgres per dominio dati
- Storage per attachment
- Realtime per aggiornamenti chat/progressi

---

## 9. Requisiti non funzionali

NFR-001 (MUST)
Mobile-first con supporto web.

NFR-002 (MUST)
Streaming chat fluido e resiliente a rete variabile.

NFR-003 (MUST)
Configurazione LLM totalmente via env/config, senza modifiche codice.

NFR-004 (MUST)
Upload sicuro:
- validazione MIME server-side
- limite dimensione
- controllo estensioni

NFR-005 (MUST)
Audit minimo eventi critici:
- invocazioni chat
- tool call principali
- upload file

NFR-006 (SHOULD)
Observability applicativa base (errori + latency).

NFR-007 (MUST)
Privacy-by-design su dati biometrici e nutrizionali.

---

## 10. Configurazione LLM ambienti

## 10.1 Sviluppo

- provider cloud economico/free via LiteLLM
- prompt e toolchain uguali alla produzione

## 10.2 Produzione

- provider premium via LiteLLM (o provider diretto compatibile)
- policy di cost-control e fallback modello

REQ-026 (MUST)
Lo switch modello/provider deve essere zero-code-change.

---

## 11. Roadmap proposta

## Milestone 1: Fondazioni

- setup progetto croc-fit
- setup agent-core backend + connessione Supabase
- setup agent-ui con navigation base
- chat SSE con contesto minimo

## Milestone 2: Core allenamento

- calendario + sessioni + PR + calcolo carichi
- dashboard base

## Milestone 3: Biometria e dieta

- tracking biometria
- target nutrizionali
- meal logging + analisi AI

## Milestone 4: Attachment e quality

- upload immagini/file
- safety guard + disclaimer
- hardening, test, pre-release

## Milestone 5: Evoluzione orchestrator

- introduzione routing a specialisti verticali
- composer finale risposta unificata

---

## 12. Acceptance criteria MVP

AC-001
L'utente crea e completa una sessione da calendario in meno di 2 minuti.

AC-002
L'utente registra un PR e riceve tabella carichi percentuali immediata.

AC-003
La chat risponde usando dati utente reali su almeno tre domini (workout, PR, biometria/dieta).

AC-004
L'utente carica una immagine pasto e riceve feedback contestuale.

AC-005
Cambio provider/modello LLM da configurazione senza refactor applicativo.

AC-006
Dashboard mostra insight utili su trend 7 giorni.

---

## 13. OUT-OF-SCOPE MVP

- multi-atleta e coach portal completo
- diagnosi medica o piani clinici
- integrazioni wearable native complete (Apple Health, Whoop, Garmin)
- billing/subscription
- marketplace programmi

---

## 14. Esecuzione con gregh in sessione separata (handoff ufficiale)

Questo PRD e la fonte unica di verita. L'implementazione deve essere eseguita da gregh in una sessione dedicata, indipendente da questa conversazione.

## 14.1 Prompt di avvio da usare in gregh

Incollare in una nuova sessione:

"Leggi PRD.md e implementa CrocFit MVP end-to-end seguendo rigorosamente requisiti REQ/NFR/AC. Lavora per milestone in ordine, aggiorna AGENT_WORKLOG.md a ogni step, crea migrazioni e seed Supabase, genera .env.example completo, valida con test e consegna report finale con gap residui." 

## 14.2 Modalita di esecuzione obbligatoria

1. Leggere integralmente PRD.md prima di creare codice.
2. Eseguire milestone in ordine (M1 -> M5) senza saltare dipendenze.
3. Aggiornare AGENT_WORKLOG.md dopo ogni task significativo.
4. Non introdurre Ollama nel runtime applicativo; usare solo strategia LLM cloud-first.
5. Mantenere architettura MVP con agente generalista + tool verticali.

## 14.3 Deliverable obbligatori (MUST)

1. Struttura progetto funzionante con frontend agent-ui e backend agent-core.
2. Connessione Supabase attiva (Auth, Postgres, Storage).
3. File .env.example completo per frontend e backend.
4. Migrazioni SQL versionate in cartella supabase/migrations.
5. Seed iniziali coerenti con il dominio (utente demo, workout, PR, biometria, dieta).
6. Endpoint MVP definiti in sezione 8 implementati o stubbati con contratto stabile.
7. Chat SSE funzionante con memoria contesto sui dati utente.
8. Upload attachment (immagine + PDF minimo) con validazione lato server.
9. Disclaimer safety applicato alle risposte salute/carico/dieta.
10. Documento finale di handoff con stato AC-001..AC-006 (done / partial / blocked).

## 14.4 Regole Supabase per questa implementazione

1. Schema e seed devono essere idempotenti quando possibile.
2. Le modifiche DB devono passare da migration file, non da patch manuali non tracciate.
3. Le credenziali non vanno mai committate; usare solo placeholder in .env.example.
4. Eventuali policy RLS possono essere introdotte in fase successiva, ma la struttura deve essere pronta.

## 14.5 Definition of Done della sessione gregh

La sessione e considerata conclusa solo se:

1. Tutti i file richiesti sono creati/aggiornati e committabili.
2. Le istruzioni run locale sono documentate in README o sezione dedicata.
3. E presente un riepilogo finale con:
- funzionalita completate
- test eseguiti
- elementi non completati con motivazione
- prossimi passi suggeriti

## 14.6 Criteri di fallback

Se durante la sessione emergono blocchi esterni (chiavi mancanti, limiti provider, accessi), gregh deve:

1. Proporre alternativa non bloccante (mock/stub/feature flag).
2. Continuare sull'ambito restante invece di fermarsi.
3. Registrare chiaramente il blocco nel report finale.
