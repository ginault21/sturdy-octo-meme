import type { ActionFunctionArgs } from 'react-router';

import { getJobById, getStoreByDomain } from '../db.server.js';
import { runJob } from '../lib/jobs/runner.server.js';
import { createPriceExecutor } from '../lib/wizards/price/executor.server.js';
import { authenticate } from '../shopify.server.js';

/**
 * POST /api/jobs/:id/execute - Execute a queued job
 */
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const store = await getStoreByDomain(session.shop);
  if (!store) {
    return Response.json({ error: 'Store not found' }, { status: 404 });
  }

  const jobId = params.id;
  if (!jobId) {
    return Response.json({ error: 'Job ID required' }, { status: 400 });
  }

  const job = await getJobById(jobId);
  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  // Security: Ensure job belongs to current store
  if (job.storeId !== store.id) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Can only execute queued jobs
  if (job.status !== 'queued') {
    return Response.json(
      { error: `Job is not in queued status (current: ${job.status})` },
      { status: 400 }
    );
  }

  try {
    // Create appropriate executor based on job type
    let executor;
    if (job.type === 'price_update') {
      executor = createPriceExecutor();
    } else {
      return Response.json({ error: 'Unknown job type' }, { status: 400 });
    }

    // Run the job (this is async and will update the job status)
    // Note: In production, this should be queued to a background worker
    const summary = await runJob(jobId, executor);

    return Response.json({
      success: true,
      summary,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};
