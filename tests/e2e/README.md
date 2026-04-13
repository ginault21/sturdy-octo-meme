# E2E Testing

End-to-end tests using Playwright.

## Running Tests

```bash
# Run E2E tests (requires dev server running)
npm run test:e2e

# Run with UI mode for debugging
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts
```

## Configuration

See `playwright.config.ts` for configuration:

- Base URL: `http://localhost:3000` (or `E2E_BASE_URL` env var)
- Browser: Chromium (Desktop Chrome)
- Workers: 1 in CI (for stability), undefined locally

## Writing Tests

```typescript
import { test, expect } from '@playwright/test';

test('description of test', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Expected')).toBeVisible();
});
```

## Authentication

E2E tests for authenticated routes require:

1. Test shop with known credentials, OR
2. Mock auth session injection, OR
3. Skip with `test.skip()` for now

## Best Practices

- Test user-visible behavior, not implementation
- Use `data-testid` attributes for stable selectors
- Avoid testing third-party services directly
- Keep tests independent (clean state between tests)
