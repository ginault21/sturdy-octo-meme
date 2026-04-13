import { describe, it, expect } from 'vitest';

import { computePriceDiffs, type DiffInput } from '../../../../app/lib/wizards/price/diff.server';
import type { PriceOperation } from '../../../../app/schemas/wizards/price';

describe('computePriceDiffs', () => {
  describe('set_absolute operation', () => {
    it('should set all prices to the same value', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 10.0 },
        { variantId: 'v2', productId: 'p1', currentPrice: 20.0 },
        { variantId: 'v3', productId: 'p2', currentPrice: 30.0 },
      ];

      const operation: PriceOperation = { type: 'set_absolute', price: 15.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs).toHaveLength(3);
      expect(result.diffs[0].newPrice).toBe(15.0);
      expect(result.diffs[1].newPrice).toBe(15.0);
      expect(result.diffs[2].newPrice).toBe(15.0);
      expect(result.diffs[0].delta).toBe(5.0);
      expect(result.diffs[1].delta).toBe(-5.0);
      expect(result.diffs[2].delta).toBe(-15.0);
    });

    it('should exclude variants already at target price', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 15.0 },
        { variantId: 'v2', productId: 'p1', currentPrice: 20.0 },
      ];

      const operation: PriceOperation = { type: 'set_absolute', price: 15.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs).toHaveLength(1);
      expect(result.diffs[0].variantId).toBe('v2');
    });
  });

  describe('increase_pct operation', () => {
    it('should increase prices by percentage', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 100.0 },
        { variantId: 'v2', productId: 'p1', currentPrice: 50.0 },
      ];

      const operation: PriceOperation = { type: 'increase_pct', pct: 10 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs[0].newPrice).toBe(110.0);
      expect(result.diffs[1].newPrice).toBe(55.0);
      expect(result.diffs[0].delta).toBe(10.0);
      expect(result.diffs[1].delta).toBe(5.0);
    });

    it('should handle 0% increase (no change)', () => {
      const inputs: DiffInput[] = [{ variantId: 'v1', productId: 'p1', currentPrice: 100.0 }];

      const operation: PriceOperation = { type: 'increase_pct', pct: 0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs).toHaveLength(0);
    });
  });

  describe('decrease_pct operation', () => {
    it('should decrease prices by percentage', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 100.0 },
        { variantId: 'v2', productId: 'p1', currentPrice: 50.0 },
      ];

      const operation: PriceOperation = { type: 'decrease_pct', pct: 20 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs[0].newPrice).toBe(80.0);
      expect(result.diffs[1].newPrice).toBe(40.0);
      expect(result.diffs[0].delta).toBe(-20.0);
      expect(result.diffs[1].delta).toBe(-10.0);
    });

    it('should prevent prices from going negative', () => {
      const inputs: DiffInput[] = [{ variantId: 'v1', productId: 'p1', currentPrice: 10.0 }];

      const operation: PriceOperation = { type: 'decrease_pct', pct: 150 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs).toHaveLength(0);
      expect(result.summary.errors).toHaveLength(1);
      expect(result.summary.errors[0].error).toContain('negative');
    });
  });

  describe('increase_amount operation', () => {
    it('should increase prices by fixed amount', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 50.0 },
        { variantId: 'v2', productId: 'p1', currentPrice: 75.0 },
      ];

      const operation: PriceOperation = { type: 'increase_amount', amount: 5.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs[0].newPrice).toBe(55.0);
      expect(result.diffs[1].newPrice).toBe(80.0);
      expect(result.diffs[0].delta).toBe(5.0);
      expect(result.diffs[1].delta).toBe(5.0);
    });
  });

  describe('decrease_amount operation', () => {
    it('should decrease prices by fixed amount', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 50.0 },
        { variantId: 'v2', productId: 'p1', currentPrice: 75.0 },
      ];

      const operation: PriceOperation = { type: 'decrease_amount', amount: 10.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs[0].newPrice).toBe(40.0);
      expect(result.diffs[1].newPrice).toBe(65.0);
      expect(result.diffs[0].delta).toBe(-10.0);
      expect(result.diffs[1].delta).toBe(-10.0);
    });

    it('should prevent prices from going negative', () => {
      const inputs: DiffInput[] = [{ variantId: 'v1', productId: 'p1', currentPrice: 5.0 }];

      const operation: PriceOperation = { type: 'decrease_amount', amount: 10.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs).toHaveLength(0);
      expect(result.summary.errors).toHaveLength(1);
    });
  });

  describe('price limits', () => {
    it('should prevent prices exceeding maximum', () => {
      const inputs: DiffInput[] = [{ variantId: 'v1', productId: 'p1', currentPrice: 999999.0 }];

      const operation: PriceOperation = { type: 'increase_pct', pct: 100 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs).toHaveLength(0);
      expect(result.summary.errors).toHaveLength(1);
      expect(result.summary.errors[0].error).toContain('maximum');
    });
  });

  describe('rounding', () => {
    it('should round to 2 decimal places', () => {
      const inputs: DiffInput[] = [{ variantId: 'v1', productId: 'p1', currentPrice: 33.33 }];

      const operation: PriceOperation = { type: 'increase_pct', pct: 10 };
      const result = computePriceDiffs(inputs, operation);

      // 33.33 * 1.10 = 36.663, should round to 36.66
      expect(result.diffs[0].newPrice).toBe(36.66);
    });
  });

  describe('backup generation', () => {
    it('should always include all variants in backup', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 10.0 },
        { variantId: 'v2', productId: 'p1', currentPrice: 10.0 }, // No change
      ];

      const operation: PriceOperation = { type: 'set_absolute', price: 10.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.backup).toHaveLength(2);
      expect(result.backup[0].price).toBe(10.0);
      expect(result.backup[1].price).toBe(10.0);
    });

    it('should preserve variant and product IDs in backup', () => {
      const inputs: DiffInput[] = [
        {
          variantId: 'gid://shopify/ProductVariant/123',
          productId: 'gid://shopify/Product/456',
          currentPrice: 25.0,
        },
      ];

      const operation: PriceOperation = { type: 'increase_amount', amount: 5.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.backup[0].variantId).toBe('gid://shopify/ProductVariant/123');
      expect(result.backup[0].productId).toBe('gid://shopify/Product/456');
    });
  });

  describe('summary statistics', () => {
    it('should calculate correct summary', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 100.0 },
        { variantId: 'v2', productId: 'p1', currentPrice: 200.0 },
        { variantId: 'v3', productId: 'p2', currentPrice: 300.0 },
      ];

      const operation: PriceOperation = { type: 'decrease_pct', pct: 10 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.summary.total).toBe(3);
      expect(result.summary.willChange).toBe(3);
      expect(result.summary.totalDelta).toBe(-60); // -10 -20 -30
      expect(result.summary.avgDelta).toBe(-20);
      expect(result.summary.minNewPrice).toBe(90);
      expect(result.summary.maxNewPrice).toBe(270);
      expect(result.summary.errors).toHaveLength(0);
    });

    it('should handle empty input', () => {
      const inputs: DiffInput[] = [];
      const operation: PriceOperation = { type: 'set_absolute', price: 10.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.diffs).toHaveLength(0);
      expect(result.backup).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.willChange).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should track multiple errors', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 10.0 },
        { variantId: 'v2', productId: 'p1', currentPrice: 5.0 },
      ];

      const operation: PriceOperation = { type: 'decrease_amount', amount: 20.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.summary.errors).toHaveLength(2);
      expect(result.summary.errors[0].variantId).toBe('v1');
      expect(result.summary.errors[1].variantId).toBe('v2');
    });

    it('should continue processing after errors', () => {
      const inputs: DiffInput[] = [
        { variantId: 'v1', productId: 'p1', currentPrice: 5.0 }, // Will fail
        { variantId: 'v2', productId: 'p1', currentPrice: 100.0 }, // Will succeed
      ];

      const operation: PriceOperation = { type: 'decrease_amount', amount: 10.0 };
      const result = computePriceDiffs(inputs, operation);

      expect(result.summary.errors).toHaveLength(1);
      expect(result.diffs).toHaveLength(1);
      expect(result.diffs[0].variantId).toBe('v2');
    });
  });
});
