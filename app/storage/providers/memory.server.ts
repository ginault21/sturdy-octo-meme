import type { StorageProvider, StoredObject } from '../../storage.server.js';
import { StorageError } from '../../storage.server.js';

const storage = new Map<string, string>();

export const memoryStorageProvider: StorageProvider = {
  async uploadText({ bucket, key, content }): Promise<StoredObject> {
    const fullKey = `${bucket}:${key}`;
    storage.set(fullKey, content);
    return {
      provider: 'memory',
      bucket,
      key,
      url: `memory://${bucket}/${key}`,
    };
  },

  async downloadText({ bucket, key }): Promise<string> {
    const fullKey = `${bucket}:${key}`;
    const content = storage.get(fullKey);
    if (!content) {
      throw new StorageError(`Object not found: ${bucket}/${key}`);
    }
    return content;
  },

  async deleteObject({ bucket, key }): Promise<void> {
    storage.delete(`${bucket}:${key}`);
  },

  async getSignedDownloadUrl({ bucket, key }): Promise<string> {
    // For memory provider, just return the memory:// URL
    return `memory://${bucket}/${key}`;
  },
};

// Helper to clear storage for tests
export function clearMemoryStorage(): void {
  storage.clear();
}
