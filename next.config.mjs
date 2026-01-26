import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
    instrumentationHook: true,
    // Allow client components with useSearchParams without Suspense boundary
    missingSuspenseWithCSRBailout: false,
  },
};

// Sentry configuration options for build-time features
const sentryWebpackPluginOptions = {
  // Organization and project from Sentry dashboard
  org: 'prospectu',
  project: 'javascript-nextjs',

  // Suppress source map upload logs during build
  silent: !process.env.CI,

  // Upload source maps for better error traces
  widenClientFileUpload: true,

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: true,
};

// Only wrap with Sentry if SENTRY_DSN is configured
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
