import { TokenExpiredError } from '../../schemas/errors.js';
import { LeakyBucket, GraphQLCostTracker } from '../rate-limiter.server.js';

export interface ShopifyClient {
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
  rest<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T>;
}

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody: unknown
  ) {
    super(message);
    this.name = 'ShopifyApiError';
  }
}

// Simple heuristic to estimate GraphQL query cost
// Counts the depth and complexity of the query
function estimateQueryCost(query: string): number {
  // Basic estimation: count fields and multiply by nesting depth
  const lines = query.split('\n');
  let cost = 1; // Base cost
  let depth = 0;
  let maxDepth = 0;

  for (const line of lines) {
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    depth += openBraces - closeBraces;
    maxDepth = Math.max(maxDepth, depth);

    // Count fields (rough estimate)
    const fields = (line.match(/\w+(:|{|$)/g) || []).length;
    cost += fields;
  }

  // Apply depth multiplier
  return Math.min(cost * (1 + maxDepth * 0.1), 1000);
}

export async function createShopifyClient(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyClient> {
  const baseUrl = `https://${shopDomain}/admin/api/2025-01`;

  // REST: 2 req/s with burst of 10
  const restLimiter = new LeakyBucket(2, 10);

  // GraphQL: 1000 cost bucket, 50/sec refill
  const graphqlLimiter = new GraphQLCostTracker(1000, 50);

  return {
    async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
      // 1. Estimate query cost
      const estimatedCost = Math.ceil(estimateQueryCost(query));

      // 2. Wait for cost budget
      await graphqlLimiter.waitForCost(estimatedCost);

      // 3. Make request
      const response = await fetch(`${baseUrl}/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      // 4. Parse response
      const data = (await response.json()) as {
        data?: T;
        errors?: unknown[];
        extensions?: {
          cost?: {
            actualQueryCost?: number;
            requestedQueryCost?: number;
          };
        };
      };

      // 5. Record actual cost if available
      const actualCost = data.extensions?.cost?.actualQueryCost;
      if (actualCost !== undefined) {
        graphqlLimiter.recordCost(actualCost);
      }

      // 6. Handle errors
      if (!response.ok) {
        if (response.status === 401) {
          throw new TokenExpiredError();
        }
        throw new ShopifyApiError(
          `GraphQL request failed: ${response.statusText}`,
          response.status,
          data
        );
      }

      if (data.errors && data.errors.length > 0) {
        throw new ShopifyApiError(`GraphQL errors: ${JSON.stringify(data.errors)}`, 200, data);
      }

      return data.data as T;
    },

    async rest<T>(
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      path: string,
      body?: unknown
    ): Promise<T> {
      // 1. Throttle REST request
      await restLimiter.throttle();

      // 2. Make request
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      // 3. Handle response
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new TokenExpiredError();
        }
        throw new ShopifyApiError(
          `REST request failed: ${response.statusText}`,
          response.status,
          data
        );
      }

      return data as T;
    },
  };
}
