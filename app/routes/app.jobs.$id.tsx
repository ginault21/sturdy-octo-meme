import { boundary } from '@shopify/shopify-app-react-router/server';
import { useState } from 'react';
import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form } from 'react-router';

import { getJobById, getStoreByDomain, getChangeLogsForJob, getFilesForJob } from '../db.server.js';
import { authenticate } from '../shopify.server.js';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const store = await getStoreByDomain(session.shop);
  if (!store) {
    throw new Response('Store not found', { status: 404 });
  }

  const jobId = params.id;
  if (!jobId) {
    throw new Response('Job ID required', { status: 400 });
  }

  const job = await getJobById(jobId);
  if (!job) {
    throw new Response('Job not found', { status: 404 });
  }

  // Security: Ensure job belongs to current store
  if (job.storeId !== store.id) {
    throw new Response('Not authorized', { status: 403 });
  }

  const [changelogResult, files] = await Promise.all([
    getChangeLogsForJob(jobId, 50, 0),
    getFilesForJob(jobId),
  ]);

  return {
    job,
    changelog: changelogResult.logs,
    changelogTotal: changelogResult.total,
    files,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== 'POST') {
    return { error: 'Method not allowed' };
  }

  const store = await getStoreByDomain(session.shop);
  if (!store) {
    return { error: 'Store not found' };
  }

  const jobId = params.id;
  if (!jobId) {
    return { error: 'Job ID required' };
  }

  const formData = await request.formData();
  const action = formData.get('action') as string;

  if (action === 'rollback') {
    try {
      const response = await fetch(`${process.env.SHOPIFY_APP_URL}/api/jobs/${jobId}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: error.error || 'Rollback failed' };
      }

      const data = await response.json();
      return { success: true, rollbackResult: data.rollback };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  return { error: 'Unknown action' };
};

function getStatusBadgeTone(status: string): 'success' | 'critical' | 'warning' | 'neutral' {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'critical';
    case 'running':
      return 'warning';
    case 'queued':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export default function JobDetail() {
  const { job, changelog, changelogTotal, files } = useLoaderData<typeof loader>();
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);

  const config = job.config as Record<string, unknown>;
  const summary = job.summary as Record<string, unknown> | null;

  return (
    <s-page heading={`Job: ${job.id.slice(0, 8)}...`}>
      {/* Job Status */}
      <s-section heading="Job Details">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base">
              <s-text>Status:</s-text>
              <s-badge tone={getStatusBadgeTone(job.status)}>{job.status}</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <div>
                <s-text>Type: {job.type}</s-text>
              </div>
              <div>
                <s-text>Created: {new Date(job.createdAt).toLocaleString()}</s-text>
              </div>
              {job.startedAt && (
                <div>
                  <s-text>Started: {new Date(job.startedAt).toLocaleString()}</s-text>
                </div>
              )}
              {job.finishedAt && (
                <div>
                  <s-text>Finished: {new Date(job.finishedAt).toLocaleString()}</s-text>
                </div>
              )}
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>Configuration</s-heading>
            <pre style={{ margin: 0, fontSize: '12px', overflow: 'auto' }}>
              <code>{JSON.stringify(config, null, 2)}</code>
            </pre>
          </s-box>

          {summary && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>Summary</s-heading>
              <s-stack direction="block" gap="small">
                <div>
                  <s-text>Total: {summary.total as number}</s-text>
                </div>
                <div>
                  <s-text>Succeeded: {summary.succeeded as number}</s-text>
                </div>
                <div>
                  <s-text>Failed: {summary.failed as number}</s-text>
                </div>
                {Array.isArray(summary.errors) && summary.errors.length > 0 && (
                  <s-box>
                    <s-text>Errors ({summary.errors.length}):</s-text>
                    <ul style={{ fontSize: '12px' }}>
                      {(summary.errors as Array<{ variantId: string; error: string }>)
                        .slice(0, 5)
                        .map((err, idx) => (
                          <li key={idx}>
                            {err.variantId}: {err.error}
                          </li>
                        ))}
                      {summary.errors.length > 5 && (
                        <li>...and {summary.errors.length - 5} more</li>
                      )}
                    </ul>
                  </s-box>
                )}
              </s-stack>
            </s-box>
          )}
        </s-stack>
      </s-section>

      {/* Files */}
      {files.length > 0 && (
        <s-section heading="Files">
          <s-stack direction="block" gap="base">
            {files.map((file) => (
              <s-box key={file.id} padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="inline" gap="base">
                  <s-text>Kind: {file.kind}</s-text>
                  {file.storageUrl && (
                    <s-link href={file.storageUrl} target="_blank">
                      <s-button variant="secondary">Download</s-button>
                    </s-link>
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      )}

      {/* Changelog */}
      <s-section heading={`Change Log (${changelogTotal} entries)`}>
        {changelog.length === 0 ? (
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-paragraph>No changelog entries yet.</s-paragraph>
          </s-box>
        ) : (
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <div style={{ overflow: 'auto', maxHeight: '400px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Product</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Field</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>Old Value</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {changelog.map((log) => (
                    <tr key={log.id}>
                      <td style={{ padding: '8px' }}>
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '8px' }}>
                        {log.shopifyProductId.split('/').pop()}
                        {log.shopifyVariantId && (
                          <div style={{ fontSize: '10px', color: '#666' }}>
                            Variant: {log.shopifyVariantId.split('/').pop()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px' }}>{log.field}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{log.oldValue}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{log.newValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {changelogTotal > changelog.length && (
              <s-paragraph>
                Showing {changelog.length} of {changelogTotal} entries.
              </s-paragraph>
            )}
          </s-box>
        )}
      </s-section>

      {/* Rollback Section */}
      {job.status === 'succeeded' && (
        <s-section heading="Rollback">
          {!showRollbackConfirm ? (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-paragraph>
                You can rollback this job to restore the original prices. This will create a new
                changelog entry.
              </s-paragraph>
              <s-button variant="secondary" onClick={() => setShowRollbackConfirm(true)}>
                Initiate Rollback
              </s-button>
            </s-box>
          ) : (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <s-heading>Confirm Rollback</s-heading>
              <s-paragraph>
                This will restore all prices to their original values before this job ran. This
                action cannot be undone.
              </s-paragraph>
              <Form method="post">
                <input type="hidden" name="action" value="rollback" />
                <s-stack direction="inline" gap="base">
                  <s-button variant="secondary" onClick={() => setShowRollbackConfirm(false)}>
                    Cancel
                  </s-button>
                  <s-button type="submit" tone="critical">
                    Confirm Rollback
                  </s-button>
                </s-stack>
              </Form>
            </s-box>
          )}
        </s-section>
      )}

      {/* Actions */}
      <s-section heading="Actions">
        <s-stack direction="inline" gap="base">
          <s-link href="/app">
            <s-button>Back to Dashboard</s-button>
          </s-link>
          <s-link href="/app/wizards/price">
            <s-button variant="secondary">New Price Update</s-button>
          </s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
