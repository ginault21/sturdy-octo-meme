import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import {
  getStoreByDomain,
  createJob,
  getJobsForStore,
  checkAndIncrementJobQuota,
} from '../db.server.js';
import { PriceJobConfigSchema } from '../schemas/wizards/price.js';
import { authenticate } from '../shopify.server.js';

/**
 * GET /api/jobs - List jobs for the current store
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const store = await getStoreByDomain(session.shop);
  if (!store) {
    return Response.json({ error: 'Store not found' }, { status: 404 });
  }

  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const cursor = url.searchParams.get('cursor') || undefined;

  const result = await getJobsForStore(store.id, limit, cursor);

  return Response.json(result);
};

/**
 * POST /api/jobs - Create a new job
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const store = await getStoreByDomain(session.shop);
  if (!store) {
    return Response.json({ error: 'Store not found' }, { status: 404 });
  }

  try {
    // Check quota before creating job
    await checkAndIncrementJobQuota(store.id);
  } catch (error) {
    return Response.json(
      {
        error: 'Quota exceeded',
        message: error instanceof Error ? error.message : 'Monthly job quota exceeded',
      },
      { status: 429 }
    );
  }

  const body = await request.json();

  // Validate based on wizard type
  let config;
  try {
    if (body.wizard === 'price') {
      config = PriceJobConfigSchema.parse(body);
    } else {
      return Response.json({ error: 'Unknown wizard type' }, { status: 400 });
    }
  } catch (error) {
    return Response.json(
      {
        error: 'Invalid configuration',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }

  const job = await createJob(store.id, 'price_update', config);

  return Response.json({ job }, { status: 201 });
};
