# croc-fit-api

FastAPI backend for **CrocFit Coach AI** — Python 3.13, agent-core (LangGraph), Supabase.

## Requirements

- Python 3.13+
- [uv](https://github.com/astral-sh/uv) — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Access to `HNRG-Lab/agent-core` (private package, SSH or HTTPS required)

## Setup

```bash
cp .env.example .env.local
# Fill in SUPABASE_*, LLM_PROVIDER and LLM credentials

uv sync
uv run python -m croc_fit_api.server
# → http://localhost:8000
# → Swagger UI: http://localhost:8000/docs  (only when DEBUG=true)
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | ✅ | `local` / `dev` / `qa` / `production` |
| `DEBUG` | | `true` enables `/docs` + verbose logs |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (backend writes) |
| `LLM_PROVIDER` | ✅ | `ollama` / `litellm` / `groq` / `azure_foundry` |
| `LITELLM_API_BASE` | LiteLLM | Gateway URL |
| `LITELLM_API_KEY` | LiteLLM | API key |
| `LITELLM_MODEL` | LiteLLM | Model name e.g. `gpt-4o-mini` |
| `OLLAMA_BASE_URL` | Ollama | e.g. `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama | e.g. `qwen3:14b` |
| `GROQ_API_KEY` | Groq | API key |
| `GROQ_MODEL` | Groq | e.g. `llama-3.3-70b-versatile` |
| `CORS_ORIGINS` | | JSON array of allowed origins |
| `MAX_UPLOAD_BYTES` | | Default `10485760` (10 MB) |

## Commands

```bash
uv run python -m croc_fit_api.server   # dev server (reload)
uv run ruff check src                  # lint
uv run mypy src                        # type check
uv run pytest                          # tests
uv run pytest --cov=croc_fit_api       # tests + coverage
```

## Project structure

```
src/croc_fit_api/
  api/v1/          REST endpoints (chat, workouts, blocks, exercises, prs, biometrics, nutrition, attachments, insights)
  tools/           LangGraph tools (workouts, prs, biometrics, nutrition, safety)
  connectors/      Supabase client factory
  schemas/         Shared Pydantic models
  errors/          Exception classes + FastAPI handlers
  settings.py      Pydantic-settings configuration
  app.py           FastAPI factory
  server.py        Uvicorn entrypoint
```

## Deploy (Render)

The root `render.yaml` Blueprint configures a free-tier web service.
Set the required secret env vars in the Render dashboard after the first deploy.

```bash
startCommand: uv run uvicorn croc_fit_api.server:app --host 0.0.0.0 --port $PORT
healthCheckPath: /api/v1/health
```
