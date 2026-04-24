import { test, expect } from '@playwright/test';

test.describe('Reports page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports');
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Performance Reports' })).toBeVisible();
    await expect(page.getByText('View quarterly performance metrics and monthly trends')).toBeVisible();
  });

  test('quarterly performance table has four quarters', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Quarterly Performance' })).toBeVisible();
    const table = page.locator('table').filter({ hasText: 'Quarter' });
    const dataRows = table.getByRole('rowgroup').last().getByRole('row');
    await expect(dataRows).toHaveCount(4);
    await expect(table.getByRole('cell', { name: 'Q1-2025' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Q4-2025' })).toBeVisible();
  });

  test('quarterly table has correct columns', async ({ page }) => {
    const table = page.locator('table').filter({ hasText: 'Quarter' });
    await expect(table.getByRole('columnheader', { name: 'Quarter' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Total Orders' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Total Revenue' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Avg Order Value' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Fulfillment Rate' })).toBeVisible();
  });

  test('month-over-month analysis has 12 months', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Month-over-Month Analysis' })).toBeVisible();
    const momTable = page.locator('table').filter({ hasText: 'Month' }).filter({ hasText: 'Growth Rate' });
    const dataRows = momTable.getByRole('rowgroup').last().getByRole('row');
    await expect(dataRows).toHaveCount(12);
  });

  test('month-over-month table shows Jan and Dec 2025', async ({ page }) => {
    const momTable = page.locator('table').filter({ hasText: 'Month' }).filter({ hasText: 'Growth Rate' });
    await expect(momTable.getByRole('cell', { name: 'Jan 2025' })).toBeVisible();
    await expect(momTable.getByRole('cell', { name: 'Dec 2025' })).toBeVisible();
  });

  test('summary stats are displayed', async ({ page }) => {
    await expect(page.getByText('Total Revenue (YTD)')).toBeVisible();
    await expect(page.getByText('Avg Monthly Revenue')).toBeVisible();
    await expect(page.getByText('Total Orders (YTD)')).toBeVisible();
    await expect(page.getByText('Best Performing Quarter')).toBeVisible();
    await expect(page.getByText('Q4-2025').first()).toBeVisible();
  });

  test('monthly revenue trend chart is rendered', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Monthly Revenue Trend' })).toBeVisible();
    await expect(page.getByText('Jan 2025').first()).toBeVisible();
    await expect(page.getByText('Dec 2025').first()).toBeVisible();
  });
});
