---
applyTo: "**"
---

# Agent Workflow — Shared Rules

Shared workflow rules for all agent modes. Agent-specific behavior (intent detection, task types) lives in the agent file.

## Core Principle

**Task not done → do not move to next.** Every iteration: code tested and verified.

## Session Start (mandatory)

**Before any other action**, read these files:

```
read AGENTS.md           # repository root — permanent technical state
read AGENT_WORKLOG.md    # repository root — completed tasks and next session
```

- **`AGENTS.md`**: stack, versions, commands, DB URL, env vars, architectural decisions, critical bugs.
- **`AGENT_WORKLOG.md`**: completed tasks, interruption point, pending tasks.

> **Context path**: in `agent-template` workspace, files are at `<project-name>/AGENTS.md`. In standalone repo: `./AGENTS.md`. Always at **project repository root**.

File missing → create it (see "Session Close").

### MCP Setup (mandatory on first session or if `.vscode/mcp.json` missing)

Read **MCP Services** in PRD. Contains exact JSON config.

1. `.vscode/mcp.json` missing → create from PRD.
2. Servers missing → add them.
3. Extra servers not in PRD → do not remove.

### Figma MCP Check (if PRD includes `figma` in MCP Services)

Verify Figma server auth:

1. Server shows **Running** → ok.
2. Shows "Start" → click → authenticate → Allow access.
3. Confirm: `mcp_figma_whoami()` → must return user email.
4. Returns 403 → **HARD STOP** — see `common-errors #32`.

New project: Figma onboarding setup once (see `figma/SKILL.md § 4`).

### Load Stack Skills

Read **Framework** declared in PRD or `AGENTS.md`. Load the corresponding skill file immediately.

**Session start — load immediately:**

| Framework declared in PRD / AGENTS.md  | Skill to load             |
| --------------------------------------- | ------------------------- |
| Next.js                                 | `nextjs/SKILL.md`         |
| Angular                                 | `angular/SKILL.md`        |
| Framework not in this list              | see fallback below ↓      |

#### Auto-install missing skill files

Before loading any skill (at session start or on-demand), verify it exists in `.github/skills/`:

1. File exists → read it immediately.
2. File missing → run autonomously, then read:
   ```bash
   npx @hnrg-lab/gregh add --skill <skill-file>
   ```
3. File not found in registry (command fails) → use Context7 fallback (see below).

**Never ask the user to install skills manually.**

#### Auto-install missing instruction files

Before writing JS/TS code in a project initialized with `core` only, verify `.github/instructions/conventions-code.instructions.md` exists:

1. File exists → already active via `applyTo`.
2. File missing → run autonomously:
   ```bash
   npx @hnrg-lab/gregh add --instruction conventions-code.instructions.md
   ```
3. File not found in registry (command fails) → apply conventions from `conventions.instructions.md` and note in `AGENTS.md`.

**Trigger**: first JS/TS/TSX file written in a `core`-only project.
**Never ask the user to install instruction files manually.**

**On-demand — load only when task requires:**

| Task involves                              | Skill                          |
| ------------------------------------------ | ------------------------------ |
| DB, Prisma, migration, seed                | `prisma/SKILL.md`              |
| Auth, login, sessions                      | `better-auth/SKILL.md`         |
| Tables, sorting, filtering                 | `tanstack-table/SKILL.md`      |
| Component with Figma node ID               | `figma/SKILL.md`               |
| E2E tests, Playwright config               | `playwright/SKILL.md`          |
| Payload CMS, collections, hooks            | `payload-cms/SKILL.md`         |
| D365 Dataverse API                         | `d365-dataverse-api/SKILL.md`  |
| D365 Plugins                               | `d365-plugins/SKILL.md`        |
| D365 Power Automate                        | `d365-power-automate/SKILL.md` |
| D365 JavaScript / web resources            | `d365-javascript/SKILL.md`     |
| D365 admin configuration                   | `d365-admin-config/SKILL.md`   |
| Security audit, OWASP review               | `security-owasp/SKILL.md`      |

Skill = mandatory conventions, commands and patterns for the stack. Read skill before writing code.

> **New project**: `<project-name>/stack.instructions.md` does not exist → generate from skill during scaffolding. Goes in project with `applyTo: "**"`. Auto-injected in future sessions.

#### Fallback — framework without skill file

1. Use Context7: `resolve-library-id` + `get-library-docs` for framework, test runner, main tools.
2. Apply universal `conventions.instructions.md`.
3. Report: *"No skill file for [framework]. Using Context7. Skill file created at end of task (step 8b)."*
4. End of task (step 8b): create `.github/skills/<framework>/SKILL.md` with mandatory YAML frontmatter and learned patterns — do not postpone to session close.

> Skill file created this way is **project-specific** — it lives in `.github/skills/` but is not in the registry.
> Do NOT run `gregh add --skill` for it (the file does not exist in the registry).
> The file will not be updated by `gregh sync`. This is intentional.

