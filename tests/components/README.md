# Component Testing

This directory contains React component tests using Testing Library.

## Setup

Tests use `@testing-library/react` with Vitest and `@testing-library/jest-dom` matchers.

## Example Test

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';

import MyComponent from '~/components/MyComponent';

describe('MyComponent', () => {
  it('renders with correct content', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

## Best Practices

- Test behavior, not implementation details
- Use `screen` queries to find elements
- Prefer `userEvent` over `fireEvent` for interactions
- Mock Shopify App Bridge when testing embedded components
