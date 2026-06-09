# PRD — [Application Name]

**Version**: 1.0 — MVP  
**Stack**: [Framework] · [Language] · [Database] · [ORM]  
**Figma**: _Figma file URL (leave blank if not available)_  
**Date**: [Month Year]

---

> **How to use this template**
>
> 1. Copy this file to `.github/PRD.md` in the new project workspace
> 2. Replace all placeholders in square brackets `[...]` with real values
> 3. Remove non-applicable sections (e.g. "MCP Services" if the project has no Figma or is not Next.js)
> 4. Remove this instruction block before sharing the PRD
>
> Sections marked with `<!-- OPTIONAL -->` can be removed if not needed.
> Sections marked with `<!-- MANDATORY -->` must always be present.

---

## Tech Stack <!-- MANDATORY — the agent reads this section to load the correct skills -->

- **Framework**: [e.g. Next.js 16 (App Router)]
- **Backend strategy**: [A — Prisma + PostgreSQL | B — External API | C — BaaS | D — Hybrid]
- **Auth**: [e.g. Better Auth + Microsoft Entra ID SSO]
- **Styling**: [e.g. Tailwind CSS v4]
- **i18n**: [e.g. next-intl (Next.js) | i18next | vue-i18n (Vue) | none]
- **Testing**: [e.g. Vitest + Playwright]

---

## MCP Services <!-- OPTIONAL — include only servers actually used by the project -->

List of MCP servers to configure in `.vscode/mcp.json` for this project.
The agent creates/updates the file at session start if missing or incomplete.

| Server          | npm package                | When to use                                                            |
| --------------- | -------------------------- | ---------------------------------------------------------------------- |
| `figma`         | `figma-developer-mcp`      | Project has a Figma file (design tokens, layout)                       |
| `next-devtools` | `next-devtools-mcp@latest` | Framework is Next.js (remove for other frameworks)                     |
| `context7`      | `@upstash/context7-mcp`    | Always — up-to-date docs for Next.js, Prisma, Tailwind, other libs     |
| `[server-name]` | `[npm-package]`            | [description — when to use it]                                         |

```jsonc
// .vscode/mcp.json — configurazione generata per questo progetto
{
  "servers": {
    // ── Figma (remove if the project has no Figma design) ──────────────────
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--stdio"],
      "env": { "FIGMA_API_KEY": "${input:figma_api_key}" },
    },

    // ── Next.js DevTools (remove if not a Next.js project) ─────────────
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"],
      "type": "stdio",
    },

    // ── Context7 — up-to-date library docs (always include) ─────────────
    "context7": {
      "url": "https://mcp.context7.com/mcp",
    },

    // ── [Add other MCP servers needed by the project] ────────────────────────────
    // "[server-name]": {
    //   "command": "npx",
    //   "args": ["-y", "[npm-package]"],
    //   "type": "stdio",
    // },
  },

  // ── Secret inputs (remove unused ones) ─────────────────────────────
  "inputs": [
    {
      "id": "figma_api_key",
      "type": "promptString",
      "description": "Figma Personal Access Token (figma.com → Settings → Personal access tokens)",
      "password": true,
    },
  ],
}
```

---

## 1. Goal <!-- MANDATORY -->

[Describe in 2-4 sentences what the application does, who it is for, and what problem it solves.
Example: "Build a web application for managing [domain]. [User type] can [main action]. [Secondary user type] can [secondary action]."]

---

## 2. Users and Roles <!-- MANDATORY -->

| Role          | Description                      |
| ------------- | -------------------------------- |
| **[Role 1]**  | [What this role can do]          |
| **[Role 2]**  | [What this role can do]          |

[Describe how authentication works: SSO, email/password, OAuth, etc.]

> **Dev / Local**: [Describe any mock/bypass strategies for local development, e.g. mock auth, seed data, API stubs.]

### Redirect behavior by role <!-- MANDATORY if the app has protected routing -->

> These rules are used by the middleware and page guards. Without them, the agent does not cover edge cases — e.g. unauthorized role redirected to `/login` without MockRoleSwitcher available.

