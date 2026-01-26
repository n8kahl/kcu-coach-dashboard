/**
 * Sentry Edge Configuration
 *
 * This file configures Sentry for the Edge runtime (middleware, edge functions).
 * Only initialized when SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV,

    // Performance monitoring - lower sample rate for edge
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

    // Debug mode for development
    debug: process.env.NODE_ENV === 'development',

    // Filter out known noise
    ignoreErrors: [
      'Unauthorized',
      'Invalid token',
      'Rate limit exceeded',
    ],
  });
}
