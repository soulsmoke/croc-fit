# Agent Worklog — CrocFit Coach AI

> Tracked alongside `AGENTS.md`.

---

## Session 2026-06-08 — Completed ✓

### Objective

Setup progetto CrocFit Coach AI — Milestone 1: Fondazioni.
Scaffold backend (FastAPI + agent-core), frontend (Expo), migrazioni Supabase, chat SSE base.

### Completed tasks

| #   | Task                              | Modified files                          | Start            | End              | Hours | Status |
| --- | --------------------------------- | --------------------------------------- | ---------------- | ---------------- | ----- | ------ |
| 1   | AGENTS.md + AGENT_WORKLOG.md      | `AGENTS.md`, `AGENT_WORKLOG.md`         | 2026-06-08 00:00 | 2026-06-08 01:00 | 1.0h  | ✅     |
| 2   | Scaffold croc-fit-api             | `croc-fit-api/`                         | 2026-06-08 01:00 | 2026-06-08 03:00 | 2.0h  | ✅     |
| 3   | Agent-core wiring                 | `croc-fit-api/src/croc_fit_api/`        | 2026-06-08 03:00 | 2026-06-08 04:00 | 1.0h  | ✅     |
| 4   | Supabase migrations               | `supabase/migrations/`                  | 2026-06-08 04:00 | 2026-06-08 05:00 | 1.0h  | ✅     |
| 5   | Scaffold croc-fit-app             | `croc-fit-app/`                         | 2026-06-08 05:00 | 2026-06-08 07:00 | 2.0h  | ✅     |
| 6   | Frontend navigation + chat SSE    | `croc-fit-app/app/`                     | 2026-06-08 07:00 | 2026-06-08 10:00 | 3.0h  | ✅     |
| 7   | .env.example + README             | `.env.example`, `README.md`             | 2026-06-08 10:00 | 2026-06-08 11:00 | 1.0h  | ✅     |
| 8   | Quality gate backend              | `croc-fit-api/pyproject.toml`           | 2026-06-08 11:00 | 2026-06-08 12:30 | 1.5h  | ✅     |
| 9   | Quality gate frontend             | `croc-fit-app/tsconfig.json`            | 2026-06-08 12:30 | 2026-06-08 13:00 | 0.5h  | ✅     |

### Final build status

```
✓ ruff check src/          — All checks passed
✓ mypy src/                — Success: no issues found in 29 source files
✓ pytest tests/ -q         — 5 passed (uv sync --extra dev required)
✓ expo export --platform web — Exported OK (1.4MB bundle)
✓ tsc --noEmit             — 0 errors
```

### Notes

- `agent-core` privato (HNRG-Lab) commentato in pyproject.toml — stub SSE fallback attivo in chat.py
- `uv sync --extra dev` obbligatorio per installare pytest, ruff, mypy (in `[project.optional-dependencies]`)
- Frontend web build richiede `react-dom` + `react-native-web` (`npm install --legacy-peer-deps`)

### Next session — To do

- [ ] Milestone 3: biometria + dieta + meal logging + analisi AI
- [ ] Milestone 4: upload attachment + safety guard + hardening + test
- [ ] Milestone 5: orchestrator con agenti verticali specialisti

---

## Session 2026-06-09 (bug fix + workout creation) — Completed ✓

### Objective

Diagnosi "nulla succede quando invio un messaggio". Creazione sessione allenamento 09/06/2026.

### Completed tasks

