/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  experimental: {
    serverComponentsExternalPackages: ['pg']
  },

  // NOTE: Do NOT add 'env' block here!
  // Server-side code can already access process.env directly.
  // Adding env block makes variables accessible to client-side (browser),
  // which exposes secrets to anyone inspecting the browser.
  // For client-side env vars, use NEXT_PUBLIC_ prefix and add to .env file.
}

module.exports = nextConfig