import { PrismaClient } from '@prisma/client';

import {
  CreateStoreSchema,
  JobConfigSchema,
  QuotaExceededError,
  getQuotaLimit,
  isValidStatusTransition,
  InvalidStatusTransitionError,
} from './schemas/index';
import type {
  CreateStoreInput,
  Plan,
  JobType,
  JobStatus,
  JobSummary,
  PriceJobConfig,
  InventoryJobConfig,
  CollectionJobConfig,
} from './schemas/index';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

if (process.env.NODE_ENV !== 'production') {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;

// Store helpers

export async function createStore(data: CreateStoreInput) {
  const validated = CreateStoreSchema.parse(data);
  return prisma.store.upsert({
    where: { shopDomain: validated.shopDomain },
    update: {
      accessToken: validated.accessToken,
      plan: validated.plan,
    },
    create: {
      shopDomain: validated.shopDomain,
      accessToken: validated.accessToken,
      plan: validated.plan ?? 'trial',
    },
  });
}

export async function getStoreByDomain(shopDomain: string) {
  return prisma.store.findUnique({
    where: { shopDomain },
  });
}

export async function getStoreById(id: string) {
  return prisma.store.findUnique({
    where: { id },
  });
}

export async function updateStorePlan(storeId: string, plan: Plan) {
  return prisma.store.update({
    where: { id: storeId },
    data: { plan },
  });
}

export async function checkAndIncrementJobQuota(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
  });

  if (!store) {
    throw new Error(`Store not found: ${storeId}`);
  }

  const now = new Date();
  const limit = getQuotaLimit(store.plan as Plan);
  const needsReset = limit !== null && store.monthResetAt && now > store.monthResetAt;

  if (needsReset) {
    await prisma.store.update({
      where: { id: storeId },
      data: { jobsThisMonth: 1, monthResetAt: getNextMonthReset(now) },
    });
    return true;
  }

  if (limit !== null && store.jobsThisMonth >= limit) {
    throw new QuotaExceededError(
      `Monthly quota exceeded for ${store.plan} plan`,
      store.plan,
      limit
    );
  }

  await prisma.store.update({
    where: { id: storeId },
    data: {
      jobsThisMonth: { increment: 1 },
      ...(store.monthResetAt ? {} : { monthResetAt: getNextMonthReset(now) }),
    },
  });

  return true;
}

export async function resetMonthlyQuota(storeId: string) {
  return prisma.store.update({
    where: { id: storeId },
    data: {
      jobsThisMonth: 0,
      monthResetAt: getNextMonthReset(new Date()),
    },
  });
}

function getNextMonthReset(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

// Job helpers

export async function createJob(
  storeId: string,
  type: JobType,
  config: PriceJobConfig | InventoryJobConfig | CollectionJobConfig
) {
  const validatedConfig = JobConfigSchema.parse(config);

  const job = await prisma.job.create({
    data: {
      storeId,
      type,
      config: JSON.stringify(validatedConfig),
      status: 'queued',
    },
  });

  return {
    ...job,
    config: validatedConfig,
  };
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  extras?: {
    summary?: JobSummary;
    startedAt?: Date;
    finishedAt?: Date;
  }
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const currentStatus = job.status as JobStatus;
  if (!isValidStatusTransition(currentStatus, status)) {
    throw new InvalidStatusTransitionError(currentStatus, status);
  }

  const updateData: Parameters<typeof prisma.job.update>[0]['data'] = {
    status,
  };

  if (status === 'running') {
    updateData.startedAt = extras?.startedAt ?? new Date();
  }

  if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    updateData.finishedAt = extras?.finishedAt ?? new Date();
  }

  if (status === 'queued' && currentStatus === 'failed') {
    updateData.startedAt = null;
    updateData.finishedAt = null;
  }

  if (extras?.summary) {
    updateData.summary = JSON.stringify(extras.summary);
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: updateData,
  });

  return {
    ...updated,
    config: JSON.parse(updated.config),
    summary: updated.summary ? JSON.parse(updated.summary) : null,
  };
}

export async function getJobById(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;

  return {
    ...job,
    config: JSON.parse(job.config),
    summary: job.summary ? JSON.parse(job.summary) : null,
  };
}

export async function getJobsForStore(storeId: string, limit = 20, cursor?: string) {
  const jobs = await prisma.job.findMany({
    where: { storeId },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = jobs.length > limit;
  const items = hasMore ? jobs.slice(0, -1) : jobs;

  return {
    jobs: items.map((job) => ({
      ...job,
      config: JSON.parse(job.config),
      summary: job.summary ? JSON.parse(job.summary) : null,
    })),
    nextCursor: hasMore ? items[items.length - 1].id : undefined,
  };
}

export async function getRunningJobForStore(storeId: string) {
  return prisma.job.findFirst({
    where: {
      storeId,
      status: 'running',
    },
  });
}

// ChangeLog helpers

export async function createChangeLogBatch(
  rows: Array<{
    jobId: string;
    shopifyProductId: string;
    shopifyVariantId?: string;
    field: string;
    oldValue: string;
    newValue: string;
  }>
) {
  const BATCH_SIZE = 500;
  const results = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const result = await prisma.changeLog.createMany({
      data: batch.map((row) => ({
        jobId: row.jobId,
        shopifyProductId: row.shopifyProductId,
        shopifyVariantId: row.shopifyVariantId,
        field: row.field,
        oldValue: row.oldValue,
        newValue: row.newValue,
      })),
    });
    results.push(result);
  }

  return results;
}

export async function getChangeLogsForJob(jobId: string, limit = 50, offset = 0) {
  const [logs, total] = await Promise.all([
    prisma.changeLog.findMany({
      where: { jobId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.changeLog.count({ where: { jobId } }),
  ]);

  return { logs, total };
}

// File helpers

export async function createFileRecord(data: {
  storeId: string;
  jobId?: string;
  kind: string;
  storageUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  const file = await prisma.file.create({
    data: {
      storeId: data.storeId,
      jobId: data.jobId,
      kind: data.kind,
      storageUrl: data.storageUrl,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    },
  });

  return {
    ...file,
    metadata: file.metadata ? JSON.parse(file.metadata) : null,
  };
}

export async function getFilesForJob(jobId: string) {
  const files = await prisma.file.findMany({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
  });

  return files.map((file) => ({
    ...file,
    metadata: file.metadata ? JSON.parse(file.metadata) : null,
  }));
}

export async function getFileById(id: string) {
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return null;

  return {
    ...file,
    metadata: file.metadata ? JSON.parse(file.metadata) : null,
  };
}
