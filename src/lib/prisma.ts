/**
 * Prisma Client Singleton
 * Ensures single Prisma Client instance across the application
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
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
