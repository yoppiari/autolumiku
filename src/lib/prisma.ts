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
  const baseUrl = process.env.DATABASE_URL || '';

  if (!baseUrl) {
    console.error('[Prisma] DATABASE_URL not set in environment!');
    return '';
  }

  const poolParams = 'connection_limit=10&pool_timeout=20&connect_timeout=10';

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
