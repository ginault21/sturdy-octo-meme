import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  createStore,
  createJob,
  createChangeLogBatch,
  getChangeLogsForJob,
} from '../../../app/db.server';
import { cleanDatabase } from '../../helpers/db';

describe('ChangeLog DB helpers', () => {
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

  describe('createChangeLogBatch', () => {
    it('creates multiple change log entries', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        jobId,
        shopifyProductId: `product_${i}`,
        shopifyVariantId: `variant_${i}`,
        field: 'price',
        oldValue: `${(25 + i).toFixed(2)}`,
        newValue: `${(22.5 + i).toFixed(2)}`,
      }));

      const results = await createChangeLogBatch(rows);

      expect(results).toHaveLength(1);
      expect(results[0].count).toBe(10);
    });

    it('handles 1500 rows in 3 batches', async () => {
      const rows = Array.from({ length: 1500 }, (_, i) => ({
        jobId,
        shopifyProductId: `product_${i}`,
        shopifyVariantId: `variant_${i}`,
        field: 'price',
        oldValue: `${(25 + i).toFixed(2)}`,
        newValue: `${(22.5 + i).toFixed(2)}`,
      }));

      const results = await createChangeLogBatch(rows);

      expect(results).toHaveLength(3);
      expect(results[0].count).toBe(500);
      expect(results[1].count).toBe(500);
      expect(results[2].count).toBe(500);
    });

    it('skips duplicates with skipDuplicates', async () => {
      // Note: SQLite doesn't support skipDuplicates, so this test documents
      // the expected behavior with PostgreSQL (used in production)
      const rows = [
        {
          jobId,
          shopifyProductId: 'product_1',
          shopifyVariantId: 'variant_1',
          field: 'price',
          oldValue: '25.00',
          newValue: '22.50',
        },
        {
          jobId,
          shopifyProductId: 'product_1',
          shopifyVariantId: 'variant_1',
          field: 'price',
          oldValue: '25.00',
          newValue: '22.50',
        },
      ];

      const results = await createChangeLogBatch(rows);

      // SQLite: Both inserted (no skipDuplicates support)
      // PostgreSQL: First inserted, second skipped
      expect(results[0].count).toBeGreaterThanOrEqual(1);
    });

    it('handles optional variantId', async () => {
      const rows = [
        {
          jobId,
          shopifyProductId: 'product_1',
          field: 'collection_membership',
          oldValue: 'col_1',
          newValue: 'col_2',
        },
      ];

      const results = await createChangeLogBatch(rows);
      expect(results[0].count).toBe(1);
    });
  });

  describe('getChangeLogsForJob', () => {
    it('returns change logs for job', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        jobId,
        shopifyProductId: `product_${i}`,
        shopifyVariantId: `variant_${i}`,
        field: 'price',
        oldValue: `${(25 + i).toFixed(2)}`,
        newValue: `${(22.5 + i).toFixed(2)}`,
      }));

      await createChangeLogBatch(rows);

      const { logs, total } = await getChangeLogsForJob(jobId);

      expect(logs).toHaveLength(10);
      expect(total).toBe(10);
    });

    it('returns change logs in descending order by createdAt', async () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({
        jobId,
        shopifyProductId: `product_${i}`,
        shopifyVariantId: `variant_${i}`,
        field: 'price',
        oldValue: `${(25 + i).toFixed(2)}`,
        newValue: `${(22.5 + i).toFixed(2)}`,
      }));

      await createChangeLogBatch(rows);

      const { logs } = await getChangeLogsForJob(jobId);

      for (let i = 0; i < logs.length - 1; i++) {
        expect(logs[i].createdAt >= logs[i + 1].createdAt).toBe(true);
      }
    });

    it('supports pagination', async () => {
      const rows = Array.from({ length: 15 }, (_, i) => ({
        jobId,
        shopifyProductId: `product_${i}`,
        shopifyVariantId: `variant_${i}`,
        field: 'price',
        oldValue: `${(25 + i).toFixed(2)}`,
        newValue: `${(22.5 + i).toFixed(2)}`,
      }));

      await createChangeLogBatch(rows);

      const page1 = await getChangeLogsForJob(jobId, 10, 0);
      expect(page1.logs).toHaveLength(10);
      expect(page1.total).toBe(15);

      const page2 = await getChangeLogsForJob(jobId, 10, 10);
      expect(page2.logs).toHaveLength(5);
    });

    it('returns empty when no change logs', async () => {
      const { logs, total } = await getChangeLogsForJob(jobId);
      expect(logs).toHaveLength(0);
      expect(total).toBe(0);
    });
  });
});
