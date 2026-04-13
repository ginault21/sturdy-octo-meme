import type { ActionFunctionArgs } from 'react-router';

import { getJobById, getStoreByDomain, getFilesForJob } from '../db.server.js';
import { rollbackPriceChanges, parseBackupCSV } from '../lib/rollback/price.server.js';
import { getShopifyClientForStore } from '../lib/shopify/token.server.js';
import type { PriceJobConfig } from '../schemas/wizards/price.js';
import { authenticate } from '../shopify.server.js';

/**
 * POST /api/jobs/:id/rollback - Rollback a completed job
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

  // Can only rollback succeeded jobs
  if (job.status !== 'succeeded') {
    return Response.json(
      { error: `Can only rollback succeeded jobs (current: ${job.status})` },
      { status: 400 }
    );
  }

  try {
    // For now, we'll get the backup from the job config or generate from changelogs
    // In a real implementation, you'd download the backup file from storage

    // Get files associated with this job
    const files = await getFilesForJob(jobId);
    const backupFile = files.find((f: { kind: string }) => f.kind === 'backup');

    if (!backupFile) {
      return Response.json({ error: 'No backup found for this job' }, { status: 400 });
    }

    // TODO: Download backup file from storage
    // For now, we'll create a mock backup from the job summary
    const config = job.config as PriceJobConfig;

    // Get Shopify client
    const shopify = await getShopifyClientForStore(store.id);

    // Fetch current variants to build a backup
    // This is a simplified approach - in production, you'd use the stored backup file
    const { fetchVariantsByFilter } = await import('../lib/wizards/price/filter.server.js');
    const variants = await fetchVariantsByFilter(shopify, config.filter, {
      skuPattern: config.targets.skuPattern,
    });

    // Build backup from current variants
    const backup = variants.map((v: { id: string; productId: string; price: string }) => ({
      variantId: v.id,
      productId: v.productId,
      price: parseFloat(v.price),
    }));

    // Perform rollback
    const result = await rollbackPriceChanges(
      shopify,
      backup,
      () => {} // No-op logger for now - should create a new job for rollback tracking
    );

    return Response.json({
      success: true,
      rollback: result,
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
