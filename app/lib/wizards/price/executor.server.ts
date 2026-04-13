import type { PriceJobConfig, PriceDiffRow } from '../../../schemas/wizards/price.js';
import type { JobContext, JobExecutor } from '../../jobs/types.server.js';
import type { ShopifyClient } from '../../shopify/client.server.js';

import { computePriceDiffs } from './diff.server.js';
import { fetchVariantsByFilter } from './filter.server.js';

export interface PriceExecutorOptions {
  /** Maximum number of variants to process in one job */
  maxVariants?: number;
  /** Whether this is a dry run (preview only) */
  dryRun?: boolean;
}

/**
 * Create a price executor for the job runner.
 */
export function createPriceExecutor(options?: PriceExecutorOptions): JobExecutor {
  return async (ctx: JobContext) => {
    const config = ctx.job.config as PriceJobConfig;
    const maxVariants = options?.maxVariants ?? 10000;

    // 1. Fetch variants matching filter
    const variants = await fetchVariantsByFilter(ctx.shopify, config.filter, {
      limit: maxVariants,
      skuPattern: config.targets.skuPattern,
    });

    if (variants.length === 0) {
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
      };
    }

    // 2. Compute diffs
    const inputs = variants.map((v) => ({
      variantId: v.id,
      productId: v.productId,
      currentPrice: parseFloat(v.price),
    }));

    const diffResult = computePriceDiffs(inputs, config.operation);

    // 3. If dry run, just return preview
    if (options?.dryRun) {
      return {
        total: diffResult.diffs.length,
        succeeded: diffResult.diffs.length,
        failed: 0,
        errors: [],
      };
    }

    // 4. Apply changes
    const result = await applyPriceChanges(ctx.shopify, diffResult.diffs, ctx.logChange);

    // 5. Create backup file (in a real implementation, this would upload to storage)
    // For now, we just log it
    if (result.succeeded > 0) {
      // TODO: Upload backup to storage
      console.log(`Backup for job ${ctx.job.id}:`, diffResult.backup);
    }

    return result;
  };
}

/**
 * Apply price changes to Shopify via GraphQL mutations.
 */
async function applyPriceChanges(
  shopify: JobContext['shopify'],
  diffs: PriceDiffRow[],
  logChange: JobContext['logChange']
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ variantId: string; error: string }>;
}> {
  const errors: Array<{ variantId: string; error: string }> = [];
  let succeeded = 0;

  // Group diffs by product for bulk update
  const diffsByProduct = groupByProduct(diffs);

  for (const [productId, productDiffs] of Object.entries(diffsByProduct)) {
    try {
      // Use productVariantsBulkUpdate mutation
      const response = await shopify.graphql<{
        productVariantsBulkUpdate?: {
          productVariants?: Array<{ id: string }>;
          userErrors?: Array<{ field: string[]; message: string }>;
        };
      }>(
        `
        mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
        {
          productId,
          variants: productDiffs.map((diff) => ({
            id: diff.variantId,
            price: diff.newPrice.toFixed(2),
          })),
        }
      );

      if (response.productVariantsBulkUpdate?.userErrors?.length) {
        // Handle partial failures
        for (const error of response.productVariantsBulkUpdate.userErrors) {
          // Extract variant ID from field if possible
          const variantId = error.field.find((f) => f.includes('Variant')) || 'unknown';
          errors.push({ variantId, error: error.message });
        }
      }

      // Log successful changes
      const updatedVariantIds = new Set(
        response.productVariantsBulkUpdate?.productVariants?.map((v) => v.id) || []
      );

      for (const diff of productDiffs) {
        if (updatedVariantIds.has(diff.variantId)) {
          succeeded++;
          logChange({
            shopifyProductId: diff.productId,
            shopifyVariantId: diff.variantId,
            field: 'price',
            oldValue: diff.oldPrice.toFixed(2),
            newValue: diff.newPrice.toFixed(2),
          });
        }
      }
    } catch (error) {
      // All variants in this product failed
      for (const diff of productDiffs) {
        errors.push({
          variantId: diff.variantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    total: diffs.length,
    succeeded,
    failed: errors.length,
    errors,
  };
}

/**
 * Group diffs by product ID for bulk updates.
 */
function groupByProduct(diffs: PriceDiffRow[]): Record<string, PriceDiffRow[]> {
  const grouped: Record<string, PriceDiffRow[]> = {};

  for (const diff of diffs) {
    if (!grouped[diff.productId]) {
      grouped[diff.productId] = [];
    }
    grouped[diff.productId].push(diff);
  }

  return grouped;
}
