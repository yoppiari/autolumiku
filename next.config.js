/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  // Disable ESLint during build to prevent deployment failures
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript checking during build (we check separately)
  typescript: {
    ignoreBuildErrors: true,
  },

  // External packages for server components (Next.js 14)
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },

  // Fixed BUILD_ID to prevent chunk hash inconsistencies
  generateBuildId: async () => {
    return 'autolumiku-v1-stable'
  },

  // Webpack configuration to include PDFKit font files in standalone build
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Include PDFKit font data files
      config.externals = config.externals || [];
      config.externals.push({
        'pdfkit': 'commonjs pdfkit',
      });
    }
    return config;
  },

  // NOTE: URL decoding for dynamic routes is now handled in middleware.ts
  // NOTE: Do NOT add 'env' block here!
  // Server-side code can already access process.env directly.
  // Adding env block makes variables accessible to client-side (browser),
  // which exposes secrets to anyone inspecting the browser.
  // For client-side env vars, use NEXT_PUBLIC_ prefix and add to .env file.
}

module.exports = nextConfig