import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createShopifyClient, ShopifyApiError } from '../../../../app/lib/shopify/client.server.js';

describe('createShopifyClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should make GraphQL request with auth header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { shop: { name: 'Test Shop' } },
          extensions: { cost: { actualQueryCost: 2 } },
        }),
    });
    global.fetch = mockFetch;

    const client = await createShopifyClient('test-shop.myshopify.com', 'token123');
    const result = await client.graphql(`{ shop { name } }`);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/graphql.json'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Shopify-Access-Token': 'token123',
        }),
      })
    );
    expect(result).toEqual({ shop: { name: 'Test Shop' } });
  });

  it('should throw ShopifyApiError on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ errors: 'Rate limited' }),
    });
    global.fetch = mockFetch;

    const client = await createShopifyClient('test-shop.myshopify.com', 'token123');

    await expect(client.rest('GET', '/products.json')).rejects.toThrow(ShopifyApiError);
  });
});
