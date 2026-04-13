import { z } from 'zod';

import {
  PriceJobConfigSchema,
  InventoryJobConfigSchema,
  CollectionJobConfigSchema,
} from './wizards/index';

export const JobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobTypeSchema = z.enum(['price_update', 'inventory_update', 'collection_update']);

export type JobType = z.infer<typeof JobTypeSchema>;

export const JobSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z
    .array(z.object({ variantId: z.string(), error: z.string() }))
    .optional()
    .default([]),
});

export type JobSummary = z.infer<typeof JobSummarySchema>;

export const JobConfigSchema = z.discriminatedUnion('wizard', [
  PriceJobConfigSchema,
  InventoryJobConfigSchema,
  CollectionJobConfigSchema,
]);

export const JobSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  config: JobConfigSchema,
  summary: JobSummarySchema.nullable(),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
});

export type Job = z.infer<typeof JobSchema>;

export const CreateJobSchema = z.object({
  storeId: z.string(),
  type: JobTypeSchema,
  config: JobConfigSchema,
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;

export const UpdateJobStatusSchema = z.object({
  status: JobStatusSchema,
  extras: z
    .object({
      summary: JobSummarySchema.optional(),
      startedAt: z.date().optional(),
      finishedAt: z.date().optional(),
    })
    .optional(),
});

export type UpdateJobStatusInput = z.infer<typeof UpdateJobStatusSchema>;

export const JobStatusTransitionSchema = z.object({
  from: JobStatusSchema,
  to: JobStatusSchema,
});

export function isValidStatusTransition(from: JobStatus, to: JobStatus): boolean {
  const validTransitions: Record<JobStatus, JobStatus[]> = {
    queued: ['running', 'cancelled', 'failed'],
    running: ['succeeded', 'failed', 'cancelled'],
    succeeded: [],
    failed: ['queued'],
    cancelled: [],
  };
  return validTransitions[from].includes(to);
}

// File record types for storage operations
export const FileRecordSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  jobId: z.string().nullable(),
  kind: z.string(),
  storageUrl: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
});

export type FileRecord = z.infer<typeof FileRecordSchema>;
