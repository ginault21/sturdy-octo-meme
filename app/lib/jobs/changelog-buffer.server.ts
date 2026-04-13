import { createChangeLogBatch } from '../../db.server.js';

import type { ChangeLogEntry } from './types.server.js';

const BATCH_SIZE = 500;

/**
 * Buffered ChangeLog writer that batches inserts for efficiency
 * during large bulk operations.
 */
export class ChangeLogBuffer {
  private entries: ChangeLogEntry[] = [];

  constructor(private jobId: string) {}

  /**
   * Add an entry to the buffer. Flushes to DB if buffer reaches BATCH_SIZE.
   */
  async add(entry: ChangeLogEntry): Promise<void> {
    this.entries.push(entry);

    if (this.entries.length >= BATCH_SIZE) {
      await this.flush();
    }
  }

  /**
   * Flush remaining entries to the database.
   * Call this at the end of job execution.
   */
  async flush(): Promise<void> {
    if (this.entries.length === 0) return;

    const rows = this.entries.map((entry) => ({
      jobId: this.jobId,
      shopifyProductId: entry.shopifyProductId,
      shopifyVariantId: entry.shopifyVariantId,
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
    }));

    await createChangeLogBatch(rows);
    this.entries = [];
  }

  /**
   * Get the number of entries currently buffered (not yet flushed)
   */
  get bufferedCount(): number {
    return this.entries.length;
  }
}
