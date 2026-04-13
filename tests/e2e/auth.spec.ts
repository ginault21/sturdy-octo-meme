import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('landing page is accessible without auth', async ({ page }) => {
    await page.goto('/');
    // Landing page should be public
    await expect(page.locator('body')).toBeVisible();
  });

  test('app routes require authentication', async ({ page }) => {
    // Attempt to access app directly
    const response = await page.goto('/app');
    // Should redirect to auth or return unauthorized
    expect([302, 401, 403]).toContain(response?.status());
  });

  test.describe('Authenticated flows', () => {
    test.skip(true, 'Requires Shopify test shop and auth setup');

    test('authenticated user can access app', async () => {
      // TODO: Implement with test shop credentials
      // 1. Navigate to auth endpoint
      // 2. Complete OAuth flow (or use test token)
      // 3. Verify app loads
    });
  });
});
