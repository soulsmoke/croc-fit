---
applyTo: "**"
---

# Universal Project Conventions

These rules apply to any project regardless of tech stack.
Framework and ORM specific conventions are in skill files (`.github/skills/`).

## New Project Setup (mandatory rules)

Every new project must follow this procedure. No exceptions.

### 1. Detect workspace layout

Before anything else, determine which layout applies:

**Layout A — Standalone repo** (most common with `gregh init`):
The repo IS the project. `.github/` is already at root. Git is already initialized.

```
my-project/          ← git root AND project root
  .git/
  .github/
    PRD.md
    agents/
    instructions/
    skills/
  .vscode/
```

Signals: `.git/` exists at the same level as `.github/`. No parent workspace folder.

**Layout B — Agent-template multi-project workspace** (legacy):
A workspace root contains `.github/` and multiple project subfolders.

```
workspace-root/
  .github/
    PRD.md
  .vscode/
  <name-from-prd>/   ← project scaffolded here
```

Signals: `.github/` parent folder also contains other project subfolders or a `.code-workspace` file.

**Decision rule**: if `.git/` is at the same level as `.github/` → Layout A (scaffold at root). Otherwise → Layout B (scaffold in subfolder).

---

### 2A. Layout A — Scaffold at repo root

Scaffold the framework directly in the repo root (where `.github/` already lives). Do NOT create a subfolder.

```
my-project/
  .github/           ← already present
  src/               ← or app/, depending on framework
  package.json       ← at root
  ...
```

Git is already initialized. After scaffold:

```bash
git add -A
git commit -m "feat: initial scaffold"
```

`.code-workspace` file goes at root: `<repo-name>.code-workspace`.

---

### 2B. Layout B — Scaffold in subfolder

Read `.github/PRD.md` to derive the project name (kebab-case slug).

| PRD — app name            | Subfolder to create |
|---------------------------|---------------------|
| A-Life Medical Report     | `alife-medical-report` |
| Customer Portal Dashboard | `customer-portal` |
| Invoice Generator         | `invoice-generator` |

Scaffold inside the subfolder. Structure:

```
workspace-root/
  <name-from-prd>/   ← project here
    <name-from-prd>.code-workspace
  .github/
    PRD.md
```

Initialize git in subfolder if not already done:

```bash
cd <name-from-prd>
git init -b main
git add -A
git commit -m "feat: initial scaffold"
```

> **Mandatory**: add subfolder to workspace root `.gitignore` immediately to avoid untracked files in the template repo.

Connect remote:

```bash
git remote add origin https://github.com/<org>/<repo>.git
git push -u origin main
```

---

### 3. Commit messages convention

