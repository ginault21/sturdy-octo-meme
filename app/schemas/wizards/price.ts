import { z } from 'zod';

export const PriceFilterSchema = z.union([
  z.object({ by: z.literal('collection'), collectionId: z.string() }),
  z.object({ by: z.literal('tag'), tag: z.string() }),
  z.object({ by: z.literal('vendor'), vendor: z.string() }),
  z.object({ by: z.literal('type'), productType: z.string() }),
  z.object({ by: z.literal('manual'), productIds: z.array(z.string()).min(1) }),
]);

export type PriceFilter = z.infer<typeof PriceFilterSchema>;

export const PriceOperationSchema = z.union([
  z.object({ type: z.literal('set_absolute'), price: z.number().positive() }),
  z.object({ type: z.literal('increase_pct'), pct: z.number().positive() }),
  z.object({ type: z.literal('decrease_pct'), pct: z.number().positive() }),
  z.object({
    type: z.literal('increase_amount'),
    amount: z.number().positive(),
  }),
  z.object({
    type: z.literal('decrease_amount'),
    amount: z.number().positive(),
  }),
]);

export type PriceOperation = z.infer<typeof PriceOperationSchema>;

export const PriceJobConfigSchema = z.object({
  wizard: z.literal('price'),
  filter: PriceFilterSchema,
  operation: PriceOperationSchema,
  targets: z.object({
    allVariants: z.boolean(),
    skuPattern: z.string().optional(),
  }),
});

export type PriceJobConfig = z.infer<typeof PriceJobConfigSchema>;

export const PriceDiffRowSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  oldPrice: z.number(),
  newPrice: z.number(),
  delta: z.number(),
});

export type PriceDiffRow = z.infer<typeof PriceDiffRowSchema>;

export const BackupRowSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  price: z.number(),
});

export type BackupRow = z.infer<typeof BackupRowSchema>;
