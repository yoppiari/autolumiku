/**
 * Update Vehicle Display IDs to new format
 * GET /api/v1/vehicles/update-ids?tenant=primamobil-id
 *
 * Converts VH-XXX to PM-PST-XXX format
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get('tenant') || 'primamobil-id';

  const results: any = {
    timestamp: new Date().toISOString(),
    tenant: tenantSlug,
    updates: [],
  };

  try {
    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    results.tenantId = tenant.id;

    // Determine tenant code
    let tenantCode = 'XX';
    if (tenant.slug.includes('primamobil')) {
      tenantCode = 'PM';
    } else {
      tenantCode = tenant.slug.substring(0, 2).toUpperCase();
    }
    results.tenantCode = tenantCode;

    // Get all vehicles with old VH-XXX format for this tenant
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        displayId: { startsWith: 'VH-' },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, displayId: true, createdAt: true },
    });

    results.vehiclesFound = vehicles.length;

    if (vehicles.length === 0) {
      results.message = 'No vehicles with VH-XXX format found';
      return NextResponse.json(results);
    }

    // Get the highest existing sequence for PM-PST-XXX
    const showroomCode = 'PST';
    const prefix = `${tenantCode}-${showroomCode}-`;

    const existingVehicles = await prisma.vehicle.findMany({
      where: {
        displayId: { startsWith: prefix },
      },
      orderBy: { displayId: 'desc' },
      take: 1,
      select: { displayId: true },
    });

    let nextSequence = 1;
    if (existingVehicles.length > 0 && existingVehicles[0].displayId) {
      const match = existingVehicles[0].displayId.match(/-(\d+)$/);
      if (match) {
        nextSequence = parseInt(match[1], 10) + 1;
      }
    }

    results.startingSequence = nextSequence;

    // Update each vehicle
    for (const vehicle of vehicles) {
      const newDisplayId = `${prefix}${String(nextSequence).padStart(3, '0')}`;

      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { displayId: newDisplayId },
      });

      results.updates.push({
        oldId: vehicle.displayId,
        newId: newDisplayId,
        vehicleId: vehicle.id,
      });

      nextSequence++;
    }

    results.success = true;
    results.message = `Updated ${results.updates.length} vehicle IDs`;

  } catch (err: any) {
    results.success = false;
    results.error = err.message;
  }

  return NextResponse.json(results);
}
