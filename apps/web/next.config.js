/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Keep optional native packages out of Next.js route bundles when present.
  serverExternalPackages: ['@open-wallet-standard/core'],
  transpilePackages: [
    '@repo/ipfs-client',
    '@onpoint/shared-types',
    '@repo/ai-client',
    '@repo/shared-ui',
    '@repo/ui',
    '@repo/blockchain-client'
  ],
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
  },
  experimental: {
    prefetchInlining: true,
    appNewScrollHandler: true,
  },
  turbopack: {
    resolveAlias: {
      'pino-pretty': './lib/shims/empty-module.ts',
      '@react-native-async-storage/async-storage': './lib/shims/empty-module.ts',
    },
  },
  // Add a webpack configuration to polyfill indexedDB in server environments
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Polyfill indexedDB for server-side rendering
      config.resolve.fallback = {
        ...config.resolve.fallback,
        indexedDB: false,
        IDBKeyRange: false,
      };
    }
    
    // Alias missing modules for MetaMask/WalletConnect
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };

    return config;
  },
  async rewrites() {
    const hetzner = process.env.NEXT_PUBLIC_AGENT_API_URL;
    if (!hetzner) return [];
    return [
      // Routes fully implemented on Hetzner — files deleted from Next.js
      { source: '/api/ai/virtual-tryon', destination: `${hetzner}/api/ai/virtual-tryon` },
      { source: '/api/ai/analyze-person', destination: `${hetzner}/api/ai/analyze-person` },
      { source: '/api/ai/venice-analyze', destination: `${hetzner}/api/ai/venice-analyze` },
      { source: '/api/ai/agent', destination: `${hetzner}/api/ai/agent` },
      { source: '/api/agent/catalog', destination: `${hetzner}/api/agent/catalog` },
      { source: '/api/agent/curated-shop', destination: `${hetzner}/api/agent/curated-shop` },
      { source: '/api/agent/heartbeat', destination: `${hetzner}/api/agent/heartbeat` },
      { source: '/api/agent/dashboard', destination: `${hetzner}/api/agent/dashboard` },
      { source: '/api/agent/identity', destination: `${hetzner}/api/agent/identity` },
      { source: '/api/market-intelligence/search', destination: `${hetzner}/api/market-intelligence/search` },
      { source: '/api/curator/:slug/storefront', destination: `${hetzner}/api/curator/:slug/storefront` },
    ];
  },
  async headers() {
    const headers = [];
    const tokens = [];
    if (process.env.ORIGIN_TRIAL_TOKEN) tokens.push(process.env.ORIGIN_TRIAL_TOKEN);
    if (process.env.ORIGIN_TRIAL_TOKENS) {
      process.env.ORIGIN_TRIAL_TOKENS.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tokens.push(t));
    }

    if (tokens.length > 0) {
      headers.push({
        source: '/:path*',
        headers: tokens.map((token) => ({ key: 'Origin-Trial', value: token })),
      });
    }
    return headers;
  },
  async redirects() {
    // PHASE1_AUDIT: kill collage/style playgrounds; keep Lab as power surface.
    return [
      { source: '/style', destination: '/lab?tab=try-on', permanent: true },
      { source: '/style/:path*', destination: '/lab?tab=try-on', permanent: true },
      { source: '/collage', destination: '/lab?tab=try-on', permanent: true },
      { source: '/collage/:path*', destination: '/lab?tab=try-on', permanent: true },
      { source: '/social', destination: '/curators', permanent: true },
      { source: '/social/:path*', destination: '/curators', permanent: true },
      { source: '/guides/agents', destination: '/developers', permanent: true },
    ];
  },
};

export default nextConfig;
