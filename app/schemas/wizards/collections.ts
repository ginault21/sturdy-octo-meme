import { z } from 'zod';

import { PriceFilterSchema } from './price';

export const CollectionOperationSchema = z.union([
  z.object({ type: z.literal('add') }),
  z.object({ type: z.literal('remove') }),
  z.object({
    type: z.literal('replace'),
    collectionIds: z.array(z.string()).min(1),
  }),
]);

export type CollectionOperation = z.infer<typeof CollectionOperationSchema>;

export const CollectionJobConfigSchema = z.object({
  wizard: z.literal('collection'),
  collectionIds: z.array(z.string()),
  filter: PriceFilterSchema,
  operation: CollectionOperationSchema,
});

export type CollectionJobConfig = z.infer<typeof CollectionJobConfigSchema>;

export const MembershipDiffRowSchema = z.object({
  productId: z.string(),
  action: z.enum(['add', 'remove']),
  collectionId: z.string(),
});

export type MembershipDiffRow = z.infer<typeof MembershipDiffRowSchema>;

export const MembershipBackupRowSchema = z.object({
  productId: z.string(),
  collectionIds: z.array(z.string()),
});

export type MembershipBackupRow = z.infer<typeof MembershipBackupRowSchema>;
