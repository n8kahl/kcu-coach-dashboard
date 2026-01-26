/**
 * Sentry Server Configuration
 *
 * This file configures Sentry for the Node.js server-side.
 * Only initialized when SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment and release
    environment: process.env.NODE_ENV,

    // Performance monitoring - lower sample rate in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Debug mode for development
    debug: process.env.NODE_ENV === 'development',

    // Integrations
    integrations: [
      // Automatically instrument Node.js libraries
      Sentry.httpIntegration(),
    ],

    // Filter out known noise
    ignoreErrors: [
      // Expected auth errors
      'Unauthorized',
      'Invalid token',
      // Rate limiting (handled gracefully)
      'Rate limit exceeded',
    ],

    // Sanitize sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        sensitiveHeaders.forEach(header => {
          if (event.request?.headers?.[header]) {
            event.request.headers[header] = '[REDACTED]';
          }
        });
      }

      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
            sensitiveKeys.forEach(key => {
              if (breadcrumb.data?.[key]) {
                breadcrumb.data[key] = '[REDACTED]';
              }
            });
          }
          return breadcrumb;
        });
      }

      return event;
    },
  });
}
