import { boundary } from '@shopify/shopify-app-react-router/server';
import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

import { getStoreByDomain, createJob } from '../db.server';
import type { PriceJobConfig } from '../schemas/wizards/price';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Verify database connectivity by getting store
  const store = await getStoreByDomain(session.shop);

  if (!store) {
    return {
      status: 'error',
      message: 'Store not found in database',
      shop: session.shop,
      storeId: null,
      jobId: null,
    };
  }

  // Verify job creation works by creating a dummy job
  let jobId: string | null = null;
  try {
    const dummyConfig: PriceJobConfig = {
      wizard: 'price',
      filter: { by: 'tag', tag: 'test' },
      operation: { type: 'set_absolute', price: 9.99 },
      targets: { allVariants: true },
    };

    const job = await createJob(store.id, 'price_update', dummyConfig);
    jobId = job.id;
  } catch (error) {
    return {
      status: 'error',
      message: `Job creation failed: ${error instanceof Error ? error.message : String(error)}`,
      shop: session.shop,
      storeId: store.id,
      jobId: null,
    };
  }

  return {
    status: 'ok',
    message: 'All systems operational',
    shop: session.shop,
    storeId: store.id,
    jobId,
  };
};

export default function StatusPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="System Status">
      <s-section heading="Health Check">
        <s-stack direction="block" gap="base">
          {data.status === 'ok' ? (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>Status: Operational</s-heading>
              <s-paragraph>{data.message}</s-paragraph>
            </s-box>
          ) : (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>Status: Error</s-heading>
              <s-paragraph>{data.message}</s-paragraph>
            </s-box>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Store Information">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <pre style={{ margin: 0, fontSize: '14px' }}>
              <code>
                {JSON.stringify(
                  {
                    shop: data.shop,
                    storeId: data.storeId,
                    jobId: data.jobId,
                  },
                  null,
                  2
                )}
              </code>
            </pre>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Navigation">
        <s-stack direction="inline" gap="base">
          <s-link href="/app">
            <s-button>Go to Dashboard</s-button>
          </s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
