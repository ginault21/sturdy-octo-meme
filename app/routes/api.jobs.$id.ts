import type { LoaderFunctionArgs } from 'react-router';

import { getJobById, getStoreByDomain } from '../db.server.js';
import { authenticate } from '../shopify.server.js';

/**
 * GET /api/jobs/:id - Get job details
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

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

  return Response.json({ job });
};