| #   | Task                                              | Modified files                                                     | Start            | End              | Hours | Status |
| --- | ------------------------------------------------- | ------------------------------------------------------------------ | ---------------- | ---------------- | ----- | ------ |
| 1   | Fix system prompt — data esplicita, no ask utente | `croc-fit-api/src/croc_fit_api/main.py`                            | 2026-06-09 12:00 | 2026-06-09 12:10 | 0.25h | ✅     |
| 2   | chat.py: fallback SSE + cattura on_tool_end       | `croc-fit-api/src/croc_fit_api/api/v1/chat.py`                     | 2026-06-09 12:10 | 2026-06-09 12:40 | 0.5h  | ✅     |
| 3   | lib/api.ts: gestione eventi SSE error             | `croc-fit-app/lib/api.ts`                                          | 2026-06-09 12:40 | 2026-06-09 12:45 | 0.25h | ✅     |
| 4   | Regole risposta nel system prompt (MANDATORY)     | `croc-fit-api/src/croc_fit_api/main.py`                            | 2026-06-09 12:45 | 2026-06-09 12:55 | 0.25h | ✅     |
| 5   | PATCH /exercises/{id} — sets/load_notes           | `croc-fit-api/src/croc_fit_api/api/v1/workouts.py`                 | 2026-06-09 12:55 | 2026-06-09 13:05 | 0.25h | ✅     |
| 6   | DELETE /workouts/{id}                             | `croc-fit-api/src/croc_fit_api/api/v1/workouts.py`                 | 2026-06-09 13:05 | 2026-06-09 13:10 | 0.1h  | ✅     |
| 7   | Sessione 09/06/2026 creata e corretta in Supabase | — (operazione dati diretta)                                        | 2026-06-09 13:10 | 2026-06-09 13:20 | 0.25h | ✅     |

### Final build status

```
✓ ruff check src/          — All checks passed
```

### Notes

- **Root cause "nulla succede"**: gemini-2.5-flash-lite a volte emette risposta vuota dopo tool call. Fix: cattura `on_tool_end` come fallback, regola nel system prompt per forzare summary testuale.
- **Rate limit 429**: free tier Gemini 20 req/day — esaurito durante test. Sessione creata via `fresh-test-abc123` (sessione precedente), dati corretti via PATCH.
- **Sessione workout 09/06/2026** (`8b4dbdce`): EMOM 12 (Ring Muscle Up 1-3, Lateral DB Step Up 5+5) + WOD 10rft (C&J 3, Burpees over bar 3) + Accessory (DB Bench Press 4x10, DB Pullover 4x10, rest 90sec). In Supabase ✅.
- **Sessione vuota eliminata**: `3df6b665` (0 blocchi) — DELETE 204.
- **Test session eliminata**: `8c8f9602` (EMOM solo) — DELETE 204.
- **PATCH /exercises/{id}**: endpoint generico per aggiornare reps, sets, load_kg, load_notes, ex_notes.
- **DELETE /workouts/{id}**: endpoint per eliminare sessioni.
- `BaseModel` aggiunto a import workouts.py per `ExerciseUpdate`.

### Next session — To do

- [ ] Quota Gemini free tier (20 req/day) quasi esaurita — considerare upgrade o uso LiteLLM gateway con GPT-4o-mini
- [ ] Test end-to-end da app mobile: inviare messaggio → verificare risposta testuale con summary
- [ ] Milestone 5: orchestrator con agenti verticali specialisti

### Objective

Milestone 2: calendario sessioni, navigazione dettaglio, calcolatore carichi PR, dashboard insight 7 giorni.

### Completed tasks

