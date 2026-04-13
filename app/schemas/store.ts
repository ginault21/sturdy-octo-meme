import { z } from 'zod';

export const PlanSchema = z.enum(['trial', 'starter', 'growth', 'agency']);

export const StoreSchema = z.object({
  id: z.string(),
  shopDomain: z.string(),
  plan: PlanSchema,
  jobsThisMonth: z.number().int().nonnegative(),
  monthResetAt: z.date().nullable(),
  installedAt: z.date(),
  updatedAt: z.date(),
});

export type Store = z.infer<typeof StoreSchema>;
export type Plan = z.infer<typeof PlanSchema>;

export const CreateStoreSchema = z.object({
  shopDomain: z.string(),
  accessToken: z.string(),
  plan: PlanSchema.optional().default('trial'),
});

export type CreateStoreInput = z.infer<typeof CreateStoreSchema>;

export const QUOTA_LIMITS: Record<Plan, number | null> = {
  trial: 5,
  starter: 50,
  growth: null, // unlimited
  agency: null, // unlimited
};

export function getQuotaLimit(plan: Plan): number | null {
  return QUOTA_LIMITS[plan];
}