## Quality Gate

Run **in order**, stop at first failure:

```
1. lint              # style errors (eslint, pylint, golangci-lint… — see skill/AGENTS.md)
2. type-check        # type checking (tsc, mypy, go vet… — see skill/AGENTS.md)
3. build             # production build — zero errors
4. test              # unit/integration tests
5. test:e2e          # E2E — if applicable to stack
6. visual regression # only if task implemented a component with Figma node ID
                     # see figma/SKILL.md § 9 — Design Conformance
7. security check    # verify security.instructions.md rules on new/changed code
                     # auth on new endpoints, no hardcoded secrets, input validation
```

Exact commands in stack skill or `AGENTS.md`.

**Fail-fast**: step fails → fix before advancing.

## Knowledge Base (mandatory self-learning gate)

Before marking any task complete, execute ALL applicable actions:

**a. Error documentation** — New error type resolved during this task? Document it **now**:
- Universal / cross-stack (file editing, CWD, MCP vs CLI, agent behavior) → numbered entry in `common-errors.instructions.md`
- Web/JS-specific → `web/instructions/common-errors-web.instructions.md`
- Stack-specific + skill file exists → add to the skill file's ⚠️ Critical Rules section. **Never in `common-errors`.**

> Decision rule: "can this error only happen with [framework/tool]?" → Yes → skill file.

**b. New skill creation** — Task used a framework/tool/library that has **no skill file** in `.github/skills/`?
- Create `.github/skills/<tool>/SKILL.md` with mandatory YAML frontmatter:
  ```yaml
  ---
  name: <Tool Name>
  description: >
    When to load this skill (one sentence, used by Copilot to decide when to activate it).
  applyTo: "**"
  ---
  ```
- Content: commands, patterns learned, critical rules, errors encountered.
- Use `nextjs/SKILL.md` as structure reference for both frontmatter and content.
- **This is mandatory — not optional.** The skill ensures future sessions do not start from zero.

**c. Pin edited files** — After writing to ANY file under `.github/` that was **installed by gregh** (file exists in `.gregh.lock` → `files` section):
```bash
gregh pin <relative-path>
```
- File is in lock → pin after edit. **Always.**
- File is new (created by agent, not in lock) → no pin needed (sync does not track it).
- Quick verify: `gregh status` → "Pinned" section lists all pinned files.

> **Write → Pin is an atomic operation.** Never edit an installed file without immediately pinning it.

## Mark Complete

Task `completed` only when **all conditions are met**:

- [ ] Quality gate passed
- [ ] New errors resolved → documented in correct location? (Knowledge base a)
- [ ] New stack/tool without skill → skill file created? (Knowledge base b)
- [ ] Installed files edited → all pinned? (Knowledge base c)

If any check fails → do it now. Task **cannot** be marked ✅ with missing documentation or unpinned edits.

Record `End: YYYY-MM-DD HH:mm`. Calculate `Hours` in `AGENT_WORKLOG.md`.

**Hours calculation — exact rule**: round to **nearest 0.25h multiple** (= quarter hour).
- Formula: `ceil((End - Start in minutes) / 15) * 0.25`
- Examples: 5 min → **0.25h** | 20 min → **0.5h** | 45 min → **0.75h** | 90 min → **1.5h**
- ❌ Do not use generic decimal rounding: 5 min ≠ 0.1h

## Session Close (mandatory)

At session end (or completed tasks): update both files.

### Update `AGENTS.md`

Technical continuity file. Always reflects current state:

- Stack/versions/commands changed → update.
- New architectural decision → add.
- Critical bug resolved → add to "Critical bugs resolved" with root cause + fix.
- Obsolete info → remove.

If `AGENTS.md` does not exist (e.g. new project), create with this minimal template:

```markdown
# AGENTS.md — <project-name>

## Stack

- Language, framework, version, relevant notes

## Commands

- Dev: `<start command>`
- Build: `<build command>`
- Type check: `<type check command>`
- Lint: `<lint command>`
- Test: `<test command>`

## Local DB

- URL: `<db connection string>`

## Required environment variables

- `APP_ENV`, `DATABASE_URL`, ...

## Architectural decisions

- ...

## Critical bugs resolved

- **Bug name**: root cause + applied fix

## Required MCP

- context7: always
- figma: only for tasks with Figma node ID (if applicable)
```

### Update `AGENT_WORKLOG.md` (repository root)

1. New entry `## Session YYYY-MM-DD`.
2. Each task: number, description, modified files, Start, End, Hours (`ceil(min/15) * 0.25`), status ✅.
3. Final build/type-check output.
4. "Next session — To do": open tasks + notes for next agent.

> If project has no `AGENT_WORKLOG.md`, create it using `AGENT_WORKLOG.template.md` (if available) or the minimal template in session format above.

**Session entry format:**

