# Route Testing

This directory contains tests for React Router routes (loaders and actions).

## Challenges

Route loaders/actions in Shopify apps require mocking:

- `authenticate.admin()` from shopify.server
- GraphQL admin client
- Database access
- Environment variables

## Recommended Approach

### 1. Extract Business Logic

Move business logic from loaders/actions into testable utility functions:

```typescript
// app/lib/product.server.ts
export async function createProduct(admin: AdminApi, data: ProductData) {
  // Business logic here
}

// app/routes/app._index.tsx
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const data = await request.json();
  return createProduct(admin, data);
};
```

### 2. Test Utilities

Test the extracted functions in isolation:

```typescript
// tests/unit/lib/product.test.ts
describe('createProduct', () => {
  it('creates product with valid data', async () => {
    const mockAdmin = { graphql: vi.fn() };
    await createProduct(mockAdmin, { title: 'Test' });
    expect(mockAdmin.graphql).toHaveBeenCalled();
  });
});
```

### 3. Integration Tests

For full route testing, use integration test pattern:

```typescript
import { createRequest } from '../helpers/request';

describe('route integration', () => {
  it('handles full request cycle', async () => {
    const request = createRequest('/app', { method: 'POST', body: {} });
    // Test with mocked dependencies
  });
});
```

## Resources

- [React Router Testing](https://reactrouter.com/en/main/guides/testing)
- [Shopify App Testing Guide](https://shopify.dev/docs/apps/tools/react-router/testing)
