/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@codegraph-cloud/shared'],
};

module.exports = nextConfig;