| Evento                           | Ruolo     | Destinazione                   |
| -------------------------------- | --------- | ------------------------------ |
| Login completato                 | [Ruolo 1] | [es. `/dashboard`]             |
| Login completato                 | [Ruolo 2] | [es. `/[risorsa]/[id]`]        |
| Accesso a rotta vietata          | [Ruolo 1] | [es. redirect a `/403`]        |
| Accesso a rotta vietata          | [Ruolo 2] | [es. redirect a `/login`]      |
| Non autenticato → rotta protetta | qualsiasi | [es. `/login?callbackUrl=...`] |

---

## 3. General Layout <!-- MANDATORY -->

### Supported Viewport

- **Desktop** ([breakpoint]+): full layout
- **Tablet** ([breakpoint] – [breakpoint]): [behavior]
- **Mobile**: [in scope / out of scope for v1]

### Application Shell

```
[Insert an ASCII diagram of the main app layout.
Example:]

┌─────────────────────────────────────────────────────────┐
│ [Header / Navbar]                                       │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │              Main Content                    │
│ (left)   │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- **[Zone 1]**: [description and behavior]
- **[Zone 2]**: [description and behavior]
- **[Zone 3]**: [description and behavior]

---

## 4. Features <!-- MANDATORY -->

### 4.1 Authentication

- [Describe auth provider: Better Auth + Microsoft Entra ID, Better Auth email/password, Clerk, Supabase Auth, etc.]
- [Describe the login/logout flow]
- [How roles are assigned to users]

<!-- OPTIONAL — include only if a mock/bypass mechanism exists for development -->

#### Mock Auth for local development

[Describe the mechanism: environment variable, cookie, UI switcher, etc.]

---

### 4.2 [Main Feature Name — e.g. Dashboard, Viewer, Editor...]

[Describe the main feature. Internal structure depends on the project:]

- [Sub-feature or behavior 1]
- [Sub-feature or behavior 2]
- [Any relevant business rules]

<!-- OPTIONAL — include if the project uses Figma as visual reference -->

> **Design**: layouts are retrieved via **Figma MCP**. Figma file: [Figma URL]. Use `mcp_figma_get_figma_data` with the `nodeId` of the specific component before implementing.

<!-- Repeat this section for each relevant feature -->

### 4.3 [Feature 2 Name]

[Description...]

### 4.4 [Feature 3 Name — e.g. Form, Upload, Notifications, Report...]

[Description...]

---

## 4.X Design System <!-- OPTIONAL — include if the project has a Figma with design system -->

**Figma**: [Figma file URL]

### Colors

| CSS Token        | Hex       | Usage              |
| ---------------- | --------- | ------------------ |
| `--color-[name]` | `#XXXXXX` | [Where it is used] |

### Fonts

| CSS Variable        | Font        | Usage              |
| ------------------- | ----------- | ------------------ |
| `var(--font-title)` | [Font name] | [Titles, headlines]|
| `var(--font-body)`  | [Font name] | [Body text, UI]    |

### Implementation Notes

- [Any specific notes on units, spacing, border radius, etc.]

---

## 5. Backend Architecture <!-- MANDATORY -->

### 5.1 Backend Strategy

> **The agent reads this section to decide what to install and how to structure the data layer.**
> Choose one of the 4 strategies and remove the others.

---

#### Strategy A — Prisma + PostgreSQL (full-stack, owned DB)

The framework manages everything: frontend, API layer, and local DB.

```
Next.js App
  └── Server Actions / Route Handlers
        └── Prisma ORM
              └── PostgreSQL (owned)
```

**When to use**: internal apps, SaaS, tools where the project creates and owns the DB schema.

**Agent must**: install Prisma 7, create `prisma/schema.prisma` + `prisma.config.ts`, singleton `lib/prisma.ts`, seed in `prisma/seed.ts`, run `prisma migrate dev`.

---

#### Strategy A2 — Prisma on existing DB (read/write, schema not owned)

The DB already exists and the schema is managed by another team or system. Prisma is used only as a query layer — it does not create or alter tables.

