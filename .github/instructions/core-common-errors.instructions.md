---
applyTo: "**"
---

# Common Errors and Verified Fixes

Registry of **universal** agent behavior errors — problems that occur regardless of stack.
Stack-specific errors belong in the respective skill files.

---

## 1. File corruption via terminal or misconfigured replace

**Error A**: Using `cat > file.ts << 'EOF'` or `echo "..." > file.ts` in zsh terminal produces corrupted output (character duplication, mixed text) when content includes quotes or special characters.

**Error B**: `replace_string_in_file` with `oldString` too short matches multiple occurrences — tool replaces the first and leaves the second unchanged → file contains old code twice after the new block.

**Symptom of error B**: `wc -l file.tsx` returns a much higher number than expected; `get_errors` reports errors at lines that do not exist in the written code.

**Fix**:

- Never use shell heredoc to write source files — use `create_file` or `replace_string_in_file`
- `oldString` must include **at least 5 lines of context** before and after the target text
- After every edit on files > 80 lines, verify with `wc -l` that length is as expected
- If file is corrupted (duplicated), truncate with: `head -N > /tmp/f && mv /tmp/f file` where N is the line after the last valid closing delimiter
- If shell is strictly necessary: `python3 -c "open('file','w').write(...)"`

---

<!-- Errors #2–#4: Prisma-specific → prisma/SKILL.md -->
<!-- Errors #5–#9: Next.js-specific → nextjs/SKILL.md -->
<!-- Errors #10–#14: Web/JS-specific → web/instructions/common-errors-web.instructions.md -->

<!-- Errors #15–#24: Next.js (#14–#17, #30), Playwright (#18–#23), Prisma (#24) → respective skill files -->
<!-- Error #26: Figma-specific → figma/SKILL.md -->

## 25. MCP server used when equivalent CLI exists (token waste)

**Error**: Agent uses MCP when equivalent CLI exists. Context window tokens wasted.

**Cause**: MCPs inject tool descriptions into context on every call, even when unused. Fixed cost for every active MCP.

**Fix**: Prefer CLI for all standard stack operations:

```bash
# ✅ CLI — zero context cost until invoked
npx prisma migrate dev
npx prisma studio
git add -A && git commit -m "feat: ..."
gh pr create --title "..." --body "..."
yarn build && yarn test

# ❌ MCP — context cost even when unused
# mcp_prisma_migrate, mcp_github_create_pr, etc.
```

Use MCP only when no practical CLI alternative exists: library documentation (`context7`), delegated OAuth auth for cloud services, complex structured JSON output from remote APIs. See `conventions.instructions.md → Tool Selection Policy` for full table.

---

## 27. E2E tests left pending without verifying dev server is running

**Error**: E2E tests fail or are not executed because dev server is not started. Task remains pending until user intervenes.

**Cause**: Server not verified before tests. `npx playwright test` run without checking `http://localhost:3000`.

**Fix**: Before every `npx playwright test`, verify server is active:

```bash
# 1. Check if server responds
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/

# 2. If returns 000 or connection error: start in background
yarn dev &
# or: use webServer in playwright.config.ts (permanent solution)

# 3. Wait until ready before running tests
```

Permanent solution: configure `webServer` in `playwright.config.ts` so Playwright manages server lifecycle automatically:

```ts
webServer: {
  command: "yarn dev --port 3000",
  url: "http://localhost:3000",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
},
```

**Rule**: Never leave an E2E task in "not executed" state. Server not running → start it and retry. Do not wait for user.

---

<!-- Errors #29, #31–#37: Figma MCP-specific → figma/SKILL.md -->

## 28. Terminal commands run from wrong directory

**Error**: Agent runs commands (`yarn build`, `npx playwright test`, `npx prisma migrate`) from workspace root (`/agent/`) or another project folder instead of current project directory.

**Cause**: `cd <project>` missing before command. CWD lost in previous terminal session.

**Fix**: Every command must be preceded by explicit `cd`, or use absolute path:

```bash
# ✅ Always specify directory
cd /Users/.../alife-medical-report-v2 && yarn build
cd /Users/.../alife-medical-report-v2 && npx playwright test --reporter=line

# ❌ Never assume you are already in the right directory
yarn build   # may run in /agent/ or in /my-app/
```

Practical rule: before every terminal command block, **verify** cwd with `pwd` or prepend `cd` explicitly. Absolute paths preferred for critical commands (build, migrate, seed, test).

---

<!-- Error #38: Next.js 16 params/searchParams async — breaking change → nextjs/SKILL.md ⚠️ Critical Rules -->

## 39. UI stub handlers (`console.log` / `// TODO`) delivered as complete feature

**Error**: A handler like `handleSave`, `handleApprove`, `handleDelete` is created with only `console.log(...)` or a `// TODO` comment, task is marked complete, and user finds buttons do nothing.

**Root cause**: E2E tests cover navigation but do not verify that actions produce an observable effect (API call, UI update, toast).

**Rule**:

- Handler with `console.log`, `void x`, `// TODO` = **incomplete**. Do not mark complete.
- Task with UI button/action — verify: API route exists + responds, handler calls API, UI has visible feedback.
- API route missing → task **not completable**. Report as blocker.

**Quick fix** (stubs delivered by mistake):

1. `grep -rn "console.log\|// TODO" components/`
2. Implement each handler calling the API route.
3. Add UI feedback (`toast`, `isSaving`, local state update).
4. E2E test verifying visible effect.

---

<!-- Error #40: UI actions without visible feedback → web/instructions/common-errors-web.instructions.md -->
<!-- Error #41: next-intl middleware rewrites /api/ → nextjs/SKILL.md -->
<!-- Errors #42–#44: Payload CMS → payload-cms/SKILL.md -->
<!-- Errors #45–#46: Next.js 16 proxy.ts, next-intl v4 → nextjs/SKILL.md -->
