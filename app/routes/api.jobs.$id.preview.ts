import type { LoaderFunctionArgs } from 'react-router';

import { getJobById, getStoreByDomain } from '../db.server.js';
import { getShopifyClientForStore } from '../lib/shopify/token.server.js';
import { computePriceDiffs } from '../lib/wizards/price/diff.server.js';
import { fetchVariantsByFilter } from '../lib/wizards/price/filter.server.js';
import type { PriceJobConfig } from '../schemas/wizards/price.js';
import { authenticate } from '../shopify.server.js';

/**
 * GET /api/jobs/:id/preview - Get a preview of what changes a job would make
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

  // Can only preview queued jobs
  if (job.status !== 'queued') {
    return Response.json(
      { error: `Job is not in queued status (current: ${job.status})` },
      { status: 400 }
    );
  }

  try {
    const config = job.config as PriceJobConfig;

    // Get Shopify client
    const shopify = await getShopifyClientForStore(store.id);

    // Fetch variants (limit preview to 100 items)
    const variants = await fetchVariantsByFilter(shopify, config.filter, {
      limit: 100,
      skuPattern: config.targets.skuPattern,
    });

    if (variants.length === 0) {
      return Response.json({
        preview: {
          totalVariants: 0,
          changes: [],
          summary: {
            total: 0,
            willChange: 0,
            totalDelta: 0,
            avgDelta: 0,
            minNewPrice: 0,
            maxNewPrice: 0,
            errors: [],
          },
        },
      });
    }

    // Compute diffs
    const inputs = variants.map((v: { id: string; productId: string; price: string }) => ({
      variantId: v.id,
      productId: v.productId,
      currentPrice: parseFloat(v.price),
    }));

    const diffResult = computePriceDiffs(inputs, config.operation);

    // Return preview (limit to first 50 changes for display)
    return Response.json({
      preview: {
        totalVariants: variants.length,
        changes: diffResult.diffs.slice(0, 50),
        summary: diffResult.summary,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};