```
Next.js App
  └── Server Actions / Route Handlers
        └── Prisma ORM (query only)
              └── PostgreSQL (existing, managed externally)
```

**When to use**: backend is already in production, the project is added alongside without owning the DB (e.g. front-office portal on ERP DB, dashboard on legacy DB).

**Agent must**: install Prisma 7, run `prisma db pull` to generate `schema.prisma` from the existing schema, create singleton `lib/prisma.ts`. **Never** run `prisma migrate dev` or `prisma migrate deploy` — schema is read-only. **No seed** — real data is already in the DB; use JSON fixtures or MSW for local tests.

**Database URL**: `[Existing DB URL — e.g. postgresql://user:pass@host:5432/dbname]`

> ⚠️ If the DB schema changes, re-run `prisma db pull` to update generated types.

---

#### Strategy B — External API (Next.js as frontend/BFF)

The backend already exists (or is developed by another team). Next.js calls external APIs via a service layer.

```
Next.js App
  └── services/api/     ← typed HTTP client layer
        └── [External Backend] (REST / GraphQL / gRPC)
```

**When to use**: backend is in Laravel, Spring Boot, FastAPI, Go, etc.; the project does not own the DB.

**Agent must**: create `services/api/[resource].ts` with typed fetch, `lib/api-client.ts` as base, `API_BASE_URL` variable in env. No Prisma, no PostgreSQL.

**Endpoint base URL**: `[Backend URL — e.g. https://api.example.com/v1]`

**API Authentication**: [JWT Bearer / API Key / Cookie forwarding — specify how credentials are passed to backend calls]

**API Contract**: [Link to OpenAPI/Swagger docs, Postman collection, or GraphQL schema]

**TypeScript type generation**: <!-- MANDATORY — without generated types, types are written manually and diverge from the real API -->

- OpenAPI/Swagger → use `openapi-typescript` (`npx openapi-typescript schema.yaml -o types/api.d.ts`)
- GraphQL → use `@graphql-codegen/cli` to generate types and hooks
- No schema available → create `types/api.ts` with types inferred from documentation and flag it as technical debt

**Local development mock**: <!-- MANDATORY if the backend is not available locally -->

- [MSW (Mock Service Worker) — intercepts fetches at runtime, no extra server]
- [JSON fixtures in `e2e/fixtures/` — for Playwright tests]
- [Backend available locally — no mock needed]

---

#### Strategy C — BaaS (Supabase / Firebase / other)

No custom backend. A managed service is used for DB, auth, and storage.

```
Next.js App
  └── [Supabase Client | Firebase SDK | altro]
        └── [Supabase | Firebase | altro] (managed)
```

**When to use**: prototypes, fast MVPs, projects without a dedicated backend team.

**BaaS Provider**: [Supabase | Firebase | PocketBase | other]

**Agent must**: install the provider SDK, create `lib/[provider].ts` as a singleton client, use provider-generated types for the DB. No Prisma, no local PostgreSQL.

---

#### Strategy D — Hybrid (Prisma + External API)

App-local data in PostgreSQL via Prisma (e.g. users, sessions, logs), domain data from external APIs (e.g. products from ERP, orders from OMS).

```
Next.js App
  └── services/
        ├── db/         ← Prisma (dati locali app)
        └── api/        ← HTTP client (dati da sistemi esterni)
```

**When to use**: integration with legacy enterprise systems that expose APIs, but also need local state (e.g. user preferences, cache, logs).

**Agent must**: configure both Prisma (see Strategy A) and the `services/api/` layer (see Strategy B).

---

### 5.2 Mock Data (v1) <!-- OPTIONAL — include if mock/seed data is used in v1 -->

[Describe what data is mocked, where it is defined (e.g. Prisma seed, JSON fixture files, MSW handler), and how it will be replaced in the future.]

### 5.3 Data Model <!-- MANDATORY for strategy A or D; omit for B or C -->

<!-- If strategy A or D: include the full Prisma schema -->

