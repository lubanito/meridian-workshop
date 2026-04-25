import { test, expect } from '@playwright/test';

test.describe('Dashboard (Overview)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays Key Performance Indicators section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Key Performance Indicators' })).toBeVisible();
    await expect(page.getByText('Inventory Turnover Rate')).toBeVisible();
    await expect(page.getByText('Orders Fulfilled')).toBeVisible();
    await expect(page.getByText('Order Fill Rate')).toBeVisible();
  });

  test('displays inventory shortages table with data', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Inventory Shortages/ })).toBeVisible();
    const table = page.locator('table').filter({ hasText: 'Order ID' }).first();
    const rows = table.getByRole('row');
    await expect(rows.first()).toBeVisible();
    await expect(await rows.count()).toBeGreaterThan(1); // header + at least 1 shortage
  });

  test('shortage table shows Create PO buttons', async ({ page }) => {
    const createPOButtons = page.getByRole('button', { name: 'Create PO' });
    await expect(await createPOButtons.count()).toBeGreaterThan(0);
  });

  test('displays Top Products by Revenue table', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Top Products by Revenue' })).toBeVisible();
    const productTable = page.locator('table').filter({ hasText: 'Revenue' }).last();
    await expect(await productTable.getByRole('row').count()).toBeGreaterThan(1); // header + products
  });

  test('filter bar renders all filter dropdowns', async ({ page }) => {
    await expect(page.getByText('Time Period')).toBeVisible();
    await expect(page.getByText('Location')).toBeVisible();
    await expect(page.locator('label').filter({ hasText: /^Category$/ })).toBeVisible();
    await expect(page.getByText('Order Status')).toBeVisible();
  });

  test('Reset all filters button is disabled by default', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Reset all filters' })).toBeDisabled();
  });

  test('Reset all filters button enables after applying a filter', async ({ page }) => {
    await page.selectOption('select', { label: 'January' });
    await expect(page.getByRole('button', { name: 'Reset all filters' })).toBeEnabled();
  });

  test('category filter shows correct options', async ({ page }) => {
    const categorySelect = page.getByText('Category').locator('..').getByRole('combobox');
    await expect(categorySelect).toBeVisible();
    const options = categorySelect.locator('option');
    await expect(options).toHaveCount(6); // All + 5 categories
  });
});
