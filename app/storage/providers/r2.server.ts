import type { StorageProvider, StoredObject } from '../../storage.server.js';
import { StorageError } from '../../storage.server.js';

// R2 (Cloudflare R2) storage provider - stub implementation
// Full implementation will be added when R2 is configured

export const r2StorageProvider: StorageProvider = {
  async uploadText({ bucket: _bucket, key: _key, content: _content }): Promise<StoredObject> {
    // TODO: Implement R2 storage upload
    throw new StorageError('R2 storage not yet implemented');
  },

  async downloadText({ bucket: _bucket, key: _key }): Promise<string> {
    // TODO: Implement R2 storage download
    throw new StorageError('R2 storage not yet implemented');
  },

  async deleteObject({ bucket: _bucket, key: _key }): Promise<void> {
    // TODO: Implement R2 storage delete
    throw new StorageError('R2 storage not yet implemented');
  },

  async getSignedDownloadUrl({
    bucket: _bucket,
    key: _key,
    expiresInSeconds: _expiresInSeconds,
  }): Promise<string> {
    // TODO: Implement R2 signed URL generation
    throw new StorageError('R2 storage not yet implemented');
  },
};
