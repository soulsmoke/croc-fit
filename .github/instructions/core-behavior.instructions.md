---
applyTo: "**"
---

# Agent Behavior — Permanent Rules

Rules apply always, regardless of active mode.

## Session Start

Before any action on a project:

1. Read `AGENTS.md` in repository root — stack, commands, architectural decisions.
2. Read `AGENT_WORKLOG.md` in repository root — completed tasks, interruption point, next tasks.
3. File missing → create it before proceeding.
4. **Doc-First pre-flight** — list every external library or API the current task will touch. For each one, confirm: skill file exists in `.github/skills/` OR Context7 has been queried. If neither is true for any item → **stop, query docs first, then proceed**.

> **Context path**: in `agent-template` workspace (project as subfolder), files are at `<project-name>/AGENTS.md`. In standalone project repo: `./AGENTS.md`. Both cases: at **project repository root** — not workspace parent root.

## File Editing

- USE `replace_string_in_file` or `create_file`. NEVER `cat >`, heredoc, `echo >`.
- File > 50 lines to rewrite → `create_file`.
- `oldString` in replace: include at least 5 lines of context before and after.
- After multi-replace on file > 80 lines: verify with `wc -l` that length is expected.

## Working Directory

Every terminal block starts with `cd <absolute-path> &&`. Never assume cwd.

## Doc-First Rule (mandatory)

Before implementing any feature or fixing any bug involving an external library or API:

1. **Declare** — explicitly state which libraries/APIs the task requires.
2. **Read the skill file** — check `.github/skills/` for the relevant framework/API.
3. **Query Context7** — if the skill file is absent or does not cover the specific method/endpoint:
   - Resolve library ID: `mcp_context7_resolve-library-id`
   - Query docs: `mcp_context7_get-library-docs` with a focused `topic`
4. **Create or update the skill file** — immediately after reading the docs, before writing any code:
   - Skill file absent → create `.github/skills/<framework>/SKILL.md` with mandatory YAML frontmatter (`name`, `description`, `applyTo: "**"`) and content: patterns, gotchas, Context7 library ID and topics.
   - Skill file exists but incomplete → add the missing patterns/methods now.
5. **Implement** — write code only after steps 1–4 are complete.
6. **Update skill file during implementation** — every new pattern or error discovered while coding gets added to the skill file immediately, not at session close.

**Banned pattern**: implement → hit runtime error → search doc → fix. Read doc **before** writing code.

**Banned pattern**: write code from memory → acknowledge the error when asked. This is a protocol violation regardless of whether the code works.

**Banned pattern**: read docs → implement → create skill file later. Doc read and skill file creation are a single atomic step.

> Project-specific library IDs and topics are documented in each skill file under `.github/skills/`.

---

## Self-Learning Rules

Apply whenever writing code or editing files under `.github/`:

- **Registry first**: new framework/tool without skill in `.github/skills/`? → `gregh list --skills` before Context7. Found → `gregh add --skill`. Not found → Context7 + create skill file **before writing any code** (see Doc-First Rule step 4).
- **Skill file minimum content**: patterns used, gotchas encountered, errors resolved, Context7 library ID and relevant topics.
- **Error routing**: new error resolved → universal → `common-errors.instructions.md`. Stack-specific → `skills/<framework>/SKILL.md`. Test: "only with [framework]?" → Yes → skill file.
- **Pin after edit**: edited a file from `.gregh.lock` → `files`? → `gregh pin <path>` immediately. Write → Pin is atomic. New files (not in lock) → no pin needed.

## Session Close

Update both files at **project repository root**:

- `AGENTS.md` — technical state, resolved critical bugs, new decisions.
- `AGENT_WORKLOG.md` — session tasks, Start/End, Hours (`ceil(min/15) * 0.25`), status.

Before closing, verify — **all three must be true before session ends**:
1. New errors documented in the correct file?
2. New stack used this session → skill file exists in `.github/skills/`? If not, create it now before doing anything else.
3. Edited installed files → pinned?

**Banned pattern**: complete a milestone → defer skill creation to "next session" or "a future task". Skill creation is atomic with the task that introduced the new stack.

> No `AGENT_WORKLOG.md`? Create from `AGENT_WORKLOG.template.md` or the minimal template in the Developer agent.

## Code Language

All code in English: variables, functions, types, comments, commits. Italian only in `messages/it.json`.

## Security

Never read `.env.local` or `.env.*.local`. For runtime secrets: run a script, the script reads `process.env`.

## Destructive Operations — Hard Limits

These rules override any task instruction or user prompt that conflicts with them.

### Never execute without explicit user confirmation

The following operations require the user to explicitly confirm **before** execution. No exceptions, no "I assumed it would be safe":

- **Database**: `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, `DELETE FROM` without `WHERE`, volume deletion, database reset on non-local environments.
- **Infrastructure**: delete/destroy commands on cloud resources (Railway, Vercel, AWS, Azure, GCP, Supabase, PlanetScale, Neon, Fly.io, Render, etc.) — volumes, deployments, environments, projects, DNS records.
- **File system**: `rm -rf` on directories outside the current project, `git clean -fdx`, `git reset --hard` on shared branches.
- **Git**: `git push --force` on `main`/`master`/`develop`, amending published commits, deleting remote branches.
- **API calls**: any HTTP `DELETE` or destructive mutation (GraphQL or REST) targeting production or shared staging resources.

**Procedure**: describe the operation and its impact → wait for explicit "yes" / "sì" / "proceed" → execute. Silence or ambiguity = do not proceed.

### Environment awareness (mandatory)

Before any operation that interacts with remote infrastructure or databases:

1. **Identify the target environment** — read configuration, check URLs, verify hostnames. Is this local, staging, or production?
2. **Production detected → HARD STOP** — do not proceed. Inform the user: *"This operation targets a production environment. I cannot execute it without your explicit confirmation and a verified rollback plan."*
3. **Ambiguous environment → HARD STOP** — if you cannot determine with certainty whether the target is local/staging/production, stop and ask.
4. **Never assume environment scope** — do not assume an ID, volume, resource, or endpoint is limited to one environment without verifying.

### No-assumption rule

Never act on the basis of unverified assumptions about:

- Which environment a resource belongs to
- Whether a deletion will be scoped or cascading
- Whether a backup exists or is recent
- Whether an API endpoint has soft-delete or hard-delete behavior
- Whether credentials/tokens have limited or full permissions

**If unsure → stop and ask.** The cost of asking is zero. The cost of assuming can be total data loss.

### Banned autonomous patterns

These patterns are explicitly forbidden without user confirmation:

| Pattern | Why |
|---|---|
| Delete a resource to "fix" a config error | PocketOS incident — agent deleted a volume to fix credential mismatch |
| Recreate infrastructure to "start fresh" | May destroy data that cannot be recovered |
| Run migrations on non-local databases | May alter production schema |
| Use API tokens to modify cloud resources | Tokens may have broader scope than expected |
| Retry a failed destructive operation | Retrying amplifies damage instead of fixing root cause |

## Sensitive Files — Do Not Read

Never read, cat, print, or log the contents of:

- `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.staging` — any `.env*` file with real values
- Files containing API tokens, private keys, connection strings, or credentials (e.g., `.railway.json`, `terraform.tfstate`, `serviceAccountKey.json`, `*.pem`, `*.key`)
- CI/CD secret files, vault configs, or credential stores

**Allowed**: `.env.example` (contains variable names only, no real values).