[Conventional Commits](https://www.conventionalcommits.org/)

- `feat:` new feature
- `fix:` bug fix
- `chore:` infrastructure, dependency updates
- `refactor:` refactoring without functional changes
- `test:` adding/modifying tests

### 4. Create VS Code workspace files

#### `.vscode/extensions.json`

Content (recommended extensions list) depends on stack: see corresponding skill for full list.

- **Layout A**: goes at repo root alongside `.github/`
- **Layout B**: goes inside project subfolder

#### `<name-from-prd>.code-workspace`

Paths are relative to file location, so everything points to `"."`. Content of `settings` depends on stack: see corresponding skill for complete JSON.

- **Layout A**: goes at repo root, named after the repo (e.g. `gregh-hub.code-workspace`)
- **Layout B**: goes inside project subfolder, named after the subfolder

### 5. Devcontainer

`gregh init` installs `.devcontainer/devcontainer.json` automatically — core config is merged with the stack-specific overlay (image, ports, extensions). No manual customization needed unless client-specific overrides are required.

Verify the installed file matches the project stack (correct image, ports, extensions). If a client overlay exists, it will be applied on top.

---

### 6. Checklist before starting development

- [ ] Layout detected (A — standalone repo root / B — subfolder)
- [ ] Project scaffolded at correct location (root for Layout A, subfolder for Layout B)
- [ ] Project scaffolded with correct package manager (see stack skill)
- [ ] **yarn 4 configured** with `corepack use yarn@stable` (see Frontend Toolchain section)
- [ ] **EditorConfig present** — `.editorconfig` in project root
- [ ] **ESLint installed and working** — `yarn lint` passes without errors
- [ ] **Prettier installed** — `.prettierrc` + `.prettierignore` present, `yarn prettier:check` passes
- [ ] **Husky configured** — `yarn install` triggers `prepare`, `pre-commit` and `commit-msg` hooks active
- [ ] **Commitlint configured** — `commitlint.config.js` present, commits with wrong format are rejected
- [ ] **lint-staged configured** — `.lintstagedrc.mjs` present
- [ ] **release-it configured** — `.release-it.json` present
- [ ] `git init` + initial commit in subfolder
- [ ] `.vscode/extensions.json` created (see stack skill for extensions list)
- [ ] `<name-from-prd>.code-workspace` created **inside project subfolder** (not in root)
- [ ] `.devcontainer/devcontainer.json` customized for stack (created by `gregh init`, see step 5)
- [ ] `.env.example` versioned with all variables (use template from Environments section)
- [ ] `.env.local` with local secrets (not committed, in `.gitignore`)
- [ ] Dependencies installed + clean build before starting feature development (command depends on stack — see skill)
- [ ] Dev server starts without errors and `curl http://localhost:<PORT>` responds `200` or `307` — a clean build is not enough: some frameworks generate errors visible only at runtime (see stack skill)
- [ ] Stack-specific checklist completed (see stack skill)

---

## Frontend Toolchain (universal — applies to all frontend projects)

Mandatory for all frontend projects. Not optional.

### EditorConfig

`.editorconfig` in root. Ensures indentation and line ending consistency across different editors.

Create `.editorconfig`:

```ini
# .editorconfig
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 4
insert_final_newline = true
trim_trailing_whitespace = true
end_of_line = lf

[*.md]
max_line_length = off
trim_trailing_whitespace = false

[*.json]
indent_size = 4
```

### Package Manager: yarn 4

```bash
corepack enable
corepack use yarn@stable   # sets packageManager in package.json and generates yarn.lock
```

> **Note for frameworks that do not support PnP** (Angular, Vite/CRA, Next.js with some native plugins): create `.yarnrc.yml` with `nodeLinker: node-modules` immediately after, before running `yarn install`.

### ESLint

Official framework plugin: `@angular-eslint`, `eslint-config-next`, `@nuxtjs/eslint-config`. No dedicated plugin → use `eslint` + `typescript-eslint`.

Always install:

```bash
yarn add --dev eslint-plugin-unused-imports eslint-config-prettier
```

`eslint-config-prettier`: removes ESLint rules that conflict with Prettier. **Always last** in config.

Universal rules to include in every ESLint config (in addition to framework-specific rules):

```js
rules: {
    // JavaScript
    'no-unused-vars': 'off',           // delegated to unused-imports plugin
    'prefer-const': 'warn',
    'no-var': 'warn',
    'no-alert': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'quote-props': ['warn', 'as-needed'],
    // TypeScript
    '@typescript-eslint/array-type': ['warn', { default: 'array' }],
    '@typescript-eslint/consistent-type-assertions': [
        'warn',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
    ],
    // Plugin unused-imports
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
    ],
}
```

Mandatory scripts in `package.json`:
```json
"lint": "<framework-specific command>",
"lint:fix": "<framework-specific command> --fix"
```

`yarn lint` must pass without errors before every commit and in CI.

### Prettier

```bash
yarn add --dev prettier @trivago/prettier-plugin-sort-imports
```

Create `.prettierrc` in root (**not** inline in `package.json`):

```json
{
    "bracketSpacing": true,
    "endOfLine": "lf",
    "printWidth": 140,
    "semi": true,
    "singleQuote": true,
    "tabWidth": 4,
    "useTabs": false,
    "trailingComma": "all",
    "plugins": ["@trivago/prettier-plugin-sort-imports"],
    "importOrder": [
        "<THIRD_PARTY_MODULES>",
        "^@/(.*)$",
        "^[./]"
    ],
    "importOrderSeparation": true,
    "importOrderSortSpecifiers": true
}
```

> **Note**: each stack extends `plugins` and `importOrder` in its own skill (e.g. `^react$`, `^next/(.*)$` for Next.js, project-specific aliases). Consult stack skill before finalizing `.prettierrc`.

Add framework-specific `overrides` (e.g. `"parser": "angular"` for Angular `.html`) — see stack skill.

Create `.prettierignore` in root:

```
node_modules
dist
build
.yarn
yarn.lock
package-lock.json
.DS_Store
.env
.env.local
```

> Each stack adds its own specific folders (e.g. `.next/`, `out/`, `.angular/`) — see stack skill.

Mandatory scripts in `package.json`:

```json
"prettier": "prettier --write .",
"prettier:check": "prettier --check ."
```

Run `yarn prettier` immediately after installation to format all existing files.

### Playwright (E2E)

```bash
yarn add --dev @playwright/test
npx playwright install chromium
```

Minimal config (`playwright.config.ts`):
```ts
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:<PORT>' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'yarn start',
    url: 'http://localhost:<PORT>',
    reuseExistingServer: !process.env['CI'],
    timeout: 120000,
  },
});
```

Mandatory script:
```json
"test:e2e": "playwright test"
```

E2E tests (`e2e/` folder) are **mandatory for every feature** — no task is complete without at least one E2E test covering the main flow.

### Husky

```bash
yarn add --dev husky
```

Add `prepare` script in `package.json`:
```json
"prepare": "husky"
```

> With Yarn 4: `prepare` runs from `yarn install`. No `npx husky install` or `husky init`.

Create the two hooks:

**`.husky/pre-commit`**:
```sh
npx lint-staged
```

**`.husky/commit-msg`**:
```sh
unset PREFIX

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

npx commitlint --edit $1
```

> The `NVM_DIR` block is required on macOS when Node.js is managed via nvm — without it the hook cannot find `npx`.

### Commitlint

```bash
yarn add --dev @commitlint/cli @commitlint/config-conventional
```

Create `commitlint.config.js` in root:

```js
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'body-max-line-length': [0, 'always', Infinity],
    },
};
```

Conventional Commits. Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `style`, `perf`, `ci`, `build`, `revert`.

### lint-staged

```bash
yarn add --dev lint-staged
```

Create `.lintstagedrc.mjs` in root:

```js
import path from 'path';

const buildEslintCommand = (filenames) =>
    `eslint --fix ${filenames.map((f) => `"${path.relative(process.cwd(), f)}"`).join(' ')}`;

const config = {
    '*.{js,jsx,ts,tsx}': [buildEslintCommand, 'prettier --write'],
    '*.{json,md,yml,yaml,css,scss}': ['prettier --write'],
};

export default config;
```

### release-it

```bash
yarn add --dev release-it
```

Create `.release-it.json` in root:

```json
{
    "git": {
        "commitMessage": "chore: ${version}"
    },
    "npm": {
        "publish": false
    }
}
```

Mandatory script in `package.json`:
```json
"release": "release-it"
```

`yarn release`: bumps version, creates git tag + `chore: <version>` commit.

### Mandatory quality gate sequence (fixed order)

```
yarn prettier:check  # 1. style — zero unformatted files
yarn lint            # 2. linting — zero errors
yarn type-check      # 3. types — zero TypeScript errors
yarn build           # 4. production build — zero errors
yarn test            # 5. unit/integration — all pass
yarn test:e2e        # 6. E2E — all pass
```

Stop at first failure. Advance only when all gates pass.

---

## Environments (local · dev · qa · prod)

4 standard environments. URLs and specific DBs: in `## Environments` section of PRD. Technical pattern:

| Environment | `NODE_ENV`    | `APP_ENV`    | Description                             |
| ----------- | ------------- | ------------ | --------------------------------------- |
| local       | `development` | `local`      | Local development for single developer  |
| dev         | `development` | `dev`        | Shared development server               |
| qa          | `production`  | `qa`         | Acceptance testing / staging            |
| prod        | `production`  | `production` | Production                              |

### Configuration files

```
.env                 # shared defaults across all environments (versioned, NO secrets)
.env.example         # template with all required variables + mock values (versioned)
.env.local           # developer's local secrets — overrides everything (gitignored)
.env.development     # public config for local/dev env (versioned)
.env.qa              # public config for qa env (versioned)
.env.production      # public config for prod env (versioned)
```

> Framework loads `.env.<NODE_ENV>` automatically. `APP_ENV` distinguishes local/dev and qa/prod. `.env.qa` not loaded automatically: variables injected by CI/CD.

### `.env.example` (minimal template to version)

```bash
# App
APP_ENV=local
APP_URL=http://localhost:3000
SESSION_SECRET=change-me

# Add stack-specific variables (DB, auth, API keys)
# Complete template in stack skill
```

### Gitignore

Add to `.gitignore`:

```
.env.local
.env.*.local
```

**DO NOT** gitignore `.env.development`, `.env.qa`, `.env.production` — they contain only public URLs and feature flags, no secrets.

### Sensitive file protection (VS Code)

Add to `.vscode/settings.json` in project subfolder:

```json
{
  "files.exclude": {
    "**/.env.local": true,
    "**/.env.*.local": true
  },
  "search.exclude": {
    "**/.env*": true
  }
}
```

Excluded files: do not appear in agent searches (`grep_search`, `file_search`). Agent cannot find them by searching. Soft protection — does not block `read_file` on known path.

Operational rule: agent never reads `.env.local` directly. Secrets needed at runtime → run a script, the script reads `process.env`.

### Environments checklist

- [ ] `.env.example` versioned with all required variables
- [ ] `.env.local` in `.gitignore` (not versioned)
- [ ] Credentials and secrets different for each environment
- [ ] Stack-specific environments checklist completed (see stack skill)

---

> Code language, JSDoc, prop drilling → `conventions-code.instructions.md` (auto-loaded for `.ts`/`.tsx`/`.js`/`.jsx`).

## File Editing (critical rule)

**Never** `cat >`, shell heredoc, `echo >` for code files. Always use:

1. **`replace_string_in_file`** or **`multi_replace_string_in_file`** for partial changes
2. **`create_file`** to create new files
3. **Python `open(..., 'w')`** only as last resort for files > 100 lines

### Duplication risk with `replace_string_in_file`

`oldString` too short → matches multiple occurrences. Tool may fail or duplicate content.

**Preventive rules**:

- Always include **at least 5 lines of context** before and after the target string
- After every edit on files > 80 lines, verify line count with `wc -l` — if higher than expected, file is corrupted
- If file is corrupted (duplicated), truncate with `head -N > /tmp/f && mv /tmp/f file` where N is the line of the last valid closing `}`

---

## Tool Selection Policy (CLI vs MCP)

**Prefer CLI over MCP** for operations executable with a single shell command. MCPs inject tool descriptions into context on every call. More active MCPs = more tokens consumed. CLI: zero cost until invoked.

### Decision rule

| Use CLI (`run_in_terminal`)                         | Use MCP                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `git`, `gh` for standard operations                 | GitHub API with complex structured output (e.g. create PR with multi-section Markdown body) |
| `prisma`, `npx prisma migrate`, `npx prisma studio` | Cloud services with managed OAuth authentication (Vercel, Supabase dashboard)               |
| `yarn`/`npm` for install, build, test               | Tools with persistent state between calls                                                   |
| `psql` for DB queries                               | Integrations requiring delegated authentication                                             |
| File system operations (`ls`, `cat`, `grep`)        | —                                                                                           |
| Build, lint, type-check                             | —                                                                                           |

### Specific rules

- **Git**: CLI for commit, push, branch. MCP only if structured JSON output from GitHub API is needed.
- **Package manager** (`npm`, `yarn`, `pnpm`, etc.): always CLI for install, build, test.
- **Library documentation**: use `mcp_context7_resolve-library-id` + `mcp_context7_query-docs` — no equivalent CLI.
- CLI vs MCP rules for ORM and database are in the stack skill.

### When to disable MCP

Document in project `AGENTS.md`/`CLAUDE.md` which MCPs are needed for which task type, so agent knows when to activate them instead of keeping them always active:

```md
## MCP required per task

- `context7`: always (library documentation)
- `github`: only for PR review and issue management
- Specific skills (e.g. `figma`): only if PRD lists them in MCP Services
```

---

## Testing (universal philosophy)

- **Every feature: at least 1 E2E test.** Task not complete until test exists and passes.
- Selectors in tests: use `data-testid`. Do not depend on translated text.
- Authentication in tests: via fixture, not manual UI flow.
- Test framework config and commands: see stack skill.

### Critical rule: autonomous E2E — no task in pending

Before `npx playwright test`, agent **must**:

1. Verify dev server responds: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
2. If not responding (result `000` or error), start in background and wait until ready
3. Only then run tests

**It is never acceptable** to leave an E2E task in "not executed" state. Dev server = agent dependency, not user dependency.

Permanent solution: `webServer` in `playwright.config.ts` (see `common-errors #27`).

## Working Directory — critical rule

Every terminal command: specify directory explicitly. Never assume correct directory.

```bash
# ✅ Always explicit
cd /path/to/my-project && <pm> build
cd /path/to/my-project && npx playwright test --reporter=line
cd /path/to/my-project && npx prisma migrate dev

# ❌ Dangerous — cwd may be workspace root or another project
<pm> build
npx playwright test
```

Practical rule: every terminal command block must start with `cd <absolute-project-path> &&`. Verify with `pwd` if in doubt before running critical operations (build, migrate, seed, test).

## Folder Structure (universal)

```
<project-root>/
  app/  (or src/, or pages/)   # depends on framework — see skill
  components/                  # UI components
    ui/                        # reusable atomics
  lib/                         # utilities, helpers, config
  services/                    # business logic and data access
  types/                       # shared types
  e2e/                         # E2E tests — mandatory for every feature
```

> Specific structure (e.g. `app/[locale]/`, `prisma/`, `services/api/`) depends on stack: see corresponding skill.

---

## Writing Style — Instructions and Technical Documentation

When writing new files (`.instructions.md`, skills, `common-errors`, `AGENTS.md` sections): use **Caveman Compression**.

**Rules:**

- 1 concept per sentence. 2–7 words per sentence.
- Remove connectives: because, however, therefore, in order to, due to.
- Cause → effect: separate sequential sentences, not compound sentence.
- Preserve: specific numbers, technical terms, code blocks, tables, checklists.
- Do not compress if result is ambiguous.

```
❌ "Before running any command, make sure to read the PRD to get the application name"
✅ "Read PRD. Get app name. Derive slug."

❌ "The agent uses an MCP server for operations that have a direct CLI command — passively consuming tokens"
✅ "Agent uses MCP when CLI equivalent exists. Tokens wasted."

❌ "If during the session you encountered new errors and resolved them, update the framework"
✅ "New error resolved → document."
```
