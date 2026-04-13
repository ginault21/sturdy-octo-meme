import { describe, it, expect, vi } from 'vitest';

import { LeakyBucket, GraphQLCostTracker } from '../../../app/lib/rate-limiter.server.js';

describe('LeakyBucket', () => {
  it('should allow burst without waiting', async () => {
    const bucket = new LeakyBucket(2, 5);
    const start = Date.now();

    // 5 requests should not wait (within burst)
    for (let i = 0; i < 5; i++) {
      await bucket.throttle();
    }

    expect(Date.now() - start).toBeLessThan(100);
  });

  it('should throttle after burst exhausted', async () => {
    vi.useFakeTimers();
    const bucket = new LeakyBucket(2, 2); // 2 burst, 2/sec

    // Exhaust burst
    await bucket.throttle();
    await bucket.throttle();

    // Third should wait
    const promise = bucket.throttle();
    vi.advanceTimersByTime(500);
    await promise;

    vi.useRealTimers();
  });
});

describe('GraphQLCostTracker', () => {
  it('should allow query within budget', async () => {
    const tracker = new GraphQLCostTracker(1000, 50);
    await tracker.waitForCost(500);
    expect(tracker['currentCost']).toBe(500);
  });

  it('should wait for refill when over budget', async () => {
    vi.useFakeTimers();
    const tracker = new GraphQLCostTracker(1000, 10);

    await tracker.waitForCost(900);

    // Another 200 would exceed, should wait
    const promise = tracker.waitForCost(200);
    vi.advanceTimersByTime(11000); // Wait for 110 points refill
    await promise;

    vi.useRealTimers();
  });
});
