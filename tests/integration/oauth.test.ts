import { describe, it, expect, beforeEach } from 'vitest';

import { createStore, getStoreByDomain } from '../../app/db.server';
import { encrypt, decrypt } from '../../app/lib/crypto.server';
import { cleanDatabase, prisma } from '../helpers/db';

describe('OAuth afterAuth Integration', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('createStore', () => {
    it('should create new store with encrypted token on first install', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      const accessToken = 'shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const encryptedToken = encrypt(accessToken);

      const store = await createStore({
        shopDomain,
        accessToken: encryptedToken,
        plan: 'trial',
      });

      expect(store.shopDomain).toBe(shopDomain);
      expect(store.accessToken).toBe(encryptedToken);
      expect(store.plan).toBe('trial');
      // Store uses installedAt instead of createdAt
      expect(store.installedAt).toBeDefined();
      expect(store.updatedAt).toBeDefined();

      // Verify token is encrypted (not plaintext)
      expect(store.accessToken).not.toBe(accessToken);
      expect(store.accessToken).toContain(':'); // iv:authTag:ciphertext format

      // Verify we can decrypt it back
      const decrypted = decrypt(store.accessToken);
      expect(decrypted).toBe(accessToken);
    });

    it('should update existing store on reinstall', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      const oldToken = 'shpat_old_token_xxxxxxxxxxxxxxxxxxxx';
      const newToken = 'shpat_new_token_xxxxxxxxxxxxxxxxxxxx';

      // First install
      await createStore({
        shopDomain,
        accessToken: encrypt(oldToken),
        plan: 'trial',
      });

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reinstall (update)
      const updatedStore = await createStore({
        shopDomain,
        accessToken: encrypt(newToken),
        plan: 'trial',
      });

      expect(updatedStore.shopDomain).toBe(shopDomain);
      // On reinstall, updatedAt should be greater than installedAt
      expect(updatedStore.updatedAt.getTime()).toBeGreaterThan(updatedStore.installedAt.getTime());

      // Verify new token is stored
      const decrypted = decrypt(updatedStore.accessToken);
      expect(decrypted).toBe(newToken);
    });

    it('should never store plaintext access token', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      const accessToken = 'shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      // Simulate what afterAuth does - encrypt before storage
      const encryptedToken = encrypt(accessToken);

      await createStore({
        shopDomain,
        accessToken: encryptedToken,
        plan: 'trial',
      });

      // Query raw from database
      const rawStore = await prisma.$queryRaw`
        SELECT accessToken FROM Store WHERE shopDomain = ${shopDomain}
      `;
      const storedToken = (rawStore as { accessToken: string }[])[0].accessToken;

      // Verify stored value is NOT the plaintext token
      expect(storedToken).not.toBe(accessToken);

      // Verify it's our encrypted format
      expect(storedToken.split(':').length).toBe(3); // iv:authTag:ciphertext
    });
  });

  describe('getStoreByDomain', () => {
    it('should return null for non-existent store', async () => {
      const store = await getStoreByDomain('nonexistent.myshopify.com');
      expect(store).toBeNull();
    });

    it('should return store for existing domain', async () => {
      const shopDomain = 'existing-shop.myshopify.com';

      await createStore({
        shopDomain,
        accessToken: encrypt('shpat_test'),
        plan: 'trial',
      });

      const store = await getStoreByDomain(shopDomain);
      expect(store).not.toBeNull();
      expect(store?.shopDomain).toBe(shopDomain);
    });
  });
});
