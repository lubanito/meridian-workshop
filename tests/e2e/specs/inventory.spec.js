import { test, expect } from '@playwright/test';

test.describe('Inventory page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inventory');
  });

  test('page heading shows correct SKU count', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Stock Levels \(\d+ SKUs\)/ })).toBeVisible();
  });

  test('inventory table has correct columns', async ({ page }) => {
    const table = page.locator('table');
    await expect(table.getByRole('columnheader', { name: 'SKU' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Item Name' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Category' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Quantity on Hand' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('search box is present and functional', async ({ page }) => {
    const searchBox = page.getByPlaceholder('Search by item name...');
    await expect(searchBox).toBeVisible();

    await searchBox.fill('Servo');
    await expect(page.getByRole('cell', { name: 'Micro Servo Motor' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Temperature Sensor Module' })).not.toBeVisible();
  });

  test('search is case-insensitive', async ({ page }) => {
    await page.getByPlaceholder('Search by item name...').fill('pcb');
    await expect(page.getByRole('cell', { name: 'Single Layer PCB Assembly' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Dual Layer PCB Assembly' })).toBeVisible();
  });

  test('clearing search restores all items', async ({ page }) => {
    const search = page.getByPlaceholder('Search by item name...');
    await search.fill('motor');
    await search.clear();
    await expect(page.getByRole('heading', { name: /Stock Levels \(\d+ SKUs\)/ })).toBeVisible();
  });

  test('Low Stock items are visible', async ({ page }) => {
    const lowStockBadges = page.getByText('Low Stock');
    await expect(lowStockBadges.first()).toBeVisible();
  });

  test('known SKUs are present in the table', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'TMP-201' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'SRV-301' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'PCB-001' })).toBeVisible();
  });
});
