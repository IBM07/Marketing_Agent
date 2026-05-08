/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16 uses Turbopack as the default dev bundler — no config needed.
  // typescript.ignoreBuildErrors is intentionally NOT set to false (default)
  // so that production builds still catch type errors at build time.
};

export default nextConfig;