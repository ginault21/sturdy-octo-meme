import { getStoreByDomain } from '../../db.server.js';
import { decrypt } from '../crypto.server.js';

import { createShopifyClient, type ShopifyClient } from './client.server.js';

export class StoreNotFoundError extends Error {
  constructor(shopDomain: string) {
    super(`Store not found: ${shopDomain}`);
    this.name = 'StoreNotFoundError';
  }
}

export class TokenDecryptionError extends Error {
  constructor(message: string) {
    super(`Token decryption failed: ${message}`);
    this.name = 'TokenDecryptionError';
  }
}

export async function getShopifyClientForStore(shopDomain: string): Promise<ShopifyClient> {
  // 1. Load Store from DB using getStoreByDomain()
  const store = await getStoreByDomain(shopDomain);

  // 2. If null, throw StoreNotFoundError
  if (!store) {
    throw new StoreNotFoundError(shopDomain);
  }

  // 3. Decrypt accessToken using decrypt()
  let decryptedToken: string;
  try {
    decryptedToken = decrypt(store.accessToken);
  } catch (error) {
    // 4. If decryption fails, throw TokenDecryptionError
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new TokenDecryptionError(message);
  }

  // 5. Create and return Shopify client
  return createShopifyClient(shopDomain, decryptedToken);
}
