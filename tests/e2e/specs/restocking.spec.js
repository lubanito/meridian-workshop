import { test, expect } from '@playwright/test';

test.describe('Restocking page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/restocking');
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Restocking Recommendations' })).toBeVisible();
    await expect(page.getByText('Purchase order recommendations based on current stock levels')).toBeVisible();
  });

  test('stat cards are displayed', async ({ page }) => {
    await expect(page.getByText('Below Reorder Point')).toBeVisible();
    await expect(page.getByText('Increasing Demand')).toBeVisible();
    await expect(page.getByText('Total Candidates')).toBeVisible();
    await expect(page.getByText('Budget Utilization')).toBeVisible();
  });

  test('budget ceiling input is editable', async ({ page }) => {
    const input = page.locator('#budget-input');
    await expect(input).toBeVisible();
    await input.fill('10000');
    await expect(input).toHaveValue('10000');
  });

  test('table has expected columns', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Priority' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Est. Cost' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Qty to Order' })).toBeVisible();
  });

  test('table has data rows', async ({ page }) => {
    const rows = page.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('progress bar is visible', async ({ page }) => {
    await expect(page.locator('.progress-bar-track')).toBeVisible();
  });

  test('preview draft button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Preview Draft/i })).toBeVisible();
  });

  test('clicking preview draft shows summary', async ({ page }) => {
    await page.getByRole('button', { name: /Preview Draft/i }).click();
    await expect(page.getByText(/not yet submitted/i)).toBeVisible();
  });

  test('changing budget ceiling updates budget utilization stat', async ({ page }) => {
    // Set a very low budget — utilization should spike to over-budget state
    const input = page.locator('#budget-input');
    await input.fill('1');
    // The stat card should flip to danger styling (over budget)
    await expect(page.locator('.stat-card.danger').filter({ hasText: 'Budget Utilization' })).toBeVisible();
    // Reset to a high budget — should go back to within-budget
    await input.fill('9999999');
    await expect(page.locator('.stat-card.success').filter({ hasText: 'Budget Utilization' })).toBeVisible();
  });
});

test.describe('Dark mode (D3)', () => {
  test('theme toggle adds data-theme=dark to html element', async ({ page }) => {
    await page.goto('/');
    await page.locator('.theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('theme toggle removes dark mode on second click', async ({ page }) => {
    await page.goto('/');
    await page.locator('.theme-toggle').click();
    await page.locator('.theme-toggle').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('i18n language switcher (D2)', () => {
  test('switching to Japanese changes page heading text', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Performance Reports' })).toBeVisible();

    // Open language switcher and select Japanese
    await page.locator('.language-button').click();
    await page.locator('.dropdown-item').filter({ hasText: '日本語' }).click();

    await expect(page.getByRole('heading', { name: 'パフォーマンスレポート' })).toBeVisible();

    // Reset to English for subsequent tests
    await page.locator('.language-button').click();
    await page.locator('.dropdown-item').filter({ hasText: 'English' }).click();
  });

  test('switching to Japanese updates nav links', async ({ page }) => {
    await page.goto('/');
    await page.locator('.language-button').click();
    await page.locator('.dropdown-item').filter({ hasText: '日本語' }).click();

    await expect(page.getByRole('link', { name: 'レポート' })).toBeVisible();

    // Reset
    await page.locator('.language-button').click();
    await page.locator('.dropdown-item').filter({ hasText: 'English' }).click();
  });
});
