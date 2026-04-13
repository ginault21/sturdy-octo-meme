import type { BackupRow } from '../../schemas/wizards/price.js';
import type { ChangeLogEntry } from '../jobs/types.server.js';
import type { ShopifyClient } from '../shopify/client.server.js';

export interface RollbackResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ variantId: string; error: string }>;
  restoredVariants: Array<{
    variantId: string;
    productId: string;
    oldPrice: number;
    newPrice: number;
  }>;
}

/**
 * Rollback price changes using a backup CSV.
 */
export async function rollbackPriceChanges(
  shopify: ShopifyClient,
  backup: BackupRow[],
  logChange: (entry: ChangeLogEntry) => void
): Promise<RollbackResult> {
  const errors: Array<{ variantId: string; error: string }> = [];
  const restoredVariants: RollbackResult['restoredVariants'] = [];

  // Group by product for bulk updates
  const backupByProduct = groupByProduct(backup);

  for (const [productId, productBackups] of Object.entries(backupByProduct)) {
    try {
      const response = await shopify.graphql<{
        productVariantsBulkUpdate?: {
          productVariants?: Array<{ id: string; price: string }>;
          userErrors?: Array<{ field: string[]; message: string }>;
        };
      }>(
        `
        mutation RollbackProductVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
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
          variants: productBackups.map((b) => ({
            id: b.variantId,
            price: b.price.toFixed(2),
          })),
        }
      );

      if (response.productVariantsBulkUpdate?.userErrors?.length) {
        for (const error of response.productVariantsBulkUpdate.userErrors) {
          const variantId = error.field.find((f: string) => f.includes('Variant')) || 'unknown';
          errors.push({ variantId, error: error.message });
        }
      }

      // Track successful restorations
      const updatedVariants = new Map<string, number>(
        response.productVariantsBulkUpdate?.productVariants?.map(
          (v: { id: string; price: string }) => [v.id, parseFloat(v.price)]
        ) || []
      );

      for (const backupRow of productBackups) {
        const currentPrice = updatedVariants.get(backupRow.variantId);
        if (currentPrice !== undefined && currentPrice !== null) {
          restoredVariants.push({
            variantId: backupRow.variantId,
            productId: backupRow.productId,
            oldPrice: currentPrice, // Current price before rollback
            newPrice: backupRow.price, // Original price from backup
          });

          logChange({
            shopifyProductId: backupRow.productId,
            shopifyVariantId: backupRow.variantId,
            field: 'price',
            oldValue: currentPrice.toFixed(2),
            newValue: backupRow.price.toFixed(2),
          });
        }
      }
    } catch (error) {
      for (const backupRow of productBackups) {
        errors.push({
          variantId: backupRow.variantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    total: backup.length,
    succeeded: restoredVariants.length,
    failed: errors.length,
    errors,
    restoredVariants,
  };
}

/**
 * Parse backup CSV content into BackupRow objects.
 */
export function parseBackupCSV(csvContent: string): BackupRow[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());

  // Expected headers: variantId, productId, price
  const variantIdIndex = headers.indexOf('variantId');
  const productIdIndex = headers.indexOf('productId');
  const priceIndex = headers.indexOf('price');

  if (variantIdIndex === -1 || productIdIndex === -1 || priceIndex === -1) {
    throw new Error(
      `Invalid backup CSV format. Expected headers: variantId, productId, price. Got: ${headers.join(', ')}`
    );
  }

  const rows: BackupRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map((v) => v.trim());

    rows.push({
      variantId: values[variantIdIndex],
      productId: values[productIdIndex],
      price: parseFloat(values[priceIndex]),
    });
  }

  return rows;
}

/**
 * Convert backup rows to CSV format.
 */
export function backupToCSV(backup: BackupRow[]): string {
  const headers = ['variantId', 'productId', 'price'];
  const lines = [headers.join(',')];

  for (const row of backup) {
    lines.push(`${row.variantId},${row.productId},${row.price}`);
  }

  return lines.join('\n');
}

/**
 * Group backup rows by product ID.
 */
function groupByProduct(backup: BackupRow[]): Record<string, BackupRow[]> {
  const grouped: Record<string, BackupRow[]> = {};

  for (const row of backup) {
    if (!grouped[row.productId]) {
      grouped[row.productId] = [];
    }
    grouped[row.productId].push(row);
  }

  return grouped;
}