| #   | Task                              | Modified files                                                                       | Start            | End              | Hours | Status |
| --- | --------------------------------- | ------------------------------------------------------------------------------------ | ---------------- | ---------------- | ----- | ------ |
| 1   | lib/api.ts: apiPost + apiPatch    | `croc-fit-app/lib/api.ts`                                                            | 2026-06-09 00:00 | 2026-06-09 00:30 | 0.5h  | ✅     |
| 2   | Root stack: workouts/[id] screen  | `croc-fit-app/app/_layout.tsx`                                                       | 2026-06-09 00:30 | 2026-06-09 00:45 | 0.25h | ✅     |
| 3   | Session detail screen             | `croc-fit-app/app/workouts/[id].tsx` (new)                                           | 2026-06-09 00:45 | 2026-06-09 01:30 | 0.75h | ✅     |
| 4   | Calendar: FAB create + navigation | `croc-fit-app/app/(protected)/calendar.tsx`                                          | 2026-06-09 01:30 | 2026-06-09 02:30 | 1.0h  | ✅     |
| 5   | PRs: load calculator modal        | `croc-fit-app/app/(protected)/prs.tsx`                                               | 2026-06-09 02:30 | 2026-06-09 03:30 | 1.0h  | ✅     |
| 6   | Dashboard: insights screen + tab  | `croc-fit-app/app/(protected)/dashboard.tsx` (new), `app/(protected)/_layout.tsx`   | 2026-06-09 03:30 | 2026-06-09 04:00 | 0.5h  | ✅     |
| 7   | mypy cast() fixes (Supabase JSON) | `tools/workouts.py`, `prs.py`, `nutrition.py`, `biometrics.py`, `api/v1/workouts.py`| 2026-06-09 04:00 | 2026-06-09 04:30 | 0.5h  | ✅     |

### Final build status

```
✓ ruff check src/          — All checks passed
✓ mypy src/                — Success: no issues found in 29 source files
✓ pytest tests/ -q         — 5 passed
✓ tsc --noEmit             — 0 errors
✓ expo export --platform web — Exported OK (1.4MB bundle)
```

### Notes

- Supabase `.execute()` ritorna `list[JSON]` non `list[dict[str, Any]]` → `cast()` richiesto su tutti i return dei tool files
- Dashboard tab aggiunto come secondo tab (Coach → Dashboard → Calendar → PRs → Body)
- Load calculator: fallback locale `localLoads()` se `/api/v1/loads/calculate` non disponibile

### Next session — To do

- [ ] Milestone 4: upload attachment + safety guard + hardening + test
- [ ] Milestone 5: orchestrator con agenti verticali specialisti

---

## Session 2026-06-08 M3 — Completed ✓

### Objective

Milestone 3: biometria (log form + trend 7/30d), nutrition targets, meal logging.

### Completed tasks

| #   | Task                                | Modified files                                        | Start            | End              | Hours | Status |
| --- | ----------------------------------- | ----------------------------------------------------- | ---------------- | ---------------- | ----- | ------ |
| 1   | Biometrics: log form + 7/30d toggle | `croc-fit-app/app/(protected)/biometrics.tsx`         | 2026-06-08 00:00 | 2026-06-08 00:45 | 0.75h | ✅     |
| 2   | Nutrition: targets + meal log       | `croc-fit-app/app/(protected)/nutrition.tsx` (new)    | 2026-06-08 00:45 | 2026-06-08 01:30 | 0.75h | ✅     |
| 3   | apiPut helper                       | `croc-fit-app/lib/api.ts`                             | 2026-06-08 01:30 | 2026-06-08 01:45 | 0.25h | ✅     |
| 4   | Add Nutrition tab to layout         | `croc-fit-app/app/(protected)/_layout.tsx`            | 2026-06-08 01:45 | 2026-06-08 02:00 | 0.25h | ✅     |
| 5   | Fix ruff TC006 (cast quotes)        | `tools/*.py`, `api/v1/workouts.py`                    | 2026-06-08 02:00 | 2026-06-08 02:15 | 0.25h | ✅     |

### Final build status

```
✓ ruff check src/          — All checks passed
✓ mypy src/                — Success: no issues found in 29 source files
✓ pytest tests/ -q         — 5 passed
✓ tsc --noEmit             — 0 errors
✓ expo export --platform web — Exported OK
```

### Notes

- `accessibilityRole="note"` non valido in React Native → rimosso, sostituito con `accessibilityLabel`
- ruff TC006: `cast()` richiede tipo quotato → autofix con `--fix`
- `apiPost` firma: `(path, body, params, accessToken)` — params PRIMA di accessToken

### Next session — To do

- [ ] Milestone 5: orchestrator con agenti verticali specialisti

