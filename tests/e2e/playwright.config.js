import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  use: {
    baseURL: 'http://localhost:3000',
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
