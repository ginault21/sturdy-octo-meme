import '@shopify/shopify-app-react-router/adapters/node';
import { ApiVersion, AppDistribution, shopifyApp } from '@shopify/shopify-app-react-router/server';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';

import prisma, { createStore } from './db.server';
import { encrypt } from './lib/crypto.server';
import { logger } from './logger.server';

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(','),
  appUrl: process.env.SHOPIFY_APP_URL || '',
  authPathPrefix: '/auth',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionStorage: new PrismaSessionStorage(prisma) as any,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  hooks: {
    afterAuth: async ({ session }) => {
      // Extract data from session
      const shopDomain = session.shop;
      const accessToken = session.accessToken;

      if (!accessToken) {
        logger.error({ shopDomain }, 'No access token in session during afterAuth');
        throw new Error('Access token missing from session');
      }

      try {
        // Encrypt the access token before storage
        const encryptedToken = encrypt(accessToken);

        // Upsert Store record in our database
        const store = await createStore({
          shopDomain,
          accessToken: encryptedToken,
          plan: 'trial', // Default plan for new installs
        });

        logger.info(
          {
            shopDomain,
            storeId: store.id,
            isNewInstall: store.installedAt.getTime() === store.updatedAt.getTime(),
          },
          'Store authenticated and registered'
        );
      } catch (error) {
        logger.error({ shopDomain, error }, 'Failed to process afterAuth hook');
        throw error;
      }
    },
  },
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
