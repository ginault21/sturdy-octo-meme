# Testing Guide

This project uses Vitest for unit/integration tests and Playwright for E2E tests.

## Quick Start

```bash
# Run all unit/integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm test -- --coverage

# Run E2E tests (requires dev server)
npm run dev &  # In separate terminal
npm run test:e2e
```

## Test Organization

```
tests/
├── unit/           # Pure functions, utilities, business logic
│   ├── lib/        # Server utilities (crypto, rate-limiter)
│   └── schemas/    # Zod validation schemas
├── integration/    # Database, API clients, external services
│   ├── db/         # Database helper tests
│   ├── shopify/    # Shopify API client tests
│   └── storage/    # Storage provider tests
├── components/     # React component tests (Testing Library)
├── routes/         # Route loader/action tests
├── e2e/            # Full browser tests (Playwright)
├── contracts/      # Storage provider contract tests
└── helpers/        # Test utilities and fixtures
    └── db.ts       # Database cleanup utilities
```

## Coverage Requirements

Minimum coverage thresholds (enforced in CI):

| Metric     | Threshold | Current |
| ---------- | --------- | ------- |
| Statements | 80%       | 85.49%  |
| Branches   | 65%       | 68.42%  |
| Functions  | 75%       | 81.69%  |
| Lines      | 80%       | 85.44%  |

View detailed coverage report:

```bash
npm test -- --coverage
open coverage/index.html
```

## Writing Tests

### Unit Tests

Test pure functions and business logic in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '~/lib/my-module.server';

describe('myFunction', () => {
  it('returns expected result for valid input', () => {
    expect(myFunction('input')).toBe('output');
  });

  it('throws error for invalid input', () => {
    expect(() => myFunction('')).toThrow('Invalid input');
  });
});
```

### Integration Tests

Test with real dependencies (database, etc.):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '~/db.server';
import { cleanDatabase } from '../helpers/db';

describe('Store DB helpers', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates store in database', async () => {
    const store = await createStore({
      shopDomain: 'test.myshopify.com',
      accessToken: 'token',
      plan: 'trial',
    });
    expect(store.shopDomain).toBe('test.myshopify.com');
  });
});
```

### Component Tests

Test React components with Testing Library:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';

import Button from '~/components/Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### E2E Tests

Test full user flows in browser:

```typescript
import { test, expect } from '@playwright/test';

test('user can generate a product', async ({ page }) => {
  await page.goto('/app');
  await page.click('text=Generate a product');
  await expect(page.locator('text=Product created')).toBeVisible();
});
```

## Best Practices

1. **Test behavior, not implementation** - Tests should pass even if internals change
2. **Use descriptive test names** - "should do X when Y" format
3. **One concept per test** - Keep tests focused and readable
4. **Mock external dependencies** - Database, API calls, etc.
5. **Clean up after tests** - Use `beforeEach`/`afterEach` for cleanup
6. **Avoid test interdependence** - Each test should be able to run independently
7. **Use proper assertions** - Prefer specific matchers over generic `toBeTruthy()`

## Available Matchers (Jest-DOM)

With `@testing-library/jest-dom`:

```typescript
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toHaveTextContent('Hello');
expect(element).toHaveClass('active');
expect(element).toBeDisabled();
expect(input).toHaveValue('test');
```

## CI/CD

Tests run automatically on:

- Push to main/master
- Pull request to main/master

See `.github/workflows/ci.yml` for details.

## Troubleshooting

### Tests fail with "table does not exist"

Run database setup:

```bash
npm run setup
```

### E2E tests timeout

Ensure dev server is running:

```bash
npm run dev
```

### Coverage threshold failures

Check coverage report:

```bash
npm test -- --coverage
```

Add tests for uncovered code or adjust thresholds in `vitest.config.ts`.

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Jest-DOM Matchers](https://github.com/testing-library/jest-dom)