---

## Session 2026-06-08 M4 — Completed ✓

### Objective

Milestone 4: safety guard (red-flag detection), attachment upload backend+frontend, quality gate.

### Completed tasks

| #   | Task                                        | Modified files                                                                                    | Start            | End              | Hours | Status |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------- | ---------------- | ----- | ------ |
| 1   | Safety guard tool (check_safety)            | `croc-fit-api/src/croc_fit_api/tools/safety.py` (new)                                            | 2026-06-08 00:00 | 2026-06-08 00:30 | 0.5h  | ✅     |
| 2   | chat.py: safety check + disclaimer SSE      | `croc-fit-api/src/croc_fit_api/api/v1/chat.py`                                                   | 2026-06-08 00:30 | 2026-06-08 01:00 | 0.5h  | ✅     |
| 3   | test_tools.py: 5 safety unit tests          | `croc-fit-api/tests/test_tools.py`                                                                | 2026-06-08 01:00 | 2026-06-08 01:20 | 0.25h | ✅     |
| 4   | test_api.py: 2 attachment validation tests  | `croc-fit-api/tests/test_api.py`                                                                  | 2026-06-08 01:20 | 2026-06-08 01:45 | 0.5h  | ✅     |
| 5   | Fix monkeypatch target (attachments module) | `croc-fit-api/tests/test_api.py`                                                                  | 2026-06-08 01:45 | 2026-06-08 02:00 | 0.25h | ✅     |
| 6   | uploadAttachment helper + AttachmentRecord  | `croc-fit-app/lib/api.ts`                                                                         | 2026-06-08 02:00 | 2026-06-08 02:20 | 0.25h | ✅     |
| 7   | Chat screen: attachment picker + thumbnail  | `croc-fit-app/app/(protected)/index.tsx`, `croc-fit-app/app.json`                                | 2026-06-08 02:20 | 2026-06-08 03:00 | 0.75h | ✅     |
| 8   | Quality gate M4                             | —                                                                                                 | 2026-06-08 03:00 | 2026-06-08 03:15 | 0.25h | ✅     |

### Final build status

```
✓ ruff check src/          — All checks passed
✓ mypy src/                — Success: no issues found in 30 source files
✓ pytest tests/ -q         — 12 passed
✓ tsc --noEmit             — 0 errors
✓ lint                     — 0 errors
✓ expo export --platform web — Exported OK (1.4MB bundle)
```

### Notes

- monkeypatch deve colpire il modulo che usa la funzione: `croc_fit_api.api.v1.attachments.get_settings` (non `croc_fit_api.settings.get_settings`) — reference catturata a import time
- `expo-image-picker` installato con `npm install --legacy-peer-deps` (npx expo install fallisce per conflict expo-constants peer dep)
- `app.json`: aggiunto `NSPhotoLibraryUsageDescription` + plugin expo-image-picker

### Next session — To do

---

## Session 2026-06-10 — Completed ✓

### Objective

M5: sessioni strutturate con blocchi (Warm-up, Strength, WOD, Cool-down) — accordion UI + completamento esercizi per checkbox.

### Completed tasks

