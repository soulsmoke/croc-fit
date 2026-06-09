# AGENTS.md — croc-fit

## Stack

- **Frontend**: Expo SDK 54 + React Native + expo-router (croc-fit-app/)
- **Backend**: Python 3.13 + FastAPI + agent-core (croc-fit-api/)
- **DB/Auth/Storage**: Supabase (Postgres + Auth + Storage + Realtime)
- **LLM Gateway**: LiteLLM (cloud-first, provider-agnostic)
- **Agent framework**: LangGraph via agent-core

## Project structure

```
croc-fit/
  croc-fit-api/     FastAPI backend + agent-core
  croc-fit-app/     Expo React Native frontend
  supabase/         SQL migrations + seed
```

## Commands

### Backend (croc-fit-api/)
- Dev: `uv run python -m croc_fit_api.server`
- Lint: `uv run ruff check .`
- Type check: `uv run mypy src/`
- Test: `uv run pytest`
- Install: `uv sync`

### Frontend (croc-fit-app/)
- Dev: `yarn start` or `yarn android` / `yarn ios` / `yarn web`
- Lint: `yarn lint`
- Type check: `yarn type-check`
- Test: `yarn test`

## Local DB

- Supabase local: `npx supabase start`
- URL: `http://localhost:54321`
- Anon key: see `supabase start` output
- Service role key: see `supabase start` output

## Required environment variables

### croc-fit-api/.env.local
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `LLM_PROVIDER` — `ollama` | `litellm` | `groq`
- **Ollama (locale)**: `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_MODEL=qwen3.5:9b`
- **LiteLLM**: `LITELLM_API_BASE`, `LITELLM_API_KEY`, `LITELLM_MODEL`
- **Groq**: `GROQ_API_KEY`, `GROQ_MODEL`
- `APP_ENV` (local | dev | qa | production)

### croc-fit-app/.env.local
- `EXPO_PUBLIC_API_URL` (backend URL, e.g. http://localhost:8000)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Architectural decisions

- Single generalista agent (MVP) con tool verticali per workout, PR, biometria, dieta
- LiteLLM come gateway — zero-code model switch (NFR-003, REQ-026)
- Supabase service_role per write lato backend; anon key solo per auth/read frontend
- SSE streaming via `astream_events` (LangGraph v2)
- agent-core GenericTemplate esteso come FitnessCoachTemplate
- Layout A: repo root = progetto, no subfolder extra

## Critical bugs resolved

_Nessuno ancora — nuovo progetto._

## Required MCP

- context7: sempre (documentazione librerie)
- supabase: solo per operazioni DB remote
