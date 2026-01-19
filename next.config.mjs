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

export default nextConfig;
