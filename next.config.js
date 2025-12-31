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

  // Dynamic BUILD_ID based on timestamp to force cache invalidation
  generateBuildId: async () => {
    // Use current date + git commit hash (if available) for unique build IDs
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.HEROKU_SLUG_COMMIT?.slice(0, 7) || 'dev';
    return `autolumiku-${date}-${commit}`;
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