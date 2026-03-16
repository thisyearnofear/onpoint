/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compiler: {
    styledComponents: true,
  },
  transpilePackages: [
    '@onpoint/ipfs-client',
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

    return config;
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

export default nextConfig;
