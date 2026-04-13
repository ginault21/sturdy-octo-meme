import { z } from 'zod';

import { PriceFilterSchema } from './price';

export const InventoryOperationSchema = z.union([
  z.object({
    type: z.literal('set_absolute'),
    quantity: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('adjust'), delta: z.number().int() }),
]);

export type InventoryOperation = z.infer<typeof InventoryOperationSchema>;

export const InventoryJobConfigSchema = z.object({
  wizard: z.literal('inventory'),
  locations: z.array(z.string()).min(1),
  filter: PriceFilterSchema,
  operation: InventoryOperationSchema,
});

export type InventoryJobConfig = z.infer<typeof InventoryJobConfigSchema>;

export const InventoryDiffRowSchema = z.object({
  variantId: z.string(),
  inventoryItemId: z.string(),
  locationId: z.string(),
  locationName: z.string(),
  oldQuantity: z.number().int().nonnegative(),
  newQuantity: z.number().int().nonnegative(),
});

export type InventoryDiffRow = z.infer<typeof InventoryDiffRowSchema>;

export const InventoryBackupRowSchema = z.object({
  variantId: z.string(),
  inventoryItemId: z.string(),
  locationId: z.string(),
  quantity: z.number().int().nonnegative(),
});

export type InventoryBackupRow = z.infer<typeof InventoryBackupRowSchema>;
