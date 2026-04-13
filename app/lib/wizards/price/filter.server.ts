import type { PriceFilter } from '../../../schemas/wizards/price.js';
import type { ShopifyClient } from '../../shopify/client.server.js';

export interface Variant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice?: string;
}

// Type definitions for GraphQL responses
interface CollectionProductsResponse {
  collection?: {
    products: {
      edges: Array<{
        node: {
          id: string;
          variants: {
            edges: Array<{
              node: {
                id: string;
                title: string;
                sku: string;
                price: string;
                compareAtPrice?: string;
              };
            }>;
          };
        };
        cursor: string;
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
    };
  };
}

interface ProductsQueryResponse {
  products: {
    edges: Array<{
      node: {
        id: string;
        variants: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              sku: string;
              price: string;
              compareAtPrice?: string;
            };
          }>;
        };
      };
      cursor: string;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

/**
 * Fetch variants matching the given filter criteria.
 * This is a server-only function that queries Shopify's GraphQL API.
 */
export async function fetchVariantsByFilter(
  shopify: ShopifyClient,
  filter: PriceFilter,
  options?: {
    limit?: number;
    skuPattern?: string;
  }
): Promise<Variant[]> {
  switch (filter.by) {
    case 'collection':
      return fetchVariantsByCollection(shopify, filter.collectionId, options);
    case 'tag':
      return fetchVariantsByTag(shopify, filter.tag, options);
    case 'vendor':
      return fetchVariantsByVendor(shopify, filter.vendor, options);
    case 'type':
      return fetchVariantsByType(shopify, filter.productType, options);
    case 'manual':
      return fetchVariantsByProductIds(shopify, filter.productIds, options);
    default:
      throw new Error(`Unknown filter type: ${filter}`);
  }
}

/**
 * Fetch all variants from products in a specific collection.
 */
async function fetchVariantsByCollection(
  shopify: ShopifyClient,
  collectionId: string,
  options?: { limit?: number; skuPattern?: string }
): Promise<Variant[]> {
  const variants: Variant[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  const limit = options?.limit ?? 1000;

  while (hasNextPage && variants.length < limit) {
    const response: CollectionProductsResponse = await shopify.graphql<CollectionProductsResponse>(
      `
      query GetProductsInCollection($collectionId: ID!, $first: Int!, $after: String) {
        collection(id: $collectionId) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      sku
                      price
                      compareAtPrice
                    }
                  }
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `,
      {
        collectionId,
        first: Math.min(50, limit - variants.length),
        after: cursor,
      }
    );

    if (!response.collection) {
      break;
    }

    for (const productEdge of response.collection.products.edges) {
      const product = productEdge.node;
      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        if (!options?.skuPattern || matchesSkuPattern(variant.sku, options.skuPattern)) {
          variants.push({
            id: variant.id,
            productId: product.id,
            title: variant.title,
            sku: variant.sku,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
          });
        }
      }
    }

    hasNextPage = response.collection.products.pageInfo.hasNextPage;
    cursor = response.collection.products.pageInfo.endCursor;
  }

  return variants.slice(0, limit);
}

/**
 * Fetch variants from products with a specific tag.
 */
async function fetchVariantsByTag(
  shopify: ShopifyClient,
  tag: string,
  options?: { limit?: number; skuPattern?: string }
): Promise<Variant[]> {
  return fetchVariantsWithQuery(shopify, `tag:${tag}`, options);
}

/**
 * Fetch variants from products by vendor.
 */
async function fetchVariantsByVendor(
  shopify: ShopifyClient,
  vendor: string,
  options?: { limit?: number; skuPattern?: string }
): Promise<Variant[]> {
  return fetchVariantsWithQuery(shopify, `vendor:${vendor}`, options);
}

/**
 * Fetch variants from products by product type.
 */
async function fetchVariantsByType(
  shopify: ShopifyClient,
  productType: string,
  options?: { limit?: number; skuPattern?: string }
): Promise<Variant[]> {
  return fetchVariantsWithQuery(shopify, `product_type:${productType}`, options);
}

/**
 * Fetch variants from specific product IDs.
 */
async function fetchVariantsByProductIds(
  shopify: ShopifyClient,
  productIds: string[],
  options?: { limit?: number; skuPattern?: string }
): Promise<Variant[]> {
  const variants: Variant[] = [];
  const limit = options?.limit ?? 1000;

  // Process in batches of 50 to avoid too many IDs in one query
  for (let i = 0; i < productIds.length && variants.length < limit; i += 50) {
    const batch = productIds.slice(i, i + 50);
    const query = batch.map((id) => `id:${id}`).join(' OR ');

    const batchVariants = await fetchVariantsWithQuery(shopify, query, {
      limit: limit - variants.length,
      skuPattern: options?.skuPattern,
    });

    variants.push(...batchVariants);
  }

  return variants;
}

/**
 * Generic function to fetch variants using a Shopify search query.
 */
async function fetchVariantsWithQuery(
  shopify: ShopifyClient,
  query: string,
  options?: { limit?: number; skuPattern?: string }
): Promise<Variant[]> {
  const variants: Variant[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  const limit = options?.limit ?? 1000;

  while (hasNextPage && variants.length < limit) {
    const response: ProductsQueryResponse = await shopify.graphql<ProductsQueryResponse>(
      `
      query GetProductsWithQuery($query: String!, $first: Int!, $after: String) {
        products(query: $query, first: $first, after: $after) {
          edges {
            node {
              id
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    compareAtPrice
                  }
                }
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
      {
        query,
        first: Math.min(50, limit - variants.length),
        after: cursor,
      }
    );

    for (const productEdge of response.products.edges) {
      const product = productEdge.node;
      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        if (!options?.skuPattern || matchesSkuPattern(variant.sku, options.skuPattern)) {
          variants.push({
            id: variant.id,
            productId: product.id,
            title: variant.title,
            sku: variant.sku,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
          });
        }
      }
    }

    hasNextPage = response.products.pageInfo.hasNextPage;
    cursor = response.products.pageInfo.endCursor;
  }

  return variants.slice(0, limit);
}

/**
 * Check if a SKU matches the given pattern.
 * Supports wildcards: * matches any characters
 */
function matchesSkuPattern(sku: string, pattern: string): boolean {
  if (!sku) return false;

  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*/g, '.*'); // Convert * to .*

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(sku);
}
