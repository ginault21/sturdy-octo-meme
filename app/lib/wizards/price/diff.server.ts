import type { PriceOperation, PriceDiffRow, BackupRow } from '../../../schemas/wizards/price.js';

export interface DiffInput {
  variantId: string;
  productId: string;
  currentPrice: number;
}

export interface DiffResult {
  diffs: PriceDiffRow[];
  backup: BackupRow[];
  summary: {
    total: number;
    willChange: number;
    totalDelta: number;
    avgDelta: number;
    minNewPrice: number;
    maxNewPrice: number;
    errors: Array<{ variantId: string; error: string }>;
  };
}

/**
 * Compute price diffs for a list of variants based on an operation.
 * This is a pure function - no side effects.
 */
export function computePriceDiffs(inputs: DiffInput[], operation: PriceOperation): DiffResult {
  const diffs: PriceDiffRow[] = [];
  const backup: BackupRow[] = [];
  const errors: Array<{ variantId: string; error: string }> = [];

  for (const input of inputs) {
    const currentPrice = input.currentPrice;
    const newPrice = calculateNewPrice(currentPrice, operation);

    // Validate result
    if (newPrice < 0) {
      errors.push({
        variantId: input.variantId,
        error: `Price would be negative: ${newPrice.toFixed(2)}`,
      });
      continue;
    }

    if (newPrice > 999999.99) {
      errors.push({
        variantId: input.variantId,
        error: `Price exceeds maximum: ${newPrice.toFixed(2)}`,
      });
      continue;
    }

    // Round to 2 decimal places
    const roundedNewPrice = Math.round(newPrice * 100) / 100;
    const delta = roundedNewPrice - currentPrice;

    // Add to backup (always store original)
    backup.push({
      variantId: input.variantId,
      productId: input.productId,
      price: currentPrice,
    });

    // Only add to diffs if price actually changes
    if (Math.abs(delta) >= 0.01) {
      diffs.push({
        variantId: input.variantId,
        productId: input.productId,
        oldPrice: currentPrice,
        newPrice: roundedNewPrice,
        delta,
      });
    }
  }

  return {
    diffs,
    backup,
    summary: calculateSummary(diffs, inputs.length, errors),
  };
}

/**
 * Calculate the new price based on the operation.
 */
function calculateNewPrice(currentPrice: number, operation: PriceOperation): number {
  switch (operation.type) {
    case 'set_absolute':
      return operation.price;

    case 'increase_pct':
      return currentPrice * (1 + operation.pct / 100);

    case 'decrease_pct':
      return currentPrice * (1 - operation.pct / 100);

    case 'increase_amount':
      return currentPrice + operation.amount;

    case 'decrease_amount':
      return currentPrice - operation.amount;

    default:
      throw new Error(`Unknown operation type`);
  }
}

/**
 * Calculate summary statistics for the diff.
 */
function calculateSummary(
  diffs: PriceDiffRow[],
  totalInputs: number,
  errors: Array<{ variantId: string; error: string }>
): DiffResult['summary'] {
  if (diffs.length === 0) {
    return {
      total: totalInputs,
      willChange: 0,
      totalDelta: 0,
      avgDelta: 0,
      minNewPrice: 0,
      maxNewPrice: 0,
      errors,
    };
  }

  const totalDelta = diffs.reduce((sum, d) => sum + d.delta, 0);
  const avgDelta = totalDelta / diffs.length;
  const newPrices = diffs.map((d) => d.newPrice);

  return {
    total: totalInputs,
    willChange: diffs.length,
    totalDelta,
    avgDelta,
    minNewPrice: Math.min(...newPrices),
    maxNewPrice: Math.max(...newPrices),
    errors,
  };
}
