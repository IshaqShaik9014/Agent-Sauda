/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@agent-sauda/domain'],
  reactStrictMode: true
};

export default nextConfig;
