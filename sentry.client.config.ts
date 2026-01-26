/**
 * Sentry Client Configuration
 *
 * This file configures Sentry for the browser/client-side.
 * Only initialized when NEXT_PUBLIC_SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment and release
    environment: process.env.NODE_ENV,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay (captures user interactions for debugging)
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Debug mode for development
    debug: process.env.NODE_ENV === 'development',

    // Integrations
    integrations: [
      Sentry.replayIntegration({
        // Mask all text content and inputs for privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.browserTracingIntegration(),
    ],

    // Filter out known noise
    ignoreErrors: [
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Network errors that aren't actionable
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // User-initiated navigation
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],

    // Sanitize sensitive data from URLs
    beforeSend(event) {
      // Remove sensitive query parameters
      if (event.request?.url) {
        const url = new URL(event.request.url);
        ['token', 'key', 'password', 'secret', 'auth'].forEach(param => {
          if (url.searchParams.has(param)) {
            url.searchParams.set(param, '[REDACTED]');
          }
        });
        event.request.url = url.toString();
      }
      return event;
    },
  });
}
