import { createFileRecord } from './db.server.js';
import type { FileRecord } from './schemas/index.js';

export interface StorageProvider {
  uploadText(input: {
    bucket: string;
    key: string;
    content: string;
    contentType: string;
  }): Promise<StoredObject>;
  downloadText(input: { bucket: string; key: string }): Promise<string>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
  getSignedDownloadUrl(input: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
  }): Promise<string>;
}

export type StoredObject = {
  provider: 'supabase' | 'r2' | 'memory';
  bucket: string;
  key: string;
  url?: string;
};

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// Lazy imports to avoid circular dependencies
async function getMemoryProvider(): Promise<StorageProvider> {
  const { memoryStorageProvider } = await import('./storage/providers/memory.server.js');
  return memoryStorageProvider;
}

async function getSupabaseProvider(): Promise<StorageProvider> {
  const { supabaseStorageProvider } = await import('./storage/providers/supabase.server.js');
  return supabaseStorageProvider;
}

async function getR2Provider(): Promise<StorageProvider> {
  const { r2StorageProvider } = await import('./storage/providers/r2.server.js');
  return r2StorageProvider;
}

export async function getStorageProvider(): Promise<StorageProvider> {
  const provider = process.env.STORAGE_PROVIDER || 'memory';

  switch (provider) {
    case 'supabase':
      return getSupabaseProvider();
    case 'r2':
      return getR2Provider();
    case 'memory':
    default:
      return getMemoryProvider();
  }
}

// App-facing helpers
export async function uploadBackupFile(input: {
  storeId: string;
  jobId: string;
  content: string;
  filename?: string;
}): Promise<FileRecord> {
  // 1. Generate key
  const key = `${input.storeId}/${input.jobId}/${input.filename || 'backup.csv'}`;

  // 2. Get storage provider
  const provider = await getStorageProvider();

  // 3. Upload content
  const stored = await provider.uploadText({
    bucket: 'backups',
    key,
    content: input.content,
    contentType: 'text/csv',
  });

  // 4. Create File record in DB
  const file = await createFileRecord({
    storeId: input.storeId,
    jobId: input.jobId,
    kind: 'backup',
    storageUrl: stored.url || `${stored.provider}://${stored.bucket}/${stored.key}`,
    metadata: {
      provider: stored.provider,
      bucket: stored.bucket,
      key: stored.key,
    },
  });

  return file;
}

export async function downloadBackupFile(file: FileRecord): Promise<string> {
  // 1. Parse metadata from File record
  const metadata = file.metadata as {
    provider?: string;
    bucket?: string;
    key?: string;
  } | null;

  if (!metadata?.bucket || !metadata?.key) {
    throw new StorageError('Invalid file metadata');
  }

  // 2. Get storage provider
  const provider = await getStorageProvider();

  // 3. Download and return content
  return provider.downloadText({
    bucket: metadata.bucket,
    key: metadata.key,
  });
}

export async function getBackupDownloadUrl(
  file: FileRecord,
  expiresInSeconds: number = 3600
): Promise<string> {
  // Parse metadata from File record
  const metadata = file.metadata as {
    provider?: string;
    bucket?: string;
    key?: string;
  } | null;

  if (!metadata?.bucket || !metadata?.key) {
    throw new StorageError('Invalid file metadata');
  }

  // Return signed URL via storage provider
  const provider = await getStorageProvider();
  return provider.getSignedDownloadUrl({
    bucket: metadata.bucket,
    key: metadata.key,
    expiresInSeconds,
  });
}
