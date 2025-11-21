/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  experimental: {
    serverComponentsExternalPackages: ['pg']
  },

  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    REDIS_URL: process.env.REDIS_URL
  }
}

module.exports = nextConfig