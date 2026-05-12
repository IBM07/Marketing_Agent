import { createRequire } from 'module';
import bundleAnalyzer from '@next/bundle-analyzer';

const require = createRequire(import.meta.url);
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Only apply the React alias on the client bundle to prevent
    // breaking Next.js Server Components (which use a custom React version)
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Use exact match '$' so we don't break 'react/jsx-runtime'
        'react$': require.resolve('react'),
        'react-dom$': require.resolve('react-dom'),
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);