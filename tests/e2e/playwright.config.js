import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './specs',
  // Single-worker is intentional for now: the dev backend stores tasks
  // and purchase orders in module-level Python lists, and the duplicate-
  // PO 409 path is not atomic across overlapping requests. Parallel
  // workers against shared in-memory state would race. Once the DB-backed
  // rewrite lands, this can go up to the default.
  workers: 1,
  // Retry transient flakes on CI; surface real bugs immediately locally.
  retries: process.env.CI ? 2 : 0,
  // Boot the frontend dev server if it isn't already running so a fresh
  // `npx playwright test` works on a clean checkout. CI typically already
  // has it up via a separate step.
  webServer: {
    command: 'npm --prefix ../../client run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL,
    headless: true,
    // Pin locale so tests asserting English UI strings don't depend on the
    // runner's system locale. App i18n already defaults to en; this also
    // stabilizes browser locale for date inputs and Intl-formatted output.
    locale: 'en-US',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