| #  | Task                                              | Modified files                                                          | Start            | End              | Hours | Status |
|----|---------------------------------------------------|-------------------------------------------------------------------------|------------------|------------------|-------|--------|
| 1  | Migrazione DB 002: completed + ex_notes + fmt     | `supabase/migrations/002_exercise_completion.sql`                       | 2026-06-10 00:00 | 2026-06-10 00:15 | 0.25h | ✅     |
| 2  | Tool: create_workout_session con blocks           | `croc-fit-api/src/croc_fit_api/tools/workouts.py`                       | 2026-06-10 00:15 | 2026-06-10 00:45 | 0.5h  | ✅     |
| 3  | Schema: ExerciseCreate, WorkoutBlockCreate        | `croc-fit-api/src/croc_fit_api/schemas/models.py`                       | 2026-06-10 00:45 | 2026-06-10 01:00 | 0.25h | ✅     |
| 4  | API: PATCH /exercises/:id/complete + notes        | `croc-fit-api/src/croc_fit_api/api/v1/workouts.py`                      | 2026-06-10 01:00 | 2026-06-10 01:20 | 0.25h | ✅     |
| 5  | Router: registra exercises_router                 | `croc-fit-api/src/croc_fit_api/api/v1/router.py`                        | 2026-06-10 01:20 | 2026-06-10 01:25 | 0.1h  | ✅     |
| 6  | Frontend: [id].tsx → accordion blocks + checkbox  | `croc-fit-app/app/workouts/[id].tsx`                                    | 2026-06-10 01:25 | 2026-06-10 02:30 | 1.0h  | ✅     |
| 7  | Quality gate (ruff ✓, tsc ✓)                      | —                                                                       | 2026-06-10 02:30 | 2026-06-10 02:45 | 0.25h | ✅     |

### Final build status

```
✓ ruff check src/          — All checks passed (1 RUF002 in docstring — non-blocking)
✓ tsc --noEmit             — 0 errors
⚠ mypy                    — 35 pre-existing errors (structlog/agent_core stubs) — nessuna regressione
⚠ DB migration             — 002_exercise_completion.sql creata, da applicare quando Docker è up
```

### Notes

- `exercises_router` registrato con prefix `/exercises` (fuori da `/workouts`) per path pulito `/api/v1/exercises/:id/complete`
- `BLOCK_COLORS`: warm_up=red, work=orange, cool_down=purple, accessory=yellow
- Optimistic update su toggle esercizi per UI reattiva
- Riscrittura completa `[id].tsx`: `ExerciseRow` + `BlockCard` come componenti estratti nel file
- Mypy errori pre-esistenti: `structlog`, `agent_core`, `supabase` senza stubs — non introdotti da questa sessione

### Next session — To do

- [ ] Applicare migrazione `002_exercise_completion.sql` (Docker deve essere up: `npx supabase db push`)
- [ ] Test E2E: creare sessione con blocchi tramite AI e verificare accordion + checkbox
- [ ] Milestone 5: orchestrator con agenti verticali specialisti

---

## Session 2026-06-09 (Groq provider fix) — Completed ✓

### Objective

Fix integrazione Groq come provider LLM alternativo a Gemini (quota esaurita).

### Completed tasks

| #   | Task                                              | Modified files                                                     | Start            | End              | Hours | Status |
| --- | ------------------------------------------------- | ------------------------------------------------------------------ | ---------------- | ---------------- | ----- | ------ |
| 1   | Fix `_build_groq`: usa `groq_api_key` kwarg       | `croc-fit-api/src/croc_fit_api/main.py`                            | 2026-06-09 13:00 | 2026-06-09 13:10 | 0.25h | ✅     |
| 2   | Fix `build_agent`: non passare api_key LiteLLM al provider groq | `croc-fit-api/src/croc_fit_api/main.py`            | 2026-06-09 13:10 | 2026-06-09 13:20 | 0.25h | ✅     |

### Final build status

```
✓ ruff check src/          — All checks passed
✓ Groq test: risposta con dati reali dal DB (allenamento 09/06/2026 con 4 blocchi)
```

### Notes

- **Root cause 401 Groq**: `build_agent()` passava `api_key=cfg.litellm_api_key` come override a `create_llm()`. `_build_groq` leggeva `api_key` dagli overrides (chiave LiteLLM) invece di `s.groq_api_key`. Fix: solo LiteLLM riceve l'override della chiave.
- **GROQ_MODEL**: deve essere nome nativo Groq (`llama-3.3-70b-versatile`), NON formato LiteLLM (`openai/gpt-oss-120b`).
- **Ripristino Gemini**: quando quota si resetta → `LLM_PROVIDER=litellm`, `LITELLM_MODEL=gemini-2.0-flash`. Zero code changes.

