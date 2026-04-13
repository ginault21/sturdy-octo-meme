import type {
  Job,
  JobSummary,
  PriceJobConfig,
  InventoryJobConfig,
  CollectionJobConfig,
} from '../../schemas/index.js';
import type { ShopifyClient } from '../shopify/client.server.js';

export type JobConfig = PriceJobConfig | InventoryJobConfig | CollectionJobConfig;

/**
 * A single entry to be recorded in the ChangeLog
 */
export interface ChangeLogEntry {
  shopifyProductId: string;
  shopifyVariantId?: string;
  field: string;
  oldValue: string;
  newValue: string;
}

/**
 * Context passed to job executors
 */
export interface JobContext {
  /** The job being executed */
  job: Job;
  /** Authenticated Shopify API client */
  shopify: ShopifyClient;
  /** Add a changelog entry (buffered, flushed at end) */
  logChange: (entry: ChangeLogEntry) => void;
}

/**
 * Function signature for job executors
 * Executors receive context and return a summary of what was processed
 */
export type JobExecutor = (ctx: JobContext) => Promise<JobSummary>;
