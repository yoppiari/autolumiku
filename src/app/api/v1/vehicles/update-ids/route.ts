/**
 * Update Vehicle Display IDs to new format
 * GET /api/v1/vehicles/update-ids?tenant=primamobil-id
 * GET /api/v1/vehicles/update-ids?fix=PR-PST-001&newId=PM-PST-006
 * GET /api/v1/vehicles/update-ids?swap=PM-PST-007&with=PM-PST-006
 * GET /api/v1/vehicles/update-ids?info=PM-PST-006
 *
 * Converts VH-XXX to PM-PST-XXX format
 * Or fixes a specific displayId with ?fix=OLD_ID&newId=NEW_ID
 * Or swaps two displayIds with ?swap=ID1&with=ID2
 * Or gets info about a displayId with ?info=ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  // Info about a specific displayId
  const infoId = request.nextUrl.searchParams.get('info');
  if (infoId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { displayId: infoId },
      select: { id: true, displayId: true, make: true, model: true, year: true, status: true },
    });
    if (!vehicle) {
      return NextResponse.json({ success: false, error: `displayId "${infoId}" not found` }, { status: 404 });
    }
    return NextResponse.json({ success: true, vehicle });
  }

  // Swap two displayIds
  const swapId1 = request.nextUrl.searchParams.get('swap');
  const swapId2 = request.nextUrl.searchParams.get('with');
  if (swapId1 && swapId2) {
    try {
      const vehicle1 = await prisma.vehicle.findFirst({
        where: { displayId: swapId1 },
        select: { id: true, displayId: true, make: true, model: true, year: true, status: true },
      });
      const vehicle2 = await prisma.vehicle.findFirst({
        where: { displayId: swapId2 },
        select: { id: true, displayId: true, make: true, model: true, year: true, status: true },
      });

      if (!vehicle1) {
        return NextResponse.json({ success: false, error: `displayId "${swapId1}" not found` }, { status: 404 });
      }
      if (!vehicle2) {
        return NextResponse.json({ success: false, error: `displayId "${swapId2}" not found` }, { status: 404 });
      }

      // Swap using temp ID
      const tempId = `TEMP-${Date.now()}`;
      await prisma.vehicle.update({ where: { id: vehicle1.id }, data: { displayId: tempId } });
      await prisma.vehicle.update({ where: { id: vehicle2.id }, data: { displayId: swapId1 } });
      await prisma.vehicle.update({ where: { id: vehicle1.id }, data: { displayId: swapId2 } });

      return NextResponse.json({
        success: true,
        message: `Swapped displayIds: "${swapId1}" ↔ "${swapId2}"`,
        vehicle1: { ...vehicle1, newDisplayId: swapId2 },
        vehicle2: { ...vehicle2, newDisplayId: swapId1 },
      });
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // Quick fix for specific displayId
  const fixOldId = request.nextUrl.searchParams.get('fix');
  const fixNewId = request.nextUrl.searchParams.get('newId');

  if (fixOldId && fixNewId) {
    try {
      // Find vehicle with old displayId
      const vehicle = await prisma.vehicle.findFirst({
        where: { displayId: fixOldId },
        select: { id: true, displayId: true, make: true, model: true, year: true },
      });

      if (!vehicle) {
        return NextResponse.json({
          success: false,
          error: `Vehicle with displayId "${fixOldId}" not found`,
        }, { status: 404 });
      }

      // Check if new displayId already exists
      const existing = await prisma.vehicle.findFirst({
        where: { displayId: fixNewId },
      });

      if (existing) {
        return NextResponse.json({
          success: false,
          error: `displayId "${fixNewId}" already exists`,
        }, { status: 400 });
      }

      // Update displayId
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { displayId: fixNewId },
      });

      return NextResponse.json({
        success: true,
        message: `Updated displayId from "${fixOldId}" to "${fixNewId}"`,
        vehicle: {
          id: vehicle.id,
          oldDisplayId: fixOldId,
          newDisplayId: fixNewId,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
        },
      });
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        error: err.message,
      }, { status: 500 });
    }
  }

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