```markdown
## Session YYYY-MM-DD — Completed ✓

### Objective

Brief description of the task assigned by the user.

### Completed tasks

| #   | Task             | Modified files      | Start            | End              | Hours | Status |
| --- | ---------------- | ------------------- | ---------------- | ---------------- | ----- | ------ |
| 1   | Task description | `path/to/file.py`   | YYYY-MM-DD HH:mm | YYYY-MM-DD HH:mm | 0.0h  | ✅     |

### Final build status

\`\`\`
✓ lint — 0 errors
✓ build — OK
✓ tests — all pass
\`\`\`

### Next session — To do

- [ ] Any open task
```

> If session interrupted before completion, write partial state with ⏸️ instead of ✅ for incomplete tasks, so next session knows where to resume.
> Root causes and permanent technical notes go in `AGENTS.md`, not the worklog.

### Self-learning gate (blocking)

Verify that Knowledge Base was completed for every task in this session:

- a: errors documented in correct location?
- b: skill files created for new stacks?
- c: edited installed files pinned?

Any skipped → complete now. Session cannot close with missing self-learning.

## Behavior Rules

- **Autonomy**: fix bugs without confirmation. Problem → solve.
- **No partials**: task complete = code tested + working.
- **Read first**: `read` always before editing.
- **Track progress**: `todo` updated in real time (in-progress → completed immediately).
- **Build/test errors**: analyze stack trace → root cause → fix. Never ignore.
- **Side effects**: change breaks something else → fix before advancing.

## Context Rot — Prevention

Long sessions accumulate tool output and stale files. Reasoning quality degrades.

**Rules:**

1. **Checkpoint every 3 tasks**: re-read `AGENTS.md` + `AGENT_WORKLOG.md`. Reset mental model of project.
2. **Stale files**: file read then modified → re-read before next edit on that file.
3. **Truncate terminal output**: `2>&1 | tail -50` for build. `--reporter=line` for test runners. Do not process >50 lines of output.
4. **Minimum scope**: open only files necessary for current task. Do not explore beyond.
5. **Long sessions**: tasks exceed 6 → suggest to user to split by domain (DB+API · UI · test).

## Accessibility (WCAG 2.1 AA)

> **Apply only if project has a frontend UI.** Skip for pure API, CLI or backend services.

Every UI component written **must** follow these rules without exception.

### Core Rules

1. **Images**: descriptive `alt`; decorative: `alt="" aria-hidden="true"`
2. **Icon-only button**: `<button aria-label="Close" type="button"><Icon aria-hidden /></button>`
3. **Icon-only link**: `<a href="..." aria-label="Go to profile"><Icon aria-hidden /></a>`
4. **Text links**: meaningful text (not "here", not "click")
5. **Form fields**: every input has `<label>` or `aria-label`; never placeholder only
6. **Form errors**: `aria-invalid="true"` + `aria-describedby` on error message
7. **Dialog/Modal**: `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, focus trap
8. **Toast/Alert**: `role="alert"` for urgent errors; `role="status"` for confirmations
9. **Semantic HTML**: `<nav>`, `<main>`, `<header>`, `<footer>`; headings h1→h2→h3 without skips
10. **Contrast**: normal text ≥ 4.5:1; large text ≥ 3:1

### Checklist Before Marking Complete

- [ ] All images have `alt`
- [ ] All icon-only buttons have `aria-label`
- [ ] Every form field has associated `<label>`
- [ ] Dialogs have `aria-modal`, `aria-labelledby`
- [ ] Feedback (toast, errors) have appropriate `role`
- [ ] Focus visible and keyboard navigation working

## Constraints

- DO NOT ask confirmation for obvious fixes or standard technical decisions.
- DO NOT leave code with failing tests.
- DO NOT advance if current task is not verified.
- DO NOT invent tests that always pass — they must be meaningful.
- DO NOT ignore compiler/linter warnings that indicate real problems.

> Secrets handling and code language rules are in `core-behavior.instructions.md`. Security rules are in `core-security.instructions.md`.

## ⚠️ Critical Rules — Learned from Real Errors

### File editing

- **ALWAYS USE** dedicated file edit tools to modify/create source files
- **NEVER** use `cat >`, shell heredoc (`<< 'EOF'`), `echo >` to write code files — they corrupt content
- File needs complete rewrite (>50 lines) → use `create_file` not terminal
- For existing files with residual/corrupted content, use language-appropriate file write as last resort
- **Beware of multi-replace with overlapping patterns** — can leave duplicate content or truncate file; after every multi-replace verify file is syntactically correct

### Code Documentation

- Every exported function, class or public module **must** have documentation in English
- Use the format appropriate for the stack: JSDoc for TypeScript/JavaScript, docstrings for Python, godoc for Go
- Document **behavior**, not type — type is already in the signature
- Use `@throws` / `raises` / `error` if the function can throw or raise exceptions

### i18n

Universal rule: **never hardcode user-visible UI text** — always use translation files. Specific conventions (hooks, folder structure, routing) are in the stack skill.