```prisma
// Prisma schema for this project.

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role
  createdAt DateTime @default(now())
  // [add project-specific relations]
}

enum Role {
  ADMIN
  USER
}

model [ModelName] {
  id        String   @id @default(cuid())
  // [project-specific fields]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

<!-- If strategy B: include the main API URLs + methods instead -->
<!-- If strategy C: include the BaaS tables/collections with their fields -->

### 5.4 Data Contract for structured fields <!-- MANDATORY if the model has untyped Json, object or array fields -->

> **Field names here are binding**: `seed.ts`, components, and route handlers must use exactly the same name. If a `Json` field has no explicit contract, each part of the system uses different names — the most frequent bug in apps with structured data.
>
> **Array rule**: always model as `items: T[]`, never as `field1`, `field2`, `field3`.

For each untyped `Json` / `object` / array field in the model:

**`[Model].[field]` — e.g. `Article.metadata`**

| Field         | TypeScript Type                      | Required     | Default | UI Label / Figma node               |
| ------------- | ------------------------------------ | ------------ | ------- | ----------------------------------- |
| `[fieldName]` | `string \| null`                     | no           | `null`  | [UI label or Figma node-id]         |
| `[otherName]` | `string`                             | yes          | `""`    | [UI label]                          |
| `[items]`     | `{ label: string; value: string }[]` | no           | `[]`    | [list in Figma]                     |

### 5.5 File and Image Storage <!-- OPTIONAL — include only if the project handles file or image uploads -->

> Without this section, the agent independently chooses a storage strategy, often using base64 in DB (not scalable) or a flow incompatible with the deployment target.

| File type                 | Storage                                         | Max size       | Accepted formats      |
| ------------------------- | ----------------------------------------------- | -------------- | --------------------- |
| [e.g. profile images]     | [e.g. AWS S3 / local filesystem / BaaS Storage] | [e.g. 5MB]     | [e.g. JPEG, PNG, WebP]|

**Upload flow** (specify if behavior differs between dev and prod):

1. [e.g. client calls `POST /api/upload` → receives `{ uploadUrl, fileUrl }`]
2. [e.g. client performs direct PUT to `uploadUrl` with binary file]
3. [e.g. client saves `fileUrl` in `entity.field` via API]

> **Dev vs Prod**: [e.g. in dev the local filesystem is used; in prod S3. The component must not know the difference — it is the route API's responsibility.]

**Campo DB finale**: `[Model].[field]` di tipo `string | null`

---

## 6. Design System from Figma <!-- OPTIONAL — include if Figma is used -->

Before implementing any UI component, retrieve from Figma:

- **Color palette**: primary, secondary, states (success, warning, error), neutrals
- **Typography**: font family, size scale, weight
- **Spacing / grid**: base unit, margins, padding
- **Atomic components**: buttons, inputs, badges, icons, cards
- **Page layouts**: each main page/view as a frame in Figma

Extracted tokens go into `tailwind.config.ts` as `theme.extend` to ensure consistency with the design.

---

## 7. Folder Structure <!-- MANDATORY -->

```
app/
  [locale]/                 # i18n structure — remove if no i18n
    layout.tsx
    page.tsx
    [feature]/
      page.tsx
      loading.tsx           # skeleton for each route with data fetch
  api/
    auth/[...all]/route.ts    # Better Auth route handler
    [resource]/route.ts       # route handlers for API

components/
  [domain]/                 # organized by functional domain
    [Componente].tsx
  ui/                       # reusable atomic components
    Button.tsx
    [altri...]
  forms/                    # form components and configurations

lib/
  auth.ts                   # Better Auth instance (server)
  auth-client.ts            # Better Auth React client
  prisma.ts                 # Prisma client singleton (only if Prisma)
  mock-auth.ts              # isMockAuthEnabled() [if mock auth]
  [utility].ts

services/                   # business logic separated from components
  [resource].service.ts

types/
  index.ts                  # shared types

messages/                   # i18n [remove if no i18n]
  en.json
  it.json

i18n/                       # i18n configuration [remove if no i18n]
  routing.ts
  request.ts

prisma/
  schema.prisma
  prisma.config.ts
  seed.ts
  migrations/

