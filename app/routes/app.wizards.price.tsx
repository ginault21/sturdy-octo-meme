import { boundary } from '@shopify/shopify-app-react-router/server';
import { useState, useEffect } from 'react';
import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useActionData, Form } from 'react-router';

import { getStoreByDomain } from '../db.server.js';
import type { PriceFilter, PriceOperation } from '../schemas/wizards/price.js';
import { authenticate } from '../shopify.server.js';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const store = await getStoreByDomain(session.shop);
  if (!store) {
    return { error: 'Store not found' };
  }

  const step = formData.get('step') as string;

  if (step === 'create') {
    const filterType = formData.get('filterType') as string;
    const operationType = formData.get('operationType') as string;

    let filter: PriceFilter;
    switch (filterType) {
      case 'collection':
        filter = { by: 'collection', collectionId: formData.get('filterValue') as string };
        break;
      case 'tag':
        filter = { by: 'tag', tag: formData.get('filterValue') as string };
        break;
      case 'vendor':
        filter = { by: 'vendor', vendor: formData.get('filterValue') as string };
        break;
      case 'type':
        filter = { by: 'type', productType: formData.get('filterValue') as string };
        break;
      default:
        return { error: 'Invalid filter type' };
    }

    let operation: PriceOperation;
    const value = parseFloat(formData.get('value') as string);
    switch (operationType) {
      case 'set_absolute':
        operation = { type: 'set_absolute', price: value };
        break;
      case 'increase_pct':
        operation = { type: 'increase_pct', pct: value };
        break;
      case 'decrease_pct':
        operation = { type: 'decrease_pct', pct: value };
        break;
      case 'increase_amount':
        operation = { type: 'increase_amount', amount: value };
        break;
      case 'decrease_amount':
        operation = { type: 'decrease_amount', amount: value };
        break;
      default:
        return { error: 'Invalid operation type' };
    }

    const config = {
      wizard: 'price' as const,
      filter,
      operation,
      targets: {
        allVariants: formData.get('allVariants') === 'true',
        skuPattern: (formData.get('skuPattern') as string) || undefined,
      },
    };

    try {
      const response = await fetch(`${process.env.SHOPIFY_APP_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: error.error || 'Failed to create job' };
      }

      const data = await response.json();
      return { success: true, jobId: data.job.id };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  return null;
};

export default function PriceWizard() {
  const actionData = useActionData<typeof action>();
  const [currentStep, setCurrentStep] = useState(1);
  const [filterType, setFilterType] = useState('collection');
  const [operationType, setOperationType] = useState('set_absolute');
  const [filterValue, setFilterValue] = useState('');
  const [operationValue, setOperationValue] = useState('');
  const [allVariants, setAllVariants] = useState(true);
  const [skuPattern, setSkuPattern] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (actionData?.success && actionData.jobId) {
      setCurrentStep(5);
    }
  }, [actionData]);

  const handleGetPreview = async () => {
    if (!filterValue || !operationValue) return;

    setLoading(true);

    let filter: PriceFilter;
    switch (filterType) {
      case 'collection':
        filter = { by: 'collection', collectionId: filterValue };
        break;
      case 'tag':
        filter = { by: 'tag', tag: filterValue };
        break;
      case 'vendor':
        filter = { by: 'vendor', vendor: filterValue };
        break;
      case 'type':
        filter = { by: 'type', productType: filterValue };
        break;
      default:
        filter = { by: 'tag', tag: '' };
    }

    let operation: PriceOperation;
    const value = parseFloat(operationValue);
    switch (operationType) {
      case 'set_absolute':
        operation = { type: 'set_absolute', price: value };
        break;
      case 'increase_pct':
        operation = { type: 'increase_pct', pct: value };
        break;
      case 'decrease_pct':
        operation = { type: 'decrease_pct', pct: value };
        break;
      case 'increase_amount':
        operation = { type: 'increase_amount', amount: value };
        break;
      case 'decrease_amount':
        operation = { type: 'decrease_amount', amount: value };
        break;
      default:
        operation = { type: 'set_absolute', price: value };
    }

    const config = {
      wizard: 'price' as const,
      filter,
      operation,
      targets: {
        allVariants,
        skuPattern: skuPattern || undefined,
      },
    };

    try {
      const createResponse = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create preview job');
      }

      const { job } = await createResponse.json();

      const previewResponse = await fetch(`/api/jobs/${job.id}/preview`);
      if (previewResponse.ok) {
        const data = await previewResponse.json();
        setPreviewData(data.preview);
        setCurrentStep(3);
      }
    } catch (error) {
      console.error('Preview error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <s-page heading="Price Update Wizard">
      {/* Step indicator */}
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-stack direction="inline" gap="base">
          <s-text>{currentStep === 1 ? '●' : '○'} 1. Select Products</s-text>
          <s-text>→</s-text>
          <s-text>{currentStep === 2 ? '●' : '○'} 2. Set Operation</s-text>
          <s-text>→</s-text>
          <s-text>{currentStep === 3 ? '●' : '○'} 3. Preview</s-text>
          <s-text>→</s-text>
          <s-text>{currentStep >= 4 ? '●' : '○'} 4. Confirm</s-text>
        </s-stack>
      </s-box>

      {/* Error display */}
      {actionData?.error && (
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-text>Error: {actionData.error}</s-text>
        </s-box>
      )}

      {/* Step 1: Filter Selection */}
      {currentStep === 1 && (
        <s-section heading="Step 1: Select Products">
          <s-stack direction="block" gap="base">
            <s-box>
              <s-heading>Filter by:</s-heading>
              <s-select
                value={filterType}
                onChange={(e) => setFilterType((e.target as HTMLSelectElement).value)}
              >
                <option value="collection">Collection</option>
                <option value="tag">Product Tag</option>
                <option value="vendor">Vendor</option>
                <option value="type">Product Type</option>
              </s-select>
            </s-box>

            <s-box>
              <s-heading>
                {filterType === 'collection' && 'Collection ID:'}
                {filterType === 'tag' && 'Tag:'}
                {filterType === 'vendor' && 'Vendor name:'}
                {filterType === 'type' && 'Product type:'}
              </s-heading>
              <s-text-field
                value={filterValue}
                onInput={(e) => setFilterValue((e.target as HTMLInputElement).value)}
                placeholder={
                  filterType === 'collection'
                    ? 'gid://shopify/Collection/...'
                    : filterType === 'tag'
                      ? 'e.g., sale'
                      : filterType === 'vendor'
                        ? 'e.g., Nike'
                        : 'e.g., Shoes'
                }
              />
            </s-box>

            <s-box>
              <s-heading>Variant Selection:</s-heading>
              <s-select
                value={allVariants ? 'all' : 'pattern'}
                onChange={(e) => setAllVariants((e.target as HTMLSelectElement).value === 'all')}
              >
                <option value="all">All Variants</option>
                <option value="pattern">Match SKU Pattern</option>
              </s-select>
            </s-box>

            {!allVariants && (
              <s-box>
                <s-heading>SKU Pattern (supports * wildcard):</s-heading>
                <s-text-field
                  value={skuPattern}
                  onInput={(e) => setSkuPattern((e.target as HTMLInputElement).value)}
                  placeholder="e.g., SKU-123-*"
                />
              </s-box>
            )}

            <s-button onClick={() => setCurrentStep(2)} disabled={!filterValue}>
              Next: Set Operation
            </s-button>
          </s-stack>
        </s-section>
      )}

      {/* Step 2: Operation Configuration */}
      {currentStep === 2 && (
        <s-section heading="Step 2: Price Operation">
          <s-stack direction="block" gap="base">
            <s-box>
              <s-heading>Operation:</s-heading>
              <s-select
                value={operationType}
                onChange={(e) => setOperationType((e.target as HTMLSelectElement).value)}
              >
                <option value="set_absolute">Set to specific price</option>
                <option value="increase_pct">Increase by percentage</option>
                <option value="decrease_pct">Decrease by percentage</option>
                <option value="increase_amount">Increase by amount</option>
                <option value="decrease_amount">Decrease by amount</option>
              </s-select>
            </s-box>

            <s-box>
              <s-heading>
                {operationType === 'set_absolute' && 'New price:'}
                {operationType.includes('pct') && 'Percentage:'}
                {operationType.includes('amount') && 'Amount:'}
              </s-heading>
              <s-text-field
                value={operationValue}
                onInput={(e) => setOperationValue((e.target as HTMLInputElement).value)}
                placeholder={operationType === 'set_absolute' ? 'e.g., 29.99' : 'e.g., 10'}
              />
              {operationType.includes('pct') && <s-text>%</s-text>}
            </s-box>

            <s-stack direction="inline" gap="base">
              <s-button variant="secondary" onClick={() => setCurrentStep(1)}>
                Back
              </s-button>
              <s-button
                onClick={handleGetPreview}
                disabled={!operationValue || loading}
                loading={loading}
              >
                Preview Changes
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>
      )}

      {/* Step 3: Preview */}
      {currentStep === 3 && previewData && (
        <s-section heading="Step 3: Preview Changes">
          <s-stack direction="block" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>Summary</s-heading>
              <s-stack direction="block" gap="small">
                <s-text>Total variants: {previewData.totalVariants}</s-text>
                <s-text>Will change: {previewData.summary.willChange}</s-text>
                <s-text>Total delta: ${previewData.summary.totalDelta.toFixed(2)}</s-text>
                <s-text>Average delta: ${previewData.summary.avgDelta.toFixed(2)}</s-text>
                <s-text>
                  New price range: ${previewData.summary.minNewPrice.toFixed(2)} - $
                  {previewData.summary.maxNewPrice.toFixed(2)}
                </s-text>
                {previewData.summary.errors.length > 0 && (
                  <s-text>
                    Errors: {previewData.summary.errors.length} variants will be skipped
                  </s-text>
                )}
              </s-stack>
            </s-box>

            {previewData.changes.length > 0 && (
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-heading>Sample Changes (showing first {previewData.changes.length})</s-heading>
                <s-box>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Variant</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Old Price</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>New Price</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.changes.map((change: any) => (
                        <tr key={change.variantId}>
                          <td style={{ padding: '8px' }}>{change.variantId.split('/').pop()}</td>
                          <td style={{ textAlign: 'right', padding: '8px' }}>
                            ${change.oldPrice.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px' }}>
                            ${change.newPrice.toFixed(2)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              padding: '8px',
                            }}
                          >
                            {change.delta > 0 ? '+' : ''}
                            {change.delta.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </s-box>
              </s-box>
            )}

            <s-stack direction="inline" gap="base">
              <s-button variant="secondary" onClick={() => setCurrentStep(2)}>
                Back
              </s-button>
              <s-button onClick={() => setCurrentStep(4)}>Review & Confirm</s-button>
            </s-stack>
          </s-stack>
        </s-section>
      )}

      {/* Step 4: Confirmation */}
      {currentStep === 4 && (
        <s-section heading="Step 4: Confirm Changes">
          <s-stack direction="block" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>Configuration Summary</s-heading>
              <s-stack direction="block" gap="small">
                <s-text>
                  Filter: {filterType} = {filterValue}
                </s-text>
                <s-text>Operation: {operationType.replace('_', ' ')}</s-text>
                <s-text>
                  Value: {operationValue}
                  {operationType.includes('pct') ? '%' : ''}
                </s-text>
                <s-text>
                  Variants: {allVariants ? 'All' : `Matching SKU pattern: ${skuPattern}`}
                </s-text>
                {previewData && (
                  <>
                    <s-text>Affected variants: {previewData.summary.willChange}</s-text>
                    <s-text>Total impact: ${previewData.summary.totalDelta.toFixed(2)}</s-text>
                  </>
                )}
              </s-stack>
            </s-box>

            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <s-heading>Important</s-heading>
              <s-paragraph>
                This operation will modify prices in your Shopify store. A backup will be created
                automatically. You can rollback changes from the job details page after completion.
              </s-paragraph>
            </s-box>

            <Form method="post">
              <input type="hidden" name="step" value="create" />
              <input type="hidden" name="filterType" value={filterType} />
              <input type="hidden" name="filterValue" value={filterValue} />
              <input type="hidden" name="operationType" value={operationType} />
              <input type="hidden" name="value" value={operationValue} />
              <input type="hidden" name="allVariants" value={String(allVariants)} />
              <input type="hidden" name="skuPattern" value={skuPattern} />

              <s-stack direction="inline" gap="base">
                <s-button variant="secondary" onClick={() => setCurrentStep(3)}>
                  Back
                </s-button>
                <s-button type="submit" variant="primary" loading={loading}>
                  Create Job
                </s-button>
              </s-stack>
            </Form>
          </s-stack>
        </s-section>
      )}

      {/* Step 5: Job Created */}
      {currentStep === 5 && actionData?.success && (
        <s-section heading="Job Created Successfully">
          <s-stack direction="block" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>Job ID: {actionData.jobId}</s-heading>
              <s-paragraph>
                Your price update job has been created and is queued for execution.
              </s-paragraph>
            </s-box>

            <s-stack direction="inline" gap="base">
              <s-link href={`/app/jobs/${actionData.jobId}`}>
                <s-button>View Job Details</s-button>
              </s-link>
              <s-link href="/app">
                <s-button variant="secondary">Back to Dashboard</s-button>
              </s-link>
            </s-stack>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
