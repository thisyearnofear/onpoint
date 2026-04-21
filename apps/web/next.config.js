/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
  output: 'standalone',
  compiler: {
    styledComponents: true,
  },
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
    optimizeCss: true,
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

    // Handle native binary modules that can't be parsed by webpack
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    // Exclude @open-wallet-standard from server bundle (it has native deps)
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('@open-wallet-standard/core');
      }
    }

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
      { source: '/api/ai/live-session', destination: `${hetzner}/api/ai/live-session` },
      { source: '/api/ai/agent', destination: `${hetzner}/api/ai/agent` },
      { source: '/api/agent/catalog', destination: `${hetzner}/api/agent/catalog` },
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
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
  widenClientFileUpload: false,
  hideSourceMaps: true,
  automaticVercelMonitors: false,
});
