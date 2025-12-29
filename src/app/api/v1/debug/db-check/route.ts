/**
 * Database Connection Test & Fix
 * GET /api/v1/debug/db-check
 *
 * Diagnoses and fixes database connection issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    steps: [],
    success: false,
  };

  let prisma: PrismaClient | null = null;

  try {
    // Step 1: Check environment variables
    results.steps.push({
      step: '1. Check DATABASE_URL',
      status: 'ok',
      data: {
        exists: !!process.env.DATABASE_URL,
        // Show safe version (hide password)
        safeUrl: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'),
      },
    });

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set in environment');
    }

    // Step 2: Parse DATABASE_URL
    const dbUrl = new URL(process.env.DATABASE_URL);
    results.steps.push({
      step: '2. Parse DATABASE_URL',
      status: 'ok',
      data: {
        host: dbUrl.hostname,
        port: dbUrl.port,
        database: dbUrl.pathname.replace('/', ''),
        user: dbUrl.username,
      },
    });

    // Step 3: Initialize Prisma
    results.steps.push({
      step: '3. Initialize Prisma Client',
      status: 'ok',
    });

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Step 4: Test connection
    results.steps.push({
      step: '4. Test Database Connection',
      status: 'running',
    });

    await prisma.$connect();
    results.steps[3].status = 'ok';

    // Step 5: Simple query
    results.steps.push({
      step: '5. Execute Test Query',
      status: 'running',
    });

    const result = await prisma.$queryRaw`SELECT 1 as test`;
    results.steps[4].status = 'ok';
    results.steps[4].data = result;

    // Step 6: Check if vehicles table exists
    results.steps.push({
      step: '6. Check Vehicles Table',
      status: 'running',
    });

    const tableCheck = await prisma.$queryRaw<any[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'vehicles'
    `;

    results.steps[5].status = 'ok';
    results.steps[5].data = { vehiclesTableExists: tableCheck.length > 0 };

    // Step 7: Check columns in vehicles table
    results.steps.push({
      step: '7. Check Vehicles Columns',
      status: 'running',
    });

    const columns = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vehicles'
      ORDER BY column_name
    `;

    results.steps[6].status = 'ok';
    results.steps[6].data = {
      totalColumns: columns.length,
      columns: columns.map((c: any) => c.column_name),
    };

    // Step 8: Check if assignedSalesId exists
    const hasAssignedSalesId = columns.some((c: any) => c.column_name === 'assignedSalesId');
    results.steps.push({
      step: '8. Check assignedSalesId Column',
      status: hasAssignedSalesId ? 'ok' : 'warning',
      data: { exists: hasAssignedSalesId },
    });

    if (!hasAssignedSalesId) {
      results.steps.push({
        step: '9. Add Missing Columns',
        status: 'running',
      });

      // Add missing columns
      const columnsToAdd = [
        'assignedSalesId TEXT',
        'assignedSalesName TEXT',
        'assignedAt TIMESTAMP(3)',
        'soldBy TEXT',
        'soldByName TEXT',
        'soldAt TIMESTAMP(3)',
      ];

      for (const colDef of columnsToAdd) {
        const colName = colDef.split(' ')[0];
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "${colName}" ${colDef.replace(colName + ' ', '')}`);
          results.steps[8].data = results.steps[8].data || {};
          results.steps[8].data[colName] = 'added';
        } catch (err: any) {
          results.steps[8].data = results.steps[8].data || {};
          results.steps[8].data[colName] = 'error: ' + err.message;
        }
      }

      // Add index
      try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "vehicles_assignedSalesId_idx" ON "vehicles"("assignedSalesId")`;
        results.steps[8].data.indexCreated = true;
      } catch (err: any) {
        results.steps[8].data.indexCreated = 'error: ' + err.message;
      }

      results.steps[8].status = 'ok';
    }

    results.success = true;
    results.message = 'Database connection successful and schema verified';

  } catch (error: any) {
    results.steps.push({
      step: 'ERROR',
      status: 'failed',
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });
    results.success = false;
    results.message = 'Database connection failed: ' + error.message;
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }

  return NextResponse.json(results);
}
