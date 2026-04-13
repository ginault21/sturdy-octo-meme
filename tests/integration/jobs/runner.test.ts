import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createStore, createJob, getJobById, updateJobStatus } from '../../../app/db.server';
import { runJob } from '../../../app/lib/jobs/runner.server';
import type { JobExecutor, JobContext } from '../../../app/lib/jobs/types.server';
import { getShopifyClientForStore } from '../../../app/lib/shopify/token.server';
import { TokenExpiredError, JobLockError, QuotaExceededError } from '../../../app/schemas/errors';
import type { JobSummary, PriceJobConfig } from '../../../app/schemas/index';
import { cleanDatabase, prisma } from '../../helpers/db';

// Mock the Shopify client
vi.mock('../../../app/lib/shopify/token.server', () => ({
  getShopifyClientForStore: vi.fn(),
}));

describe('Job Runner Integration', () => {
  let store: Awaited<ReturnType<typeof createStore>>;
  let mockShopifyClient: { graphql: ReturnType<typeof vi.fn>; rest: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();

    // Create test store
    store = await createStore({
      shopDomain: 'test-store.myshopify.com',
      accessToken: 'encrypted-token',
      plan: 'trial',
    });

    // Setup mock Shopify client
    mockShopifyClient = {
      graphql: vi.fn(),
      rest: vi.fn(),
    };
    vi.mocked(getShopifyClientForStore).mockResolvedValue(
      mockShopifyClient as unknown as Awaited<ReturnType<typeof getShopifyClientForStore>>
    );
  });

  describe('successful execution', () => {
    it('should execute a job and transition through statuses', async () => {
      // Create job with valid config
      const config: PriceJobConfig = {
        wizard: 'price',
        filter: { by: 'collection', collectionId: 'gid://shopify/Collection/123' },
        operation: { type: 'set_absolute', price: 100 },
        targets: { allVariants: true },
      };
      const job = await createJob(store.id, 'price_update', config);

      expect(job.status).toBe('queued');

      // Mock executor that succeeds
      const executor: JobExecutor = async (ctx: JobContext): Promise<JobSummary> => {
        ctx.logChange({
          shopifyProductId: 'prod-1',
          shopifyVariantId: 'var-1',
          field: 'price',
          oldValue: '50.00',
          newValue: '100.00',
        });

        return {
          total: 1,
          succeeded: 1,
          failed: 0,
          errors: [],
        };
      };

      // Run job
      const summary = await runJob(job.id, executor);

      // Verify results
      expect(summary).toEqual({
        total: 1,
        succeeded: 1,
        failed: 0,
        errors: [],
      });

      // Verify job status updated
      const updatedJob = await getJobById(job.id);
      expect(updatedJob?.status).toBe('succeeded');
      expect(updatedJob?.summary).toEqual(summary);
      expect(updatedJob?.startedAt).not.toBeNull();
      expect(updatedJob?.finishedAt).not.toBeNull();
    });

    it('should buffer and flush changelogs', async () => {
      const config: PriceJobConfig = {
        wizard: 'price',
        filter: { by: 'collection', collectionId: 'gid://shopify/Collection/123' },
        operation: { type: 'set_absolute', price: 100 },
        targets: { allVariants: true },
      };
      const job = await createJob(store.id, 'price_update', config);

      const executor: JobExecutor = async (ctx: JobContext): Promise<JobSummary> => {
        for (let i = 0; i < 5; i++) {
          ctx.logChange({
            shopifyProductId: `prod-${i}`,
            field: 'price',
            oldValue: '50.00',
            newValue: '100.00',
          });
        }

        return { total: 5, succeeded: 5, failed: 0, errors: [] };
      };

      await runJob(job.id, executor);

      // Verify changelogs were created
      const changelogs = await prisma.changeLog.findMany({ where: { jobId: job.id } });
      expect(changelogs).toHaveLength(5);
    });
  });

  describe('error handling', () => {
    it('should handle executor errors and transition to failed', async () => {
      const config: PriceJobConfig = {
        wizard: 'price',
        filter: { by: 'collection', collectionId: 'gid://shopify/Collection/123' },
        operation: { type: 'set_absolute', price: 100 },
        targets: { allVariants: true },
      };
      const job = await createJob(store.id, 'price_update', config);

      const executor: JobExecutor = async (): Promise<JobSummary> => {
        throw new Error('Something went wrong');
      };

      await expect(runJob(job.id, executor)).rejects.toThrow('Something went wrong');

      const updatedJob = await getJobById(job.id);
      expect(updatedJob?.status).toBe('failed');
      expect(updatedJob?.summary?.errors).toHaveLength(1);
      expect(updatedJob?.summary?.errors[0].error).toContain('Something went wrong');
    });

    it('should handle TokenExpiredError with merchant-friendly message', async () => {
      const config: PriceJobConfig = {
        wizard: 'price',
        filter: { by: 'collection', collectionId: 'gid://shopify/Collection/123' },
        operation: { type: 'set_absolute', price: 100 },
        targets: { allVariants: true },
      };
      const job = await createJob(store.id, 'price_update', config);

      const executor: JobExecutor = async (): Promise<JobSummary> => {
        throw new TokenExpiredError();
      };

      await expect(runJob(job.id, executor)).rejects.toThrow(TokenExpiredError);

      const updatedJob = await getJobById(job.id);
      expect(updatedJob?.status).toBe('failed');
      expect(updatedJob?.summary?.errors[0].error).toContain('Your Shopify session expired');
    });

    it('should prevent concurrent jobs for same store', async () => {
      // Create first job and mark it as running
      const config1: PriceJobConfig = {
        wizard: 'price',
        filter: { by: 'collection', collectionId: 'gid://shopify/Collection/123' },
        operation: { type: 'set_absolute', price: 100 },
        targets: { allVariants: true },
      };
      const job1 = await createJob(store.id, 'price_update', config1);
      await updateJobStatus(job1.id, 'running');

      // Create second job
      const config2: PriceJobConfig = {
        wizard: 'price',
        filter: { by: 'collection', collectionId: 'gid://shopify/Collection/456' },
        operation: { type: 'set_absolute', price: 200 },
        targets: { allVariants: true },
      };
      const job2 = await createJob(store.id, 'price_update', config2);

      const executor: JobExecutor = async (): Promise<JobSummary> => {
        return { total: 1, succeeded: 1, failed: 0, errors: [] };
      };

      await expect(runJob(job2.id, executor)).rejects.toThrow(JobLockError);

      const updatedJob2 = await getJobById(job2.id);
      expect(updatedJob2?.status).toBe('queued'); // Should not have transitioned
    });

    it('should fail job when quota exceeded', async () => {
      // Create store at quota limit (trial = 5 jobs/month)
      await prisma.store.update({
        where: { id: store.id },
        data: { jobsThisMonth: 5 },
      });

      const config: PriceJobConfig = {
        wizard: 'price',
        filter: { by: 'collection', collectionId: 'gid://shopify/Collection/123' },
        operation: { type: 'set_absolute', price: 100 },
        targets: { allVariants: true },
      };
      const job = await createJob(store.id, 'price_update', config);

      const executor: JobExecutor = async (): Promise<JobSummary> => {
        return { total: 1, succeeded: 1, failed: 0, errors: [] };
      };

      await expect(runJob(job.id, executor)).rejects.toThrow(QuotaExceededError);

      const updatedJob = await getJobById(job.id);
      expect(updatedJob?.status).toBe('failed');
    });
  });

  describe('context provision', () => {
    it('should provide correct context to executor', async () => {
      const config: PriceJobConfig = {
        wizard: 'price',
        filter: { by: 'collection', collectionId: 'gid://shopify/Collection/123' },
        operation: { type: 'set_absolute', price: 100 },
        targets: { allVariants: true },
      };
      const job = await createJob(store.id, 'price_update', config);

      let receivedJobId: string | null = null;
      let receivedShopify: unknown = null;
      let receivedLogChangeType: string | null = null;

      const executor: JobExecutor = async (ctx: JobContext): Promise<JobSummary> => {
        receivedJobId = ctx.job.id;
        receivedShopify = ctx.shopify;
        receivedLogChangeType = typeof ctx.logChange;
        return { total: 0, succeeded: 0, failed: 0, errors: [] };
      };

      await runJob(job.id, executor);

      expect(receivedJobId).toBe(job.id);
      expect(receivedShopify).toBe(mockShopifyClient);
      expect(receivedLogChangeType).toBe('function');
    });
  });
});
