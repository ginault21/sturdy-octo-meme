import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  createStore,
  getStoreByDomain,
  updateStorePlan,
  checkAndIncrementJobQuota,
  resetMonthlyQuota,
} from '../../../app/db.server';
import { QuotaExceededError } from '../../../app/schemas/errors';
import { cleanDatabase, prisma } from '../../helpers/db';

describe('Store DB helpers', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  describe('createStore', () => {
    it('creates a new store with default plan', async () => {
      const store = await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'encrypted_token',
        plan: 'trial',
      });

      expect(store.shopDomain).toBe('test-shop.myshopify.com');
      expect(store.accessToken).toBe('encrypted_token');
      expect(store.plan).toBe('trial');
      expect(store.jobsThisMonth).toBe(0);
    });

    it('creates a new store with specified plan', async () => {
      const store = await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'encrypted_token',
        plan: 'starter',
      });

      expect(store.plan).toBe('starter');
    });

    it('upserts if store already exists', async () => {
      await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'token_v1',
        plan: 'trial',
      });

      const updated = await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'token_v2',
        plan: 'trial',
      });

      expect(updated.accessToken).toBe('token_v2');
      expect(updated.plan).toBe('trial');
    });
  });

  describe('getStoreByDomain', () => {
    it('returns store when exists', async () => {
      await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'token',
        plan: 'trial',
      });

      const store = await getStoreByDomain('test-shop.myshopify.com');
      expect(store).not.toBeNull();
      expect(store!.shopDomain).toBe('test-shop.myshopify.com');
    });

    it('returns null when store does not exist', async () => {
      const store = await getStoreByDomain('nonexistent.myshopify.com');
      expect(store).toBeNull();
    });
  });

  describe('updateStorePlan', () => {
    it('updates the plan', async () => {
      await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'token',
        plan: 'trial',
      });

      const store = await getStoreByDomain('test-shop.myshopify.com');
      await updateStorePlan(store!.id, 'starter');

      const updated = await getStoreByDomain('test-shop.myshopify.com');
      expect(updated!.plan).toBe('starter');
    });
  });

  describe('checkAndIncrementJobQuota', () => {
    it('increments jobsThisMonth for trial plan', async () => {
      const store = await createStore({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'token',
        plan: 'trial',
      });

      await checkAndIncrementJobQuota(store.id);

      const updated = await getStoreByDomain('test-shop.myshopify.com');
      expect(updated!.jobsThisMonth).toBe(1);
    });

    it('throws QuotaExceededError when limit reached for trial plan', async () => {
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

    it('allows unlimited jobs for growth plan', async () => {
      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'growth',
          jobsThisMonth: 1000,
        },
      });

      await checkAndIncrementJobQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });
      expect(updated!.jobsThisMonth).toBe(1001);
    });

    it('resets quota when monthResetAt is in the past', async () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 1);

      const store = await prisma.store.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'token',
          plan: 'starter',
          jobsThisMonth: 49,
          monthResetAt: pastDate,
        },
      });

      await checkAndIncrementJobQuota(store.id);

      const updated = await prisma.store.findUnique({
        where: { id: store.id },
      });
      expect(updated!.jobsThisMonth).toBe(1);
    });
  });

  describe('resetMonthlyQuota', () => {
    it('resets jobsThisMonth to 0 and sets new monthResetAt', async () => {
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
      expect(updated!.monthResetAt).not.toBeNull();
      expect(new Date(updated!.monthResetAt!).getMonth()).toBe(new Date().getMonth() + 1);
    });
  });
});
