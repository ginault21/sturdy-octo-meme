import { describe, it, expect } from 'vitest';

import {
  JobStatusSchema,
  JobTypeSchema,
  JobSummarySchema,
  isValidStatusTransition,
} from '../../../app/schemas/job';
import { PlanSchema, QUOTA_LIMITS, getQuotaLimit } from '../../../app/schemas/store';

describe('JobStatusSchema', () => {
  it('accepts valid statuses', () => {
    const validStatuses = ['queued', 'running', 'succeeded', 'failed', 'cancelled'];
    for (const status of validStatuses) {
      expect(JobStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects invalid status', () => {
    expect(() => JobStatusSchema.parse('invalid')).toThrow();
    expect(() => JobStatusSchema.parse('')).toThrow();
  });
});

describe('JobTypeSchema', () => {
  it('accepts valid types', () => {
    const validTypes = ['price_update', 'inventory_update', 'collection_update'];
    for (const type of validTypes) {
      expect(JobTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid type', () => {
    expect(() => JobTypeSchema.parse('invalid')).toThrow();
  });
});

describe('PlanSchema', () => {
  it('accepts valid plans', () => {
    const validPlans = ['trial', 'starter', 'growth', 'agency'];
    for (const plan of validPlans) {
      expect(PlanSchema.parse(plan)).toBe(plan);
    }
  });

  it('rejects invalid plan', () => {
    expect(() => PlanSchema.parse('basic')).toThrow();
    expect(() => PlanSchema.parse('pro')).toThrow();
  });
});

describe('JobSummarySchema', () => {
  it('accepts valid summary', () => {
    const summary = {
      total: 100,
      succeeded: 98,
      failed: 2,
      errors: [{ variantId: 'v1', error: 'Price negative' }],
    };
    const parsed = JobSummarySchema.parse(summary);
    expect(parsed.total).toBe(100);
    expect(parsed.succeeded).toBe(98);
    expect(parsed.failed).toBe(2);
    expect(parsed.errors).toHaveLength(1);
  });

  it('accepts summary without errors', () => {
    const summary = {
      total: 100,
      succeeded: 100,
      failed: 0,
    };
    const parsed = JobSummarySchema.parse(summary);
    expect(parsed.errors).toEqual([]);
  });

  it('rejects negative counts', () => {
    expect(() => JobSummarySchema.parse({ total: -1, succeeded: 0, failed: 0 })).toThrow();
  });
});

describe('isValidStatusTransition', () => {
  it('allows queued -> running', () => {
    expect(isValidStatusTransition('queued', 'running')).toBe(true);
  });

  it('allows queued -> cancelled', () => {
    expect(isValidStatusTransition('queued', 'cancelled')).toBe(true);
  });

  it('allows queued -> failed (pre-execution failure)', () => {
    expect(isValidStatusTransition('queued', 'failed')).toBe(true);
  });

  it('allows running -> succeeded', () => {
    expect(isValidStatusTransition('running', 'succeeded')).toBe(true);
  });

  it('allows running -> failed', () => {
    expect(isValidStatusTransition('running', 'failed')).toBe(true);
  });

  it('allows running -> cancelled', () => {
    expect(isValidStatusTransition('running', 'cancelled')).toBe(true);
  });

  it('allows failed -> queued (retry)', () => {
    expect(isValidStatusTransition('failed', 'queued')).toBe(true);
  });

  it('rejects succeeded -> any (terminal)', () => {
    expect(isValidStatusTransition('succeeded', 'queued')).toBe(false);
    expect(isValidStatusTransition('succeeded', 'failed')).toBe(false);
  });

  it('rejects cancelled -> any (terminal)', () => {
    expect(isValidStatusTransition('cancelled', 'queued')).toBe(false);
  });

  it('rejects invalid transitions', () => {
    expect(isValidStatusTransition('queued', 'succeeded')).toBe(false);
    expect(isValidStatusTransition('running', 'queued')).toBe(false);
  });
});

describe('QUOTA_LIMITS', () => {
  it('has correct limits', () => {
    expect(QUOTA_LIMITS.trial).toBe(5);
    expect(QUOTA_LIMITS.starter).toBe(50);
    expect(QUOTA_LIMITS.growth).toBeNull();
    expect(QUOTA_LIMITS.agency).toBeNull();
  });

  it('getQuotaLimit returns correct values', () => {
    expect(getQuotaLimit('trial')).toBe(5);
    expect(getQuotaLimit('starter')).toBe(50);
    expect(getQuotaLimit('growth')).toBeNull();
    expect(getQuotaLimit('agency')).toBeNull();
  });
});
