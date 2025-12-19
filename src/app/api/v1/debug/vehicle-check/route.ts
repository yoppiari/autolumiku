/**
 * Debug: Check vehicle inventory for duplicates
 * GET /api/v1/debug/vehicle-check
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
  };

  try {
    // Get all vehicles with their IDs
    const vehicles = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        "displayId",
        make,
        model,
        year,
        status,
        "tenantId",
        "createdAt"
      FROM vehicles
      ORDER BY "createdAt" DESC
    `;

    results.totalVehicles = vehicles.length;
    results.vehicles = vehicles.map((v, i) => ({
      no: i + 1,
      displayId: v.displayId || 'NO-DISPLAY-ID',
      name: `${v.make} ${v.model} ${v.year}`,
      status: v.status,
      uuid: v.id,
      tenantId: v.tenantId,
    }));

    // Check for duplicate UUIDs
    const uuids = vehicles.map(v => v.id);
    const uniqueUuids = Array.from(new Set(uuids));
    results.uuidCheck = {
      total: uuids.length,
      unique: uniqueUuids.length,
      hasDuplicates: uuids.length !== uniqueUuids.length,
    };

    // Check for duplicate displayIds
    const displayIds = vehicles.map(v => v.displayId).filter(d => d);
    const uniqueDisplayIds = Array.from(new Set(displayIds));
    results.displayIdCheck = {
      total: displayIds.length,
      unique: uniqueDisplayIds.length,
      hasDuplicates: displayIds.length !== uniqueDisplayIds.length,
    };

    // Find duplicates if any
    if (results.uuidCheck.hasDuplicates) {
      const seen = new Set();
      const dupes: string[] = [];
      uuids.forEach(id => {
        if (seen.has(id)) dupes.push(id);
        seen.add(id);
      });
      results.duplicateUuids = dupes;
    }

    if (results.displayIdCheck.hasDuplicates) {
      const seen = new Set();
      const dupes: string[] = [];
      displayIds.forEach(id => {
        if (seen.has(id)) dupes.push(id);
        seen.add(id);
      });
      results.duplicateDisplayIds = dupes;
    }

    // Group by tenant
    const byTenant: Record<string, number> = {};
    vehicles.forEach(v => {
      byTenant[v.tenantId] = (byTenant[v.tenantId] || 0) + 1;
    });
    results.vehiclesByTenant = byTenant;

    results.summary = {
      allIdsUnique: !results.uuidCheck.hasDuplicates && !results.displayIdCheck.hasDuplicates,
      message: results.uuidCheck.hasDuplicates || results.displayIdCheck.hasDuplicates
        ? 'WARNING: Duplicate IDs found!'
        : 'OK: All vehicle IDs are unique',
    };

  } catch (err: any) {
    results.error = err.message;
  }

  return NextResponse.json(results);
}