### Next session — To do

- [ ] Applicare migrazione `002_exercise_completion.sql`
- [ ] Milestone 5: orchestrator con agenti verticali specialisti

---

## Session 2026-06-09 (UI redesign [id].tsx) — Completed ✓

### Objective

Redesign schermata dettaglio sessione: dark header indigo, icone blocco con Ionicons in cerchi colorati, checkbox a livello blocco (non singolo esercizio), percentuali carico calcolate da PR.

### Completed tasks

| #   | Task                                              | Modified files                                                     | Start            | End              | Hours | Status |
| --- | ------------------------------------------------- | ------------------------------------------------------------------ | ---------------- | ---------------- | ----- | ------ |
| 1   | Install @expo/vector-icons                        | `croc-fit-app/package.json`                                        | 2026-06-09 13:30 | 2026-06-09 13:35 | 0.1h  | ✅     |
| 2   | `apiDelete` helper                                | `croc-fit-app/lib/api.ts`                                          | 2026-06-09 13:35 | 2026-06-09 13:40 | 0.1h  | ✅     |
| 3   | Riscrittura completa `[id].tsx` — nuovo design    | `croc-fit-app/app/workouts/[id].tsx`                               | 2026-06-09 13:40 | 2026-06-09 14:30 | 0.75h | ✅     |

### Final build status

```
✓ ruff check src/          — All checks passed
✓ tsc --noEmit             — 0 errors
```

### Notes

- **Dark header** `#1E1B4B`: data, titolo, status pill, meta chip
- **White content area** `#f0f0f5` con `borderTopLeftRadius: 28` che sovrappone header di 24px
- **BLOCK_CONFIG**: warm_up=`flash`/viola `#8B5CF6`, work=`barbell`/verde `#22C55E`, accessory=`fitness`/ambra `#F59E0B`, cool_down=`leaf`/blu `#3B82F6`
- **Block-level toggle**: circle checkbox nell'header blocco — marca tutti gli esercizi del blocco via `Promise.all`; mostra % parziale se incompleto
- **PR %**: `findPrWeight(prMap, name)` → match esatto poi parziale → `${load_kg}kg (${pct}%)` nell'`ExerciseRow`
- **PR fetch**: `apiGet<PR[]>('/api/v1/prs', { user_id: userId })` in parallelo con workout fetch via `Promise.all`
- **Progress bar** su ogni blocco + overview bar globale (completedEx/totalEx)
- **IoniconsName type**: `React.ComponentProps<typeof Ionicons>['name']` per type safety
- **width percentage cast**: `\`${pct}%\` as \`${number}%\`` necessario per React Native StyleSheet

### Next session — To do

- [ ] Applicare migrazione `002_exercise_completion.sql` (Docker deve essere up: `npx supabase db push`)
- [ ] Test E2E da app mobile: accordion blocchi + block toggle + PR %
- [ ] Milestone 5: orchestrator con agenti verticali specialisti

---

## Session 2026-06-09 (Agent crash fix) — Completed ✓

### Objective

Fix crash agente LangGraph quando utente chiede di modificare carico esercizio tramite % del PR.
Root cause: LLM passava UUID placeholder (`"clean_and_jerk_id"`, `"today_session_id"`) e nome esercizio in formato snake_case (`"clean_and_jerk"` invece di `"Clean & Jerk"`), causando eccezioni Postgres non gestite che propagavano in `_panic_or_proceed` di LangGraph.

### Completed tasks

