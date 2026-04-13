import { describe, it, expect, beforeEach } from 'vitest';

import type { StorageProvider } from '../../app/storage.server.js';

export function storageContractTests(
  name: string,
  createProvider: () => StorageProvider,
  cleanup?: () => Promise<void>
) {
  describe(`${name} Storage Provider Contract`, () => {
    let provider: StorageProvider;

    beforeEach(async () => {
      provider = createProvider();
      if (cleanup) await cleanup();
    });

    it('should upload and download text', async () => {
      const content = 'test,data,123\nfoo,bar,456';

      const stored = await provider.uploadText({
        bucket: 'test-bucket',
        key: 'test.csv',
        content,
        contentType: 'text/csv',
      });

      const downloaded = await provider.downloadText({
        bucket: stored.bucket,
        key: stored.key,
      });

      expect(downloaded).toBe(content);
    });

    it('should delete objects', async () => {
      const stored = await provider.uploadText({
        bucket: 'test-bucket',
        key: 'to-delete.csv',
        content: 'data',
        contentType: 'text/csv',
      });

      await provider.deleteObject({
        bucket: stored.bucket,
        key: stored.key,
      });

      await expect(
        provider.downloadText({ bucket: stored.bucket, key: stored.key })
      ).rejects.toThrow();
    });

    it('should generate signed download URLs', async () => {
      const stored = await provider.uploadText({
        bucket: 'test-bucket',
        key: 'signed-url-test.csv',
        content: 'data',
        contentType: 'text/csv',
      });

      const url = await provider.getSignedDownloadUrl({
        bucket: stored.bucket,
        key: stored.key,
        expiresInSeconds: 3600,
      });

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
    });
  });
}
