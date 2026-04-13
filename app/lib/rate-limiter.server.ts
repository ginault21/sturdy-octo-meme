export class LeakyBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private ratePerSecond: number,
    private burst: number
  ) {
    this.tokens = burst;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    const tokensToAdd = (elapsedMs / 1000) * this.ratePerSecond;

    this.tokens = Math.min(this.burst, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async throttle(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time for 1 token
    const waitMs = (1 / this.ratePerSecond) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Retry
    return this.throttle();
  }
}

export class GraphQLCostTracker {
  private currentCost: number;
  private lastRefill: number;

  constructor(
    private bucketSize: number = 1000,
    private refillRate: number = 50
  ) {
    this.currentCost = 0;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    const costToRemove = (elapsedMs / 1000) * this.refillRate;

    this.currentCost = Math.max(0, this.currentCost - costToRemove);
    this.lastRefill = now;
  }

  async waitForCost(cost: number): Promise<void> {
    this.refill();

    if (this.currentCost + cost <= this.bucketSize) {
      this.currentCost += cost;
      return;
    }

    // Calculate wait time
    const excess = this.currentCost + cost - this.bucketSize;
    const waitMs = (excess / this.refillRate) * 1000;

    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Retry
    return this.waitForCost(cost);
  }

  recordCost(cost: number): void {
    this.currentCost += cost;
  }
}
