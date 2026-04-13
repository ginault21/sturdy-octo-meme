import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createStore, checkAndIncrementJobQuota, resetMonthlyQuota } from '../../../app/db.server';
import { QuotaExceededError } from '../../../app/schemas/errors';
import { cleanDatabase, prisma } from '../../helpers/db';

describe('Quota management', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  describe('checkAndIncrementJobQuota', () => {
    it('increments jobsThisMonth for new store', async () => {
      const store = await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'token',
        plan: 'trial',
      });

      await checkAndIncrementJobQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });
      expect(updated!.jobsThisMonth).toBe(1);
    });

    it('throws QuotaExceededError for trial plan at limit', async () => {
      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'trial',
          jobsThisMonth: 5,
        },
      });

      await expect(checkAndIncrementJobQuota(store.id)).rejects.toThrow(QuotaExceededError);
    });

    it('throws QuotaExceededError with correct plan and limit', async () => {
      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'trial',
          jobsThisMonth: 5,
        },
      });

      try {
        await checkAndIncrementJobQuota(store.id);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(QuotaExceededError);
        expect((error as QuotaExceededError).plan).toBe('trial');
        expect((error as QuotaExceededError).limit).toBe(5);
      }
    });

    it('allows unlimited jobs for growth plan', async () => {
      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'growth',
          jobsThisMonth: 999,
        },
      });

      await checkAndIncrementJobQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });
      expect(updated!.jobsThisMonth).toBe(1000);
    });

    it('allows unlimited jobs for agency plan', async () => {
      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'agency',
          jobsThisMonth: 999,
        },
      });

      await checkAndIncrementJobQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });
      expect(updated!.jobsThisMonth).toBe(1000);
    });

    it('throws QuotaExceededError for starter plan at limit', async () => {
      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'starter',
          jobsThisMonth: 50,
        },
      });

      await expect(checkAndIncrementJobQuota(store.id)).rejects.toThrow(QuotaExceededError);
    });

    it('resets quota when monthResetAt is in the past', async () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 1);

      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'trial',
          jobsThisMonth: 5,
          monthResetAt: pastDate,
        },
      });

      await checkAndIncrementJobQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });
      expect(updated!.jobsThisMonth).toBe(1);
    });

    it('does not reset if monthResetAt is in the future', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'trial',
          jobsThisMonth: 3,
          monthResetAt: futureDate,
        },
      });

      await checkAndIncrementJobQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });
      expect(updated!.jobsThisMonth).toBe(4);
    });

    it('sets monthResetAt on first increment if not set', async () => {
      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'trial',
          jobsThisMonth: 0,
          monthResetAt: null,
        },
      });

      await checkAndIncrementJobQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });
      expect(updated!.monthResetAt).not.toBeNull();
    });
  });

  describe('resetMonthlyQuota', () => {
    it('resets jobsThisMonth to 0', async () => {
      const store = await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'token',
        plan: 'trial',
      });

      await prisma.store.update({
        where: { id: store.id },
        data: { jobsThisMonth: 25 },
      });

      await resetMonthlyQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });
      expect(updated!.jobsThisMonth).toBe(0);
    });

    it('sets monthResetAt to next month', async () => {
      const store = await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'token',
        plan: 'trial',
      });

      await resetMonthlyQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });

      expect(updated!.monthResetAt).not.toBeNull();
      const resetDate = new Date(updated!.monthResetAt!);
      const now = new Date();
      expect(resetDate.getMonth()).toBe(now.getMonth() === 11 ? 0 : now.getMonth() + 1);
      expect(resetDate.getDate()).toBe(1);
    });
  });
});