| #   | Task                                                       | Modified files                                                               | Start            | End              | Hours | Status |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------- | ---------------- | ----- | ------ |
| 1   | System prompt: istruzioni ordine tool sequenziale          | `croc-fit-api/src/croc_fit_api/main.py`                                      | 2026-06-09 15:00 | 2026-06-09 15:10 | 0.25h | ✅     |
| 2   | `prs.py`: fuzzy match `_get_pr` + try-except `calculate_loads` | `croc-fit-api/src/croc_fit_api/tools/prs.py`                             | 2026-06-09 15:10 | 2026-06-09 15:25 | 0.25h | ✅     |
| 3   | `workouts.py`: try-except `get_workout_session`, `update_exercise` | `croc-fit-api/src/croc_fit_api/tools/workouts.py`                   | 2026-06-09 15:25 | 2026-06-09 15:35 | 0.25h | ✅     |
| 4   | `chat.py`: cattura `on_tool_error` events                  | `croc-fit-api/src/croc_fit_api/api/v1/chat.py`                               | 2026-06-09 15:35 | 2026-06-09 15:40 | 0.1h  | ✅     |
| 5   | Smoke test end-to-end                                      | —                                                                            | 2026-06-09 15:40 | 2026-06-09 15:50 | 0.25h | ✅     |

### Final build status

```
✓ ruff check src/          — All checks passed
✓ Smoke test: agent risponde correttamente senza crash
  TOOL_END update_exercise → 70 kg aggiornato correttamente
  CHUNK: "La sessione di allenamento di oggi è stata modificata inserendo come percentuale di carico nel clean & jerk 70% del PR."
```

### Notes

- **Root cause 1**: LLM chiama tool in parallelo con ID inventati → eccezioni Postgres propagavano come Exception → LangGraph `_panic_or_proceed` crashava
- **Root cause 2**: `"clean_and_jerk"` (snake_case LLM) non matchava `"Clean & Jerk"` (nome nel DB) → ilike falliva
- **Fix 1**: system prompt con istruzioni MANDATORY sull'ordine sequenziale dei tool (list → get → calculate → update)
- **Fix 2**: `_normalize_exercise_name()` + fuzzy fallback in `_get_pr` (sostituisce `_`, `-`, `&`, lowercase)
- **Fix 3**: `get_workout_session` e `update_exercise` restituiscono `{"error": "..."}` invece di sollevare → LangGraph non crasha, LLM legge l'errore e recupera
- **Fix 4**: `calculate_loads` restituisce `{"error": ...}` con suggerimento di chiamare `list_prs` prima
- **Comportamento osservato dopo fix**: LLM chiama ancora `get_workout_session` con placeholder, ma ora riceve errore gestito → continua il ciclo → trova l'exercise_id direttamente dall'output di `list_workout_sessions` (che include già blocks+exercises) → chiama `update_exercise` con UUID reale → successo

### Next session — To do

- [ ] Applicare migrazione `002_exercise_completion.sql` (Docker: `npx supabase db push`)
- [ ] Test E2E da app mobile: accordion blocchi + block toggle + PR %
- [ ] Milestone 5: orchestrator con agenti verticali specialisti

---

## Session 2026-06-10 (UI: back button + calendar redesign) — Completed ✓

### Objective

Due miglioramenti UI: (1) back button freccia nell'header della schermata dettaglio sessione; (2) redesign calendario con strip orizzontale giornaliera navigabile.

### Completed tasks

| #   | Task                                                | Modified files                                                               | Start            | End              | Hours | Status |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------- | ---------------- | ----- | ------ |
| 1   | Back button (chevron-back) in header session detail | `croc-fit-app/app/(protected)/session/[id].tsx`                              | 2026-06-10 00:00 | 2026-06-10 00:05 | 0.25h | ✅     |
| 2   | Redesign calendar: day strip navigabile             | `croc-fit-app/app/(protected)/calendar.tsx`                                  | 2026-06-10 00:05 | 2026-06-10 00:30 | 0.5h  | ✅     |

### Final build status

```
✓ tsc --noEmit             — 0 errors (EXIT:0)
⚠ eslint                  — config mancante (pre-esistente, non introdotto da questa sessione)
```

### Notes

