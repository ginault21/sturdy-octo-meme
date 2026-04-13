import { describe, it, expect } from 'vitest';

import {
  PriceFilterSchema,
  PriceOperationSchema,
  PriceJobConfigSchema,
  InventoryOperationSchema,
  InventoryJobConfigSchema,
  CollectionOperationSchema,
  CollectionJobConfigSchema,
} from '../../../app/schemas/wizards/index';

describe('PriceFilterSchema', () => {
  it('accepts collection filter', () => {
    const filter = { by: 'collection', collectionId: '123' };
    expect(PriceFilterSchema.parse(filter)).toEqual(filter);
  });

  it('accepts tag filter', () => {
    const filter = { by: 'tag', tag: 'sale' };
    expect(PriceFilterSchema.parse(filter)).toEqual(filter);
  });

  it('accepts vendor filter', () => {
    const filter = { by: 'vendor', vendor: 'Acme' };
    expect(PriceFilterSchema.parse(filter)).toEqual(filter);
  });

  it('accepts type filter', () => {
    const filter = { by: 'type', productType: 'shoes' };
    expect(PriceFilterSchema.parse(filter)).toEqual(filter);
  });

  it('accepts manual filter', () => {
    const filter = { by: 'manual', productIds: ['p1', 'p2'] };
    expect(PriceFilterSchema.parse(filter)).toEqual(filter);
  });

  it('rejects unknown filter type', () => {
    expect(() => PriceFilterSchema.parse({ by: 'unknown' })).toThrow();
  });

  it('rejects empty productIds for manual filter', () => {
    expect(() => PriceFilterSchema.parse({ by: 'manual', productIds: [] })).toThrow();
  });
});

describe('PriceOperationSchema', () => {
  it('accepts set_absolute', () => {
    const op = { type: 'set_absolute', price: 29.99 };
    expect(PriceOperationSchema.parse(op)).toEqual(op);
  });

  it('accepts increase_pct', () => {
    const op = { type: 'increase_pct', pct: 10 };
    expect(PriceOperationSchema.parse(op)).toEqual(op);
  });

  it('accepts decrease_pct', () => {
    const op = { type: 'decrease_pct', pct: 15 };
    expect(PriceOperationSchema.parse(op)).toEqual(op);
  });

  it('accepts increase_amount', () => {
    const op = { type: 'increase_amount', amount: 5 };
    expect(PriceOperationSchema.parse(op)).toEqual(op);
  });

  it('accepts decrease_amount', () => {
    const op = { type: 'decrease_amount', amount: 3.5 };
    expect(PriceOperationSchema.parse(op)).toEqual(op);
  });

  it('rejects negative price for set_absolute', () => {
    expect(() => PriceOperationSchema.parse({ type: 'set_absolute', price: -5 })).toThrow();
  });

  it('rejects zero price for set_absolute', () => {
    expect(() => PriceOperationSchema.parse({ type: 'set_absolute', price: 0 })).toThrow();
  });

  it('rejects negative pct for increase_pct', () => {
    expect(() => PriceOperationSchema.parse({ type: 'increase_pct', pct: -5 })).toThrow();
  });
});

describe('PriceJobConfigSchema', () => {
  it('accepts valid price job config', () => {
    const config = {
      wizard: 'price',
      filter: { by: 'tag', tag: 'sale' },
      operation: { type: 'decrease_pct', pct: 10 },
      targets: { allVariants: true },
    };
    const parsed = PriceJobConfigSchema.parse(config);
    expect(parsed.wizard).toBe('price');
    expect(parsed.operation.type).toBe('decrease_pct');
  });

  it('accepts config with sku pattern', () => {
    const config = {
      wizard: 'price',
      filter: { by: 'collection', collectionId: 'col-123' },
      operation: { type: 'set_absolute', price: 19.99 },
      targets: { allVariants: false, skuPattern: 'SHOE-*' },
    };
    const parsed = PriceJobConfigSchema.parse(config);
    expect(parsed.targets.skuPattern).toBe('SHOE-*');
  });

  it('rejects non-price wizard type', () => {
    const config = {
      wizard: 'inventory',
      filter: { by: 'tag', tag: 'sale' },
      operation: { type: 'decrease_pct', pct: 10 },
      targets: { allVariants: true },
    };
    expect(() => PriceJobConfigSchema.parse(config)).toThrow();
  });
});

describe('InventoryOperationSchema', () => {
  it('accepts set_absolute', () => {
    const op = { type: 'set_absolute', quantity: 50 };
    expect(InventoryOperationSchema.parse(op)).toEqual(op);
  });

  it('accepts adjust with positive delta', () => {
    const op = { type: 'adjust', delta: 10 };
    expect(InventoryOperationSchema.parse(op)).toEqual(op);
  });

  it('accepts adjust with negative delta', () => {
    const op = { type: 'adjust', delta: -5 };
    expect(InventoryOperationSchema.parse(op)).toEqual(op);
  });

  it('rejects negative quantity for set_absolute', () => {
    expect(() => InventoryOperationSchema.parse({ type: 'set_absolute', quantity: -1 })).toThrow();
  });

  it('rejects non-integer quantity', () => {
    expect(() =>
      InventoryOperationSchema.parse({ type: 'set_absolute', quantity: 10.5 })
    ).toThrow();
  });
});

describe('InventoryJobConfigSchema', () => {
  it('accepts valid inventory job config', () => {
    const config = {
      wizard: 'inventory',
      locations: ['loc_1', 'loc_2'],
      filter: { by: 'tag', tag: 'in-stock' },
      operation: { type: 'set_absolute', quantity: 100 },
    };
    const parsed = InventoryJobConfigSchema.parse(config);
    expect(parsed.wizard).toBe('inventory');
    expect(parsed.locations).toHaveLength(2);
  });

  it('rejects empty locations array', () => {
    const config = {
      wizard: 'inventory',
      locations: [],
      filter: { by: 'tag', tag: 'in-stock' },
      operation: { type: 'set_absolute', quantity: 100 },
    };
    expect(() => InventoryJobConfigSchema.parse(config)).toThrow();
  });
});

describe('CollectionOperationSchema', () => {
  it('accepts add operation', () => {
    const op = { type: 'add' };
    expect(CollectionOperationSchema.parse(op)).toEqual(op);
  });

  it('accepts remove operation', () => {
    const op = { type: 'remove' };
    expect(CollectionOperationSchema.parse(op)).toEqual(op);
  });

  it('accepts replace operation', () => {
    const op = { type: 'replace', collectionIds: ['col_1', 'col_2'] };
    expect(CollectionOperationSchema.parse(op)).toEqual(op);
  });

  it('rejects replace with empty collectionIds', () => {
    expect(() => CollectionOperationSchema.parse({ type: 'replace', collectionIds: [] })).toThrow();
  });
});

describe('CollectionJobConfigSchema', () => {
  it('accepts valid collection job config', () => {
    const config = {
      wizard: 'collection',
      collectionIds: ['col_1'],
      filter: { by: 'tag', tag: 'summer' },
      operation: { type: 'add' },
    };
    const parsed = CollectionJobConfigSchema.parse(config);
    expect(parsed.wizard).toBe('collection');
    expect(parsed.operation.type).toBe('add');
  });

  it('rejects non-collection wizard type', () => {
    const config = {
      wizard: 'price',
      collectionIds: ['col_1'],
      filter: { by: 'tag', tag: 'summer' },
      operation: { type: 'add' },
    };
    expect(() => CollectionJobConfigSchema.parse(config)).toThrow();
  });
});
