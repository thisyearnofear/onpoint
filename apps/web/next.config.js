/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    styledComponents: true,
  },
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
    return config;
  },
};

export default nextConfig;
