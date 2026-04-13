import type { StorageProvider, StoredObject } from '../../storage.server.js';
import { StorageError } from '../../storage.server.js';

// Supabase storage provider - stub implementation
// Full implementation will be added when Supabase is configured

export const supabaseStorageProvider: StorageProvider = {
  async uploadText({ bucket: _bucket, key: _key, content: _content }): Promise<StoredObject> {
    // TODO: Implement Supabase storage upload
    throw new StorageError('Supabase storage not yet implemented');
  },

  async downloadText({ bucket: _bucket, key: _key }): Promise<string> {
    // TODO: Implement Supabase storage download
    throw new StorageError('Supabase storage not yet implemented');
  },

  async deleteObject({ bucket: _bucket, key: _key }): Promise<void> {
    // TODO: Implement Supabase storage delete
    throw new StorageError('Supabase storage not yet implemented');
  },

  async getSignedDownloadUrl({
    bucket: _bucket,
    key: _key,
    expiresInSeconds: _expiresInSeconds,
  }): Promise<string> {
    // TODO: Implement Supabase signed URL generation
    throw new StorageError('Supabase storage not yet implemented');
  },
};
