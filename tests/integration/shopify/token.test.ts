import { describe, it, expect, beforeEach } from 'vitest';

import { createStore } from '../../../app/db.server.js';
import { encrypt } from '../../../app/lib/crypto.server.js';
import {
  getShopifyClientForStore,
  StoreNotFoundError,
  TokenDecryptionError,
} from '../../../app/lib/shopify/token.server.js';
import { cleanDatabase } from '../../../tests/helpers/db.js';

describe('getShopifyClientForStore', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should return client for valid store', async () => {
    const encryptedToken = encrypt('test-token');
    await createStore({
      shopDomain: 'test-shop.myshopify.com',
      accessToken: encryptedToken,
      plan: 'trial',
    });

    const client = await getShopifyClientForStore('test-shop.myshopify.com');
    expect(client).toBeDefined();
    expect(typeof client.graphql).toBe('function');
    expect(typeof client.rest).toBe('function');
  });

  it('should throw StoreNotFoundError for non-existent store', async () => {
    await expect(getShopifyClientForStore('non-existent.myshopify.com')).rejects.toThrow(
      StoreNotFoundError
    );
  });

  it('should throw TokenDecryptionError for corrupted token', async () => {
    await createStore({
      shopDomain: 'test-shop.myshopify.com',
      accessToken: 'invalid-encrypted-token',
      plan: 'trial',
    });

    await expect(getShopifyClientForStore('test-shop.myshopify.com')).rejects.toThrow(
      TokenDecryptionError
    );
  });
});