e2e/                        # Playwright E2E tests
  fixtures.ts               # loginAs(), test extensions
  [feature].spec.ts         # one file per feature

proxy.ts                    # Next.js 16 middleware
playwright.config.ts
```

---

## 8. Authentication <!-- MANDATORY -->

<!-- Choose and customize the appropriate section for the provider used -->

### Option A — SSO (Microsoft Entra ID / Google / other OIDC) with Better Auth

- Libreria: **Better Auth** (`yarn add better-auth`)
- Provider: Microsoft Entra ID via `socialProviders.microsoft`
- Required environment variables:
  ```
  BETTER_AUTH_SECRET=        # openssl rand -base64 32
  BETTER_AUTH_URL=
  MICROSOFT_CLIENT_ID=
  MICROSOFT_CLIENT_SECRET=
  MICROSOFT_TENANT_ID=common # or specific tenant ID
  ```
- Role is read from JWT token (claim: `[claim name]`) and saved to the `User` profile in DB
- DB schema generated via `npx auth@latest generate` → `npx prisma migrate dev`
- Next.js 16 middleware is named `proxy.ts` and exports a `proxy` function
- Route protection in proxy: `getSessionCookie()` for optimistic redirect; `auth.api.getSession()` for full validation

### Option B — Email/Password with Better Auth

- Libreria: **Better Auth** (`yarn add better-auth`)
- Config in `lib/auth.ts`: `emailAndPassword: { enabled: true }`
- Password managed internally by Better Auth (bcrypt hash)
- Required environment variables:
  ```
  BETTER_AUTH_SECRET=        # openssl rand -base64 32
  BETTER_AUTH_URL=
  ```

### Option C — No auth (internal app / tool)

- No auth provider
- [Describe any alternative auth or open access]

---

## 9. Environments <!-- MANDATORY -->

| Env      | `APP_ENV`    | URL                     | Mock Auth | Database             |
| -------- | ------------ | ----------------------- | --------- | -------------------- |
| local    | `local`      | `http://localhost:3000` | ✅        | `[db_name]` (local)  |
| dev      | `dev`        | [URL TBD]               | ✅        | Shared dev DB        |
| qa       | `qa`         | [URL TBD]               | ❌        | QA DB                |
| prod     | `production` | [URL TBD]               | ❌        | Production DB        |

### Environment variables per environment

**`.env.development`** (versioned):

```bash
APP_ENV=local
BETTER_AUTH_URL=http://localhost:3000
```

**`.env.qa`** (versioned, public variables — secrets via CI/CD):

```bash
APP_ENV=qa
BETTER_AUTH_URL=https://qa.[dominio].com
```

**`.env.production`** (versioned, public variables — secrets via CI/CD):

```bash
APP_ENV=production
BETTER_AUTH_URL=https://[dominio].com
```

---

## 10. Out of Scope — v1 <!-- MANDATORY -->

> Explicit list of what is NOT included in the MVP. Helps avoid feature creep.

- [Removed or deferred feature 1]
- [Removed or deferred feature 2]
- [View/device not supported in v1]
- [Integration not included in v1]

---

## 11. Decisions Made <!-- MANDATORY -->

| #   | Question                        | Decision                        |
| --- | ------------------------------- | ------------------------------- |
| 1   | [Technical or product question] | [Decision made and rationale]   |
| 2   | [Technical or product question] | [Decision made and rationale]   |

---

## 12. MVP Milestones <!-- MANDATORY -->

| Milestone | Deliverable                                                   |
| --------- | ------------------------------------------------------------- |
| M1        | Project setup, Better Auth + [SSO/email provider], seed data  |
| M2        | [Design system / atomic components]                           |
| M3        | [Main feature — structure and layout]                         |
| M4        | [Main feature — core functionality]                           |
| M5        | [Secondary feature or integrations]                           |
| M6        | [Data persistence, state, validation]                         |
| M7        | [Additional feature — e.g. secondary user role]               |
| M8        | [Optimizations, UI polish, accessibility]                     |
| M9        | [Playwright E2E suite — tests for all main flows]             |
