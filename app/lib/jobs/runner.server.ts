import {
  getJobById,
  updateJobStatus,
  getRunningJobForStore,
  checkAndIncrementJobQuota,
} from '../../db.server.js';
import { JobLockError, TokenExpiredError } from '../../schemas/errors.js';
import type { JobSummary, JobType, JobStatus } from '../../schemas/index.js';
import { getShopifyClientForStore } from '../shopify/token.server.js';

import { ChangeLogBuffer } from './changelog-buffer.server.js';
import type { JobExecutor, JobContext, JobConfig } from './types.server.js';


/**
 * Check if there's already a running job for this store.
 * Returns true if lock acquired (no other job running), false otherwise.
 */
async function acquireJobLock(storeId: string, jobId: string): Promise<boolean> {
  const existing = await getRunningJobForStore(storeId);
  if (existing && existing.id !== jobId) {
    return false;
  }
  return true;
}

/**
 * Execute a job with full lifecycle management:
 * 1. Acquire lock (prevent concurrent jobs for same store)
 * 2. Check quota
 * 3. Transition to 'running'
 * 4. Execute the provided executor function
 * 5. Flush changelogs
 * 6. Transition to 'succeeded' or 'failed'
 *
 * TokenExpiredError is caught and re-thrown with a merchant-friendly message.
 */
export async function runJob(jobId: string, executor: JobExecutor): Promise<JobSummary> {
  // 1. Load job
  const jobResult = await getJobById(jobId);
  if (!jobResult) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Cast DB result to Job type
  const job = {
    ...jobResult,
    type: jobResult.type as JobType,
    status: jobResult.status as JobStatus,
    config: jobResult.config as JobConfig,
    summary: jobResult.summary,
  };

  if (job.status !== 'queued') {
    throw new Error(`Job ${jobId} is not in 'queued' status (current: ${job.status})`);
  }

  // 2. Acquire lock
  const lockAcquired = await acquireJobLock(job.storeId, jobId);
  if (!lockAcquired) {
    throw new JobLockError(job.storeId);
  }

  // 3. Check quota
  try {
    await checkAndIncrementJobQuota(job.storeId);
  } catch (error) {
    // Quota error should fail the job without starting it
    await updateJobStatus(jobId, 'failed', {
      summary: {
        total: 0,
        succeeded: 0,
        failed: 0,
        errors: [{ variantId: 'quota', error: (error as Error).message }],
      },
    });
    throw error;
  }

  // 4. Transition to running
  await updateJobStatus(jobId, 'running');

  // 5. Get Shopify client
  const shopify = await getShopifyClientForStore(job.storeId);

  // 6. Set up changelog buffer
  const changelogBuffer = new ChangeLogBuffer(jobId);

  // 7. Create context for executor
  const ctx: JobContext = {
    job,
    shopify,
    logChange: (entry) => {
      // Fire and forget - buffer handles batching
      void changelogBuffer.add(entry);
    },
  };

  try {
    // 8. Execute the job
    const summary = await executor(ctx);

    // 9. Flush any remaining changelogs
    await changelogBuffer.flush();

    // 10. Transition to succeeded
    await updateJobStatus(jobId, 'succeeded', { summary });

    return summary;
  } catch (error) {
    // 11. Handle errors
    let errorMessage: string;

    if (error instanceof TokenExpiredError) {
      errorMessage =
        'Your Shopify session expired during this job. Please reconnect your store from Settings to continue.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }

    // Flush any changelogs that were recorded before the error
    await changelogBuffer.flush();

    // Transition to failed
    const failedSummary: JobSummary = {
      total: 0,
      succeeded: 0,
      failed: 0,
      errors: [{ variantId: 'job', error: errorMessage }],
    };

    await updateJobStatus(jobId, 'failed', { summary: failedSummary });

    // Re-throw the original error for upstream handling
    throw error;
  }
}
