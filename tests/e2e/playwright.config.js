import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
const apiURL = process.env.API_URL ?? 'http://localhost:8001';

export default defineConfig({
  testDir: './specs',
  // Single-worker is intentional for now: the dev backend stores tasks
  // and purchase orders in module-level Python lists, and the duplicate-
  // PO 409 path is not atomic across overlapping requests. Parallel
  // workers against shared in-memory state would race. See FIXME(persistence)
  // in server/main.py — once that DB migration lands, raise this to the
  // Playwright default.
  workers: 1,
  // Retry transient flakes on CI; surface real bugs immediately locally.
  retries: process.env.CI ? 2 : 0,
  // Boot both halves of the stack if they aren't already up so a fresh
  // `npx playwright test` works on a clean local checkout. The frontend
  // alone isn't enough — the dashboards/Reports/Restocking specs all
  // hit /api/... and would just hang on a missing backend. CI typically
  // already has both up via separate steps.
  webServer: [
    {
      command: 'uv --project ../../server run python main.py',
      url: `${apiURL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm --prefix ../../client run dev',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  use: {
    baseURL,
    headless: true,
    // Pin locale so tests asserting English UI strings don't depend on the
    // runner's system locale. App i18n already defaults to en; this also
    // stabilizes browser locale for date inputs and Intl-formatted output.
    locale: 'en-US',
    // Pin color scheme so the dark-mode tests start from a known light
    // baseline. The pre-paint inline script in index.html honors
    // prefers-color-scheme as a fallback when localStorage is empty, so a
    // runner / Playwright-default flip to 'dark' would silently dark-paint
    // first load and break the "one click → dark" assertion.
    colorScheme: 'light',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
