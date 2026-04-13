import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  createStore,
  createJob,
  createFileRecord,
  getFilesForJob,
  getFileById,
} from '../../../app/db.server';
import { cleanDatabase } from '../../helpers/db';

describe('File DB helpers', () => {
  let storeId: string;
  let jobId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const store = await createStore({
      shopDomain: 'test-shop.myshopify.com',
      accessToken: 'token',
      plan: 'trial',
    });
    storeId = store.id;

    const job = await createJob(storeId, 'price_update', {
      wizard: 'price',
      filter: { by: 'tag', tag: 'sale' },
      operation: { type: 'decrease_pct', pct: 10 },
      targets: { allVariants: true },
    });
    jobId = job.id;
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  describe('createFileRecord', () => {
    it('creates a file record with metadata', async () => {
      const file = await createFileRecord({
        storeId,
        jobId,
        kind: 'backup',
        storageUrl: 'https://storage.example.com/backup.csv',
        metadata: {
          provider: 'supabase',
          bucket: 'backups',
          key: 'store_123/job_456/backup.csv',
          contentType: 'text/csv',
        },
      });

      expect(file.id).toBeDefined();
      expect(file.kind).toBe('backup');
      expect(file.storageUrl).toBe('https://storage.example.com/backup.csv');
      expect(file.metadata).not.toBeNull();
      expect(file.metadata.provider).toBe('supabase');
    });

    it('creates a file record without jobId', async () => {
      const file = await createFileRecord({
        storeId,
        kind: 'export',
        storageUrl: 'https://storage.example.com/export.csv',
      });

      expect(file.jobId).toBeNull();
    });

    it('creates a file record without storageUrl', async () => {
      const file = await createFileRecord({
        storeId,
        jobId,
        kind: 'export',
        metadata: { provider: 'r2', bucket: 'exports', key: 'export.csv' },
      });

      expect(file.storageUrl).toBeNull();
    });
  });

  describe('getFilesForJob', () => {
    it('returns files for job', async () => {
      await createFileRecord({
        storeId,
        jobId,
        kind: 'backup',
        storageUrl: 'https://storage.example.com/backup1.csv',
        metadata: { provider: 'supabase' },
      });

      await createFileRecord({
        storeId,
        jobId,
        kind: 'backup',
        storageUrl: 'https://storage.example.com/backup2.csv',
        metadata: { provider: 'supabase' },
      });

      const files = await getFilesForJob(jobId);

      expect(files).toHaveLength(2);
    });

    it('returns files in descending order by createdAt', async () => {
      await createFileRecord({
        storeId,
        jobId,
        kind: 'backup',
        storageUrl: 'https://storage.example.com/backup1.csv',
      });

      await createFileRecord({
        storeId,
        jobId,
        kind: 'export',
        storageUrl: 'https://storage.example.com/export1.csv',
      });

      const files = await getFilesForJob(jobId);

      expect(files[0].kind).toBe('export');
      expect(files[1].kind).toBe('backup');
    });

    it('returns empty array when no files', async () => {
      const files = await getFilesForJob(jobId);
      expect(files).toHaveLength(0);
    });
  });

  describe('getFileById', () => {
    it('returns file by id', async () => {
      const created = await createFileRecord({
        storeId,
        jobId,
        kind: 'backup',
        storageUrl: 'https://storage.example.com/backup.csv',
        metadata: { provider: 'supabase' },
      });

      const file = await getFileById(created.id);

      expect(file).not.toBeNull();
      expect(file!.id).toBe(created.id);
      expect(file!.metadata.provider).toBe('supabase');
    });

    it('returns null for nonexistent file', async () => {
      const file = await getFileById('nonexistent-id');
      expect(file).toBeNull();
    });
  });

  describe('provider-neutral metadata', () => {
    it('stores metadata that is readable regardless of provider', async () => {
      const file1 = await createFileRecord({
        storeId,
        jobId,
        kind: 'backup',
        storageUrl: 'https://supabase.storage.example.com/backup.csv',
        metadata: {
          provider: 'supabase',
          bucket: 'backups',
          key: 'store/job/backup.csv',
          contentType: 'text/csv',
        },
      });

      const file2 = await createFileRecord({
        storeId,
        jobId,
        kind: 'backup',
        storageUrl: 'https://r2.example.com/backups/backup.csv',
        metadata: {
          provider: 'r2',
          bucket: 'backups',
          key: 'store/job/backup.csv',
          contentType: 'text/csv',
        },
      });

      const retrieved1 = await getFileById(file1.id);
      const retrieved2 = await getFileById(file2.id);

      expect(retrieved1!.metadata.provider).toBe('supabase');
      expect(retrieved1!.metadata.key).toBe('store/job/backup.csv');

      expect(retrieved2!.metadata.provider).toBe('r2');
      expect(retrieved2!.metadata.key).toBe('store/job/backup.csv');
    });
  });
});
