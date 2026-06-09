---
description: >
  Conventions and patterns for Playwright E2E testing.
  Load this skill when writing, configuring or debugging E2E tests.
applyTo: "**"
---

# Playwright — E2E Testing Conventions

---

## Installation

**Use npm, not Yarn**, for installing Playwright:

```bash
# ⚠️ Yarn Berry (PnP/node-modules) can time out with large packages like Playwright
# Install playwright via npm, then manage scripts via yarn
cd <project-root>
npm install --save-dev @playwright/test
npx playwright install chromium
```

If already using Yarn and the project requires it:

```bash
yarn add --dev @playwright/test
npx playwright install chromium
# If timeout occurs, retry with npm only for this package
```

---

## `.gitignore` — Required Entries

```gitignore
# Playwright
playwright-report/
test-results/
# ⚠️ Do NOT ignore visual snapshots — they are source of truth for regression
# e2e/visual/*.spec.ts-snapshots/  ← commit these
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:update": "playwright test --update-snapshots"
  }
}
```

---

## playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'line',                  // compact output — do not change to 'list' in CI
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },  // fixed viewport — required for visual snapshots
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'yarn start',           // ← use 'yarn dev' only if no build is run beforehand
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env['CI'],
    timeout: 120000,
  },
})
```

**Critical**: `webServer` block is required — agent must never leave tests pending for missing server.

---

## `e2e/fixtures.ts` — Authentication

```typescript
import { test as base, type Page } from '@playwright/test'

/** Fixture that provides a pre-authenticated page session */
const test = base.extend<{ loginAs: (role: string) => Promise<void> }>({
  loginAs: async ({ page }, use) => {
    const login = async (role: string) => {
      const credentials: Record<string, { email: string; password: string }> = {
        admin: { email: 'admin@example.com', password: 'admin123' },
        user: { email: 'user@example.com', password: 'user123' },
      }

      const creds = credentials[role]
      if (!creds) throw new Error(`Unknown role: ${role}`)

      await page.goto('/sign-in')
      await page.getByTestId('email-input').fill(creds.email)
      await page.getByTestId('password-input').fill(creds.password)
      await page.getByTestId('submit-button').click()
      await page.waitForURL('/dashboard')
    }
    await use(login)
  },
})

export { test }
export { expect } from '@playwright/test'
```

Usage in tests:

```typescript
import { test, expect } from '../fixtures'

test('admin can view dashboard', async ({ page, loginAs }) => {
  await loginAs('admin')
  await expect(page).toHaveURL('/dashboard')
})
```

---

## Test Writing Conventions

### File naming

```
e2e/
  <feature>.spec.ts          # functional test per feature
  visual/
    <screen>.spec.ts         # visual regression per screen (one per milestone)
```

### Selector rules

```typescript
// ✅ Use data-testid — stable, independent from UI text
await page.getByTestId('submit-button').click()
await page.getByTestId('user-table').getByTestId('row-1')

// ✅ getByRole for semantic elements
await page.getByRole('heading', { name: 'Dashboard' })
await page.getByRole('button', { name: 'Save' })

// ❌ Avoid — coupled to styles or translated text
await page.locator('.btn-primary')
await page.getByText('Salva')
```

### One file per feature

```typescript
// e2e/auth.spec.ts
import { test, expect } from './fixtures'

test.describe('Authentication', () => {
  test('login with valid credentials', async ({ page, loginAs }) => {
    await loginAs('user')
    await expect(page).toHaveURL('/dashboard')
  })

  test('redirect to sign-in when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/sign-in')
  })
})
```

### Scope locators within test containers

```typescript
// ✅ Scope to container — avoids ambiguous selectors
const userCard = page.getByTestId('user-card')
await expect(userCard.getByTestId('user-name')).toContainText('John')
await userCard.getByTestId('edit-button').click()

// ❌ Broad global selector — may match multiple elements
await page.getByTestId('user-name').first()   // fragile
```

---

## Common Errors

### Dev server not started before test run

**Symptom**: All tests fail with `Connection refused` or `ERR_CONNECTION_REFUSED`.

**Fix**: `webServer` block in `playwright.config.ts` (see config above). Agent must never leave this pending.

```typescript
webServer: {
  command: 'yarn start',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env['CI'],
  timeout: 120000,
}
```

Verify server before running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → must return `200` or `307`.

### `toHaveURL` fails with next-intl

**Symptom**: `expect(page).toHaveURL('/dashboard')` fails because URL is `/it/dashboard`.

**Fix**: Use locale in assertion or regex:

```typescript
await expect(page).toHaveURL(/\/it\/dashboard/)
// or
await expect(page).toHaveURL(`/${locale}/dashboard`)
```

### `triple_click` vs `fill` for input

**Symptom**: `fill()` after clicking on input does not replace existing content.

**Fix**: Use `triple_click` to select existing content, then type:

```typescript
await page.getByTestId('search-input').triple_click()
await page.keyboard.type('new search term')
// or simply:
await page.getByTestId('search-input').fill('new search term')
// fill() already clears the input before typing
```

### Ambiguous selector matching multiple elements

**Symptom**: `Error: strict mode violation: locator resolved to N elements`.

**Fix**: Scope to container, use `.nth()`, or add more specific `data-testid`:

```typescript
// Option 1 — scope to container
const row = page.getByTestId(`row-${id}`)
await row.getByTestId('edit-button').click()

// Option 2 — explicit nth (fragile — use only as last resort)
await page.getByRole('button', { name: 'Edit' }).nth(0).click()
```

### `getByRole("banner")` nested inside `<header>`

**Symptom**: `getByRole("banner")` matches unexpected elements.

**Cause**: `role="banner"` is implicit on `<header>` at landmark level. Nesting creates conflict.

**Fix**: Use `getByTestId('header')` or `page.locator('header')` instead of `getByRole('banner')`.

### `[role='alert']` not visible in dev mode

**Symptom**: Toast or alert visible on screen but `getByRole('alert')` returns empty.

**Cause**: Some toast libraries use `role="status"` or `aria-live` instead of `role="alert"`.

**Fix**: Inspect element in browser → use exact attribute:

```typescript
await expect(page.locator('[aria-live="polite"]')).toContainText('Saved successfully')
// or use data-testid on the toast container
await expect(page.getByTestId('toast-success')).toBeVisible()
```

### `window.open` after `await`

**Symptom**: Popup opens before assertion, causing test flakiness.

**Fix**: Listen for `popup` event before click:

```typescript
const popupPromise = page.waitForEvent('popup')
await page.getByTestId('open-external').click()
const popup = await popupPromise
await popup.waitForLoadState('domcontentloaded')
await expect(popup).toHaveURL(/external-site/)
```

### webServer uses wrong package manager

**Symptom**: `webServer` command fails with `command not found` or `yarn: not found` in CI.

**Fix**: Match `command` to the project's package manager. Check `package.json#packageManager`:

```typescript
// If project uses yarn:
webServer: { command: 'yarn start', ... }

// If project uses npm:
webServer: { command: 'npm run start', ... }

// If project uses pnpm:
webServer: { command: 'pnpm start', ... }
```

### `getByRole("status")` resolves to multiple elements

**Symptom**: `strict mode violation` when using `getByRole('status')`.

**Cause**: `role="status"` can match multiple elements (aria-live regions, status bars, etc.).

**Fix**: Use specific `data-testid` or scope to container:

```typescript
// ✅ Specific testid
await expect(page.getByTestId('form-status')).toContainText('Saved')

// ✅ Scoped to form
const form = page.getByTestId('user-form')
await expect(form.getByRole('status')).toContainText('Saved')
```
