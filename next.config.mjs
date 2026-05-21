/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // MEDIUM FIX (#7): ESLint errors now BLOCK builds.
    // Previously set to true, which allowed linting violations to ship silently.
    // All ESLint errors must be resolved for the build to succeed.
    ignoreDuringBuilds: false,
  },
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['@whiskeysockets/baileys', 'ws', 'bullmq', 'ioredis'],
  },
};

export default nextConfig;