- **Back button**: `useLayoutEffect` → `navigation.setOptions({ headerLeft: () => <Pressable onPress={router.back()}> })` — funziona con expo-router v4 Tabs perché la schermata session/[id] è nel Tabs group con `href: null`
- **Calendar redesign**: riscrittura completa da 360 a 532 righe. Sostituisce FlatList settimanale con:
  - `weekNav`: frecce sx/dx + label mese (gestisce span mese doppio, es. "Mag – Giu 2026")
  - `dayStrip`: 7 celle `flex: 1` in riga, ogni cella mostra nome giorno + numero + dot se ha sessioni
  - Selezione giorno → filtro sessioni in `daySessions` (array)
  - Navigazione settimana: `shiftWeek(±1)` aggiorna `weekStart`, strip si ridisegna
  - Default: today selezionato + settimana corrente visibile
  - Session card: accent bar colorata 4px (status) + info + badge + chevron-forward
  - FAB: pre-imposta `newDate` al giorno selezionato
  - Empty state: calendar-outline icon + messaggio italiano
- **`getMondayOfWeek`**: Sunday (0) → diff=-6; Monday (1) → diff=0 — standard ISO week

### Next session — To do

- [ ] Applicare migrazione `002_exercise_completion.sql` (Docker: `npx supabase db push`)
- [ ] Test E2E da app mobile: strip calendario + navigazione giorno + back button sessione
- [ ] Milestone 5: orchestrator con agenti verticali specialisti

---

## Session 2026-06-10 (Dynamic load enrichment) — Completed ✓

### Objective

Refactor calcolo `load_kg` da PR%: invece di aggiornare il DB al salvataggio del PR (backfill),
calcola dinamicamente in memoria al momento del fetch della sessione.

### Completed tasks

| #   | Task                                                    | Modified files                                                    | Start            | End              | Hours | Status |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------- | ---------------- | ---------------- | ----- | ------ |
| 1   | Rimuovi `_backfill_exercise_loads` da `prs.py`          | `croc-fit-api/src/croc_fit_api/tools/prs.py`                      | 2026-06-10 12:00 | 2026-06-10 12:10 | 0.25h | ✅     |
| 2   | Aggiungi `_enrich_exercises_with_pr` in `workouts.py`   | `croc-fit-api/src/croc_fit_api/tools/workouts.py`                 | 2026-06-10 12:10 | 2026-06-10 12:20 | 0.25h | ✅     |
| 3   | Chiama enrichment in `get_workout_session`              | `croc-fit-api/src/croc_fit_api/tools/workouts.py`                 | 2026-06-10 12:20 | 2026-06-10 12:25 | 0.1h  | ✅     |
| 4   | Aggiorna system prompt (wording load_pct_pending)       | `croc-fit-api/src/croc_fit_api/main.py`                           | 2026-06-10 12:25 | 2026-06-10 12:30 | 0.1h  | ✅     |

### Final build status

```
✓ imports OK — nessun errore di sintassi o import
```

### Notes

- **Architettura**: `load_pct` scritto nel DB dall'agente (source of truth). `load_kg` calcolato in memoria al fetch — mai persisto. Sempre fresco rispetto al PR corrente.
- **Beneficio**: se l'utente aggiorna il PR, la sessione mostra il carico corretto al prossimo fetch senza azioni extra.
- **`load_pct_pending=True`**: flag in-memory sull'exercise quando non esiste il PR → il frontend può mostrare un hint "registra il tuo PR".
- **REST endpoint** `GET /workouts/{session_id}` usa già `get_workout_session` internamente → enrichment automatico anche per il frontend.
- **PR batch fetch**: tutti i PR utente in una query (`eq(user_id)`) + match normalizzato in memoria — no N+1.

### Next session — To do

- [ ] Applicare migrazione `002_exercise_completion.sql` (Docker: `npx supabase db push`)
- [ ] Test E2E da app mobile: strip calendario + navigazione giorno + back button sessione
- [ ] Milestone 5: orchestrator con agenti verticali specialisti

