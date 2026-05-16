import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui', '@repo/database', '@repo/ai'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
