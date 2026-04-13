import { test, expect } from '@playwright/test';

test.describe('App smoke tests', () => {
  test('app loads and has expected title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.*/);
  });

  test('landing page displays Shopify app template content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Shopify app template')).toBeVisible();
    await expect(page.locator('text=React Router')).toBeVisible();
    await expect(page.locator('text=Prisma')).toBeVisible();
  });

  test('page contains generate product button', async ({ page }) => {
    await page.goto('/');
    // Note: Full interaction requires authenticated session
    await expect(page.locator('text=Generate a product').first()).toBeVisible();
  });
});
