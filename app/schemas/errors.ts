export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class QuotaExceededError extends AppError {
  constructor(
    message: string = 'Monthly job quota exceeded',
    public plan: string,
    public limit: number
  ) {
    super(message, 'QUOTA_EXCEEDED', 403);
    this.name = 'QuotaExceededError';
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(`Invalid status transition from '${from}' to '${to}'`, 'INVALID_TRANSITION', 400);
    this.name = 'InvalidStatusTransitionError';
  }
}

export class JobLockError extends AppError {
  constructor(storeId: string) {
    super(`Another job is already running for store: ${storeId}`, 'JOB_LOCKED', 409);
    this.name = 'JobLockError';
  }
}

export class CryptoError extends AppError {
  constructor(message: string = 'Encryption/decryption failed') {
    super(message, 'CRYPTO_ERROR', 500);
    this.name = 'CryptoError';
  }
}

export class StorageError extends AppError {
  constructor(
    message: string,
    public provider?: string
  ) {
    super(message, 'STORAGE_ERROR', 500);
    this.name = 'StorageError';
  }
}

export class ShopifyApiError extends AppError {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message, 'SHOPIFY_API_ERROR', status);
    this.name = 'ShopifyApiError';
  }
}

export class TokenExpiredError extends AppError {
  constructor(
    message: string = 'Your Shopify session expired. Please reconnect your store to continue.'
  ) {
    super(message, 'TOKEN_EXPIRED', 401);
    this.name = 'TokenExpiredError';
  }
}
