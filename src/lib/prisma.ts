/**
 * Prisma Client Singleton
 * Ensures single Prisma Client instance across the application
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build DATABASE_URL with connection pool parameters
function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL;

  // CRITICAL FIX: If DATABASE_URL is missing, return a dummy URL to prevent
  // Prisma Client from throwing a "ValidationError" during initialization.
  // This keeps the app alive (rendering 500s only on specific queries) rather than crashing on startup.
  if (!baseUrl || baseUrl.trim() === '') {
    console.warn('[Prisma] FATAL: DATABASE_URL not set! Using dummy URL to prevent crash.');
    // Return a syntactically valid PostgreSQL URL to satisfy Prisma's parser
    return 'postgresql://dummy:dummy@localhost:5432/dummy';
  }

  const poolParams = 'connection_limit=20&pool_timeout=30&connect_timeout=15';

  // Check if URL already has query parameters
  if (baseUrl.includes('?')) {
    return `${baseUrl}&${poolParams}`;
  }
  return `${baseUrl}?${poolParams}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

// Always set global reference to prevent multiple instances
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
  console.log('[Prisma] Initialized new Prisma Client');
  console.log('[Prisma] Database URL:', getDatabaseUrl().replace(/:[^:@]+@/, ':****@'));
} else {
  console.log('[Prisma] Reusing existing Prisma Client');
}

/**
 * Graceful shutdown
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

// Handle process termination
process.on('beforeExit', async () => {
  await disconnectPrisma();
});
