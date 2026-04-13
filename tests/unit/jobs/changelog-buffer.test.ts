import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createChangeLogBatch } from '../../../app/db.server';
import { ChangeLogBuffer } from '../../../app/lib/jobs/changelog-buffer.server';

// Mock the db.server module
vi.mock('~/app/db.server.js', () => ({
  createChangeLogBatch: vi.fn(),
}));

describe('ChangeLogBuffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should buffer entries without immediate flush', async () => {
    const buffer = new ChangeLogBuffer('job-123');

    await buffer.add({
      shopifyProductId: 'prod-1',
      shopifyVariantId: 'var-1',
      field: 'price',
      oldValue: '10.00',
      newValue: '15.00',
    });

    expect(buffer.bufferedCount).toBe(1);
    expect(createChangeLogBatch).not.toHaveBeenCalled();
  });

  it('should flush when buffer reaches BATCH_SIZE', async () => {
    const buffer = new ChangeLogBuffer('job-123');

    // Add 500 entries (BATCH_SIZE)
    for (let i = 0; i < 500; i++) {
      await buffer.add({
        shopifyProductId: `prod-${i}`,
        field: 'price',
        oldValue: '10.00',
        newValue: '15.00',
      });
    }

    expect(createChangeLogBatch).toHaveBeenCalledTimes(1);
    expect(createChangeLogBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          jobId: 'job-123',
          shopifyProductId: 'prod-0',
          field: 'price',
        }),
      ])
    );
    expect(buffer.bufferedCount).toBe(0);
  });

  it('should flush remaining entries on explicit flush call', async () => {
    const buffer = new ChangeLogBuffer('job-123');

    await buffer.add({
      shopifyProductId: 'prod-1',
      field: 'price',
      oldValue: '10.00',
      newValue: '15.00',
    });

    expect(buffer.bufferedCount).toBe(1);

    await buffer.flush();

    expect(createChangeLogBatch).toHaveBeenCalledTimes(1);
    expect(buffer.bufferedCount).toBe(0);
  });

  it('should handle empty flush gracefully', async () => {
    const buffer = new ChangeLogBuffer('job-123');

    await buffer.flush();

    expect(createChangeLogBatch).not.toHaveBeenCalled();
  });

  it('should include all entry fields in batch', async () => {
    const buffer = new ChangeLogBuffer('job-123');

    await buffer.add({
      shopifyProductId: 'prod-1',
      shopifyVariantId: 'var-1',
      field: 'inventory',
      oldValue: '100',
      newValue: '50',
    });

    await buffer.flush();

    expect(createChangeLogBatch).toHaveBeenCalledWith([
      {
        jobId: 'job-123',
        shopifyProductId: 'prod-1',
        shopifyVariantId: 'var-1',
        field: 'inventory',
        oldValue: '100',
        newValue: '50',
      },
    ]);
  });
});
