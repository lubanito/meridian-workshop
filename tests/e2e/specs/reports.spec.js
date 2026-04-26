import { test, expect } from '@playwright/test';

test.describe('Reports page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports');
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Performance Reports' })).toBeVisible();
    await expect(page.getByText('View quarterly performance metrics and monthly trends')).toBeVisible();
  });

  test('quarterly performance table has quarters', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Quarterly Performance' })).toBeVisible();
    const table = page.locator('table').filter({ hasText: 'Quarter' });
    const dataRows = table.getByRole('rowgroup').last().getByRole('row');
    await expect(dataRows.first()).toBeVisible();
    // Match any year — the demo dataset is 2025 today, but the seed
    // could roll forward and these assertions shouldn't be hardcoded to it.
    await expect(table.getByRole('cell', { name: /^Q1-\d{4}$/ })).toBeVisible();
    await expect(table.getByRole('cell', { name: /^Q4-\d{4}$/ })).toBeVisible();
  });

  test('quarterly table has correct columns', async ({ page }) => {
    const table = page.locator('table').filter({ hasText: 'Quarter' });
    await expect(table.getByRole('columnheader', { name: 'Quarter' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Total Orders' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Total Revenue' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Avg Order Value' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Fulfillment Rate' })).toBeVisible();
  });

  test('month-over-month analysis has data rows', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Month-over-Month Analysis' })).toBeVisible();
    const momTable = page.locator('table').filter({ hasText: 'Month' }).filter({ hasText: 'Growth Rate' });
    const dataRows = momTable.getByRole('rowgroup').last().getByRole('row');
    await expect(dataRows.first()).toBeVisible();
  });

  test('month-over-month table shows the first and last month', async ({ page }) => {
    const momTable = page.locator('table').filter({ hasText: 'Month' }).filter({ hasText: 'Growth Rate' });
    await expect(momTable.getByRole('cell', { name: /^Jan \d{4}$/ })).toBeVisible();
    await expect(momTable.getByRole('cell', { name: /^Dec \d{4}$/ })).toBeVisible();
  });

  test('summary stats are displayed', async ({ page }) => {
    await expect(page.getByText('Total Revenue (YTD)')).toBeVisible();
    await expect(page.getByText('Avg Monthly Revenue')).toBeVisible();
    await expect(page.getByText('Total Orders (YTD)')).toBeVisible();
    await expect(page.getByText('Best Performing Quarter')).toBeVisible();
    await expect(page.getByText(/^Q4-\d{4}$/).first()).toBeVisible();
  });

  test('monthly revenue trend chart is rendered', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Monthly Revenue Trend' })).toBeVisible();
    await expect(page.getByText(/^Jan \d{4}$/).first()).toBeVisible();
    await expect(page.getByText(/^Dec \d{4}$/).first()).toBeVisible();
  });
});
