import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

/**
 * Root logger instance
 *
 * In production: JSON format for structured logging (Datadog, Logtail)
 * In development: Pretty-printed for readability
 */
export const logger = pino({
  level: logLevel,
  base: {
    service: 'safe-bulk-ops',
    environment: process.env.NODE_ENV || 'development',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname,service,environment',
        },
      },
  // Redact sensitive fields automatically
  redact: {
    paths: ['*.accessToken', '*.password', '*.secret', '*.token', '*.apiKey'],
    remove: true,
  },
});

/**
 * Create a child logger with request/job context
 *
 * Usage:
 *   const childLogger = createChildLogger({ shopDomain: "example.myshopify.com", jobId: "123" });
 *   childLogger.info("Job started");
 *   // Output: { "msg": "Job started", "shopDomain": "example.myshopify.com", "jobId": "123" }
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * Get a request-scoped logger with shop context
 */
export function getRequestLogger(shopDomain: string, requestId?: string) {
  return createChildLogger({
    shopDomain,
    ...(requestId && { requestId }),
  });
}

/**
 * Get a job-scoped logger with job context
 */
export function getJobLogger(jobId: string, shopDomain: string) {
  return createChildLogger({
    jobId,
    shopDomain,
  });
}
