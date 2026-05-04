/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless', 'ws'],
  },
  images: {
    remotePatterns: [],
  },
}

module.exports = nextConfig
