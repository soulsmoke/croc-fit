# CrocFit Coach AI

AI-powered CrossFit coaching assistant. Chat in natural language with your personal coach, manage workouts, track PRs, log biometrics and nutrition.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Expo SDK 56 + React Native + expo-router |
| Backend | Python 3.13 + FastAPI + agent-core |
| DB / Auth / Storage | Supabase (Postgres + Auth + Storage) |
| LLM Gateway | LiteLLM (cloud-first, provider-agnostic) |
| Agent framework | LangGraph via agent-core |

---

## Project structure

```
croc-fit/
  croc-fit-api/        FastAPI backend + agent-core
  croc-fit-app/        Expo React Native frontend
  supabase/
    migrations/        SQL migrations (idempotent)
    seed.sql           Demo seed for local dev
```

---

## Local development setup

### Prerequisites

- Python 3.13+
- Node.js 20+
- [uv](https://github.com/astral-sh/uv) — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `brew install supabase/tap/supabase`

### 1. Start Supabase locally

```bash
npx supabase start
# Copy SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY from output
```

### 2. Apply migrations + seed

```bash
npx supabase db reset
# or manually:
psql "$DATABASE_URL" -f supabase/migrations/001_initial_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/002_exercise_completion.sql
psql "$DATABASE_URL" -f supabase/migrations/003_exercise_load_pct.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

### 3. Backend (croc-fit-api)

```bash
cd croc-fit-api

# Copy and fill env
cp .env.example .env.local

# Install dependencies (agent-core è incluso — serve accesso al repo HNRG-Lab/agent-core)
uv sync

# Start server
uv run python -m croc_fit_api.server
# → http://localhost:8000
# → Docs: http://localhost:8000/docs  (only when DEBUG=true)
```

### 4. Frontend (croc-fit-app)

```bash
cd croc-fit-app

# Copy and fill env
cp .env.example .env.local

# Install dependencies
npm install
# or: yarn install

# Start dev server
npm start
# → Press w for web, i for iOS, a for Android
```

---

## API endpoints (MVP)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/chat/stream` | SSE streaming chat |
| GET | `/api/v1/calendar` | Sessioni per mese |
| GET/POST | `/api/v1/workouts` | Lista / crea sessione |
| GET | `/api/v1/workouts/{id}` | Dettaglio sessione |
| PATCH/DELETE | `/api/v1/workouts/{id}` | Modifica / elimina sessione |
| POST | `/api/v1/workouts/{id}/complete` | Segna sessione completata |
| POST/PATCH/DELETE | `/api/v1/blocks` / `/{id}` | CRUD blocchi allenamento |
| POST/DELETE | `/api/v1/exercises` / `/{id}` | CRUD esercizi |
| PATCH | `/api/v1/exercises/{id}` | Aggiorna esercizio |
| GET/POST | `/api/v1/prs` | Personal record |
| PATCH/DELETE | `/api/v1/prs/{id}` | Modifica / elimina PR |
| POST | `/api/v1/loads/calculate` | Tabella percentuali carico |
| GET/POST | `/api/v1/biometrics` | Biometria |
| GET/PUT | `/api/v1/nutrition/targets` | Target nutrizionali |
| GET/POST | `/api/v1/meals` | Log pasti |
| POST | `/api/v1/attachments/upload` | Upload file |
| GET | `/api/v1/insights/summary` | Insight 7 giorni |
| GET | `/api/v1/health` | Health check |

---

## Environment variables

### croc-fit-api/.env.local

```bash
APP_ENV=local
DEBUG=true
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
LLM_PROVIDER=litellm
LITELLM_API_BASE=https://...
LITELLM_API_KEY=...
LITELLM_MODEL=gpt-4o-mini
```

### croc-fit-app/.env.local (or app.config.json)

```bash
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Milestone status

| Milestone | Status |
|---|---|
| M1 — Fondazioni (scaffold + chat SSE) | ✅ |
| M2 — Calendario + sessioni + PR + carichi | ✅ |
| M3 — Biometria + dieta + meal logging | ✅ |
| M4 — Upload attachment + safety guard + test | ✅ |
| M5 — Orchestrator verticali | ❌ non avviato |

---

## Acceptance criteria (MVP)

| AC | Description | Status |
|---|---|---|
| AC-001 | Crea e completa sessione da calendario in < 2 min | ✅ |
| AC-002 | Registra PR e riceve tabella carichi immediata | ✅ |
| AC-003 | Chat risponde con dati reali su 3+ domini | ✅ agent-core attivo |
| AC-004 | Carica immagine e riceve feedback | ✅ |
| AC-005 | Cambio provider LLM da config senza refactor | ✅ LiteLLM via env |
| AC-006 | Dashboard mostra insight 7 giorni | ✅ |

---

## Notes

- **agent-core** è un package privato HNRG-Lab (`v2.0.3`). Richiede accesso al repo `HNRG-Lab/agent-core` tramite SSH o HTTPS autenticato.
- **Supabase Storage bucket** `attachments` deve essere creato manualmente nella dashboard (o via migration).
- **LiteLLM** deve essere configurato e raggiungibile dalla rete dove gira il backend.
- **Deploy backend**: usa `render.yaml` nella root — Render riconosce il Blueprint automaticamente.
- **Build iOS/Android**: usa `croc-fit-app/eas.json`. Profilo `preview` per test su dispositivo fisico.
