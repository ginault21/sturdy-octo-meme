import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  createStore,
  createJob,
  getJobById,
  getJobsForStore,
  updateJobStatus,
  getRunningJobForStore,
} from '../../../app/db.server';
import { InvalidStatusTransitionError } from '../../../app/schemas/errors';
import { cleanDatabase } from '../../helpers/db';

describe('Job DB helpers', () => {
  let storeId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const store = await createStore({
      shopDomain: 'test-shop.myshopify.com',
      accessToken: 'token',
      plan: 'trial',
    });
    storeId = store.id;
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  describe('createJob', () => {
    it('creates a job with queued status', async () => {
      const job = await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      expect(job.status).toBe('queued');
      expect(job.type).toBe('price_update');
      expect(job.config.wizard).toBe('price');
    });

    it('creates an inventory job', async () => {
      const job = await createJob(storeId, 'inventory_update', {
        wizard: 'inventory',
        locations: ['loc_1'],
        filter: { by: 'tag', tag: 'in-stock' },
        operation: { type: 'set_absolute', quantity: 50 },
      });

      expect(job.type).toBe('inventory_update');
      expect(job.config.wizard).toBe('inventory');
    });

    it('creates a collection job', async () => {
      const job = await createJob(storeId, 'collection_update', {
        wizard: 'collection',
        collectionIds: ['col_1'],
        filter: { by: 'vendor', vendor: 'Acme' },
        operation: { type: 'add' },
      });

      expect(job.type).toBe('collection_update');
      expect(job.config.wizard).toBe('collection');
    });
  });

  describe('getJobById', () => {
    it('returns job with parsed config', async () => {
      await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      const jobs = await getJobsForStore(storeId);
      const job = await getJobById(jobs.jobs[0].id);

      expect(job).not.toBeNull();
      expect(job!.config.wizard).toBe('price');
      expect(job!.config.filter.by).toBe('tag');
    });

    it('returns null for nonexistent job', async () => {
      const job = await getJobById('nonexistent-id');
      expect(job).toBeNull();
    });
  });

  describe('getJobsForStore', () => {
    it('returns jobs for store', async () => {
      await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      await createJob(storeId, 'inventory_update', {
        wizard: 'inventory',
        locations: ['loc_1'],
        filter: { by: 'tag', tag: 'in-stock' },
        operation: { type: 'set_absolute', quantity: 50 },
      });

      const result = await getJobsForStore(storeId);
      expect(result.jobs).toHaveLength(2);
    });

    it('returns jobs in descending order by createdAt', async () => {
      await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      await createJob(storeId, 'inventory_update', {
        wizard: 'inventory',
        locations: ['loc_1'],
        filter: { by: 'tag', tag: 'in-stock' },
        operation: { type: 'set_absolute', quantity: 50 },
      });

      const result = await getJobsForStore(storeId);
      expect(result.jobs[0].type).toBe('inventory_update');
      expect(result.jobs[1].type).toBe('price_update');
    });

    it('supports pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await createJob(storeId, 'price_update', {
          wizard: 'price',
          filter: { by: 'tag', tag: `tag-${i}` },
          operation: { type: 'decrease_pct', pct: 10 },
          targets: { allVariants: true },
        });
      }

      const page1 = await getJobsForStore(storeId, 2);
      expect(page1.jobs).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await getJobsForStore(storeId, 2, page1.nextCursor);
      expect(page2.jobs).toHaveLength(2);
    });
  });

  describe('updateJobStatus', () => {
    it('transitions from queued to running', async () => {
      const job = await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      const updated = await updateJobStatus(job.id, 'running');
      expect(updated.status).toBe('running');
      expect(updated.startedAt).not.toBeNull();
    });

    it('transitions from running to succeeded with summary', async () => {
      const job = await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      await updateJobStatus(job.id, 'running');
      const updated = await updateJobStatus(job.id, 'succeeded', {
        summary: {
          total: 100,
          succeeded: 98,
          failed: 2,
          errors: [{ variantId: 'v1', error: 'Failed' }],
        },
      });

      expect(updated.status).toBe('succeeded');
      expect(updated.finishedAt).not.toBeNull();
      expect(updated.summary).not.toBeNull();
      expect(updated.summary!.succeeded).toBe(98);
    });

    it('transitions from running to failed', async () => {
      const job = await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      await updateJobStatus(job.id, 'running');
      const updated = await updateJobStatus(job.id, 'failed');

      expect(updated.status).toBe('failed');
      expect(updated.finishedAt).not.toBeNull();
    });

    it('allows failed -> queued for retry', async () => {
      const job = await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      await updateJobStatus(job.id, 'running');
      await updateJobStatus(job.id, 'failed');
      const updated = await updateJobStatus(job.id, 'queued');

      expect(updated.status).toBe('queued');
      expect(updated.startedAt).toBeNull();
      expect(updated.finishedAt).toBeNull();
    });

    it('throws on invalid transition', async () => {
      const job = await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      await expect(updateJobStatus(job.id, 'succeeded')).rejects.toThrow(
        InvalidStatusTransitionError
      );
    });
  });

  describe('getRunningJobForStore', () => {
    it('returns running job for store', async () => {
      const job = await createJob(storeId, 'price_update', {
        wizard: 'price',
        filter: { by: 'tag', tag: 'sale' },
        operation: { type: 'decrease_pct', pct: 10 },
        targets: { allVariants: true },
      });

      await updateJobStatus(job.id, 'running');

      const running = await getRunningJobForStore(storeId);
      expect(running).not.toBeNull();
      expect(running!.id).toBe(job.id);
    });

    it('returns null when no running job', async () => {
      const running = await getRunningJobForStore(storeId);
      expect(running).toBeNull();
    });
  });
});
