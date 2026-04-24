import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('app loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Factory Inventory Management System');
    await expect(page.getByRole('heading', { name: 'Catalyst Components' })).toBeVisible();
  });

  test('all nav links are present', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Inventory' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Finance' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Demand Forecast' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Reports' })).toBeVisible();
  });

  test('navigates to Inventory page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Inventory' }).click();
    await expect(page).toHaveURL('/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  });

  test('navigates to Orders page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Orders' }).click();
    await expect(page).toHaveURL('/orders');
  });

  test('navigates to Reports page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL('/reports');
    await expect(page.getByRole('heading', { name: 'Performance Reports' })).toBeVisible();
  });

  test('navigates to Finance page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Finance' }).click();
    await expect(page).toHaveURL('/spending');
  });

  test('navigates to Demand Forecast page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Demand Forecast' }).click();
    await expect(page).toHaveURL('/demand');
  });
});
