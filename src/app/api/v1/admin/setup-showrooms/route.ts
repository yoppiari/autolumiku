/**
 * Setup Showrooms and Update Vehicle IDs
 * POST /api/v1/admin/setup-showrooms
 *
 * Creates showroom-based vehicle ID format:
 * Format: {TENANT_CODE}-{SHOWROOM_CODE}-{SEQUENCE}
 * Example: PM-PST-001 (Prima Mobil - Pusat - Vehicle 1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  try {
    const body = await request.json();
    const { tenantSlug, action } = body;

    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
    }

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    results.tenant = { id: tenant.id, name: tenant.name, slug: tenant.slug };

    // Step 1: Ensure showrooms table exists
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "showrooms" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "address" TEXT,
          "city" TEXT,
          "province" TEXT,
          "phone" TEXT,
          "whatsappNumber" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "isMain" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "showrooms_pkey" PRIMARY KEY ("id")
        )
      `;
      results.steps.push({ step: 'create_showrooms_table', status: 'ok' });
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        results.steps.push({ step: 'create_showrooms_table', status: 'already exists' });
      } else {
        results.steps.push({ step: 'create_showrooms_table', status: 'error', error: err.message });
      }
    }

    // Step 2: Add showroomId to vehicles if not exists
    try {
      await prisma.$executeRaw`
        ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "showroomId" TEXT
      `;
      results.steps.push({ step: 'add_vehicles_showroomId', status: 'ok' });
    } catch (err: any) {
      results.steps.push({ step: 'add_vehicles_showroomId', status: 'error', error: err.message });
    }

    // Step 3: Create default showroom for this tenant
    const showroomId = `showroom-${tenant.slug}-main`;
    const tenantCode = getTenantCode(tenant.slug);

    try {
      // Check if showroom exists
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM showrooms WHERE id = ${showroomId}
      `;

      if (existing.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO showrooms (id, "tenantId", code, name, "isMain", "isActive", "createdAt", "updatedAt")
          VALUES (${showroomId}, ${tenant.id}, ${tenantCode + '-PST'}, ${tenant.name + ' - Pusat'}, true, true, NOW(), NOW())
        `;
        results.steps.push({ step: 'create_main_showroom', status: 'created', code: tenantCode + '-PST' });
      } else {
        results.steps.push({ step: 'create_main_showroom', status: 'already exists' });
      }
    } catch (err: any) {
      results.steps.push({ step: 'create_main_showroom', status: 'error', error: err.message });
    }

    // Step 4: Update vehicle displayIds with new format
    if (action === 'update_ids') {
      try {
        // Get all vehicles for this tenant
        const vehicles = await prisma.$queryRaw<any[]>`
          SELECT id, "displayId", "createdAt"
          FROM vehicles
          WHERE "tenantId" = ${tenant.id}
          ORDER BY "createdAt" ASC
        `;

        results.vehiclesFound = vehicles.length;
        results.updatedIds = [];

        // Update each vehicle with new format
        for (let i = 0; i < vehicles.length; i++) {
          const vehicle = vehicles[i];
          const sequence = String(i + 1).padStart(3, '0');
          const newDisplayId = `${tenantCode}-PST-${sequence}`;

          await prisma.$executeRaw`
            UPDATE vehicles
            SET "displayId" = ${newDisplayId}, "showroomId" = ${showroomId}
            WHERE id = ${vehicle.id}
          `;

          results.updatedIds.push({
            old: vehicle.displayId,
            new: newDisplayId,
          });
        }

        results.steps.push({ step: 'update_vehicle_ids', status: 'ok', count: vehicles.length });
      } catch (err: any) {
        results.steps.push({ step: 'update_vehicle_ids', status: 'error', error: err.message });
      }
    }

    // Get current state
    try {
      const vehicles = await prisma.$queryRaw<any[]>`
        SELECT id, "displayId", make, model, year, "showroomId"
        FROM vehicles
        WHERE "tenantId" = ${tenant.id}
        ORDER BY "displayId" ASC
      `;
      results.currentVehicles = vehicles.map(v => ({
        displayId: v.displayId,
        name: `${v.make} ${v.model} ${v.year}`,
        showroomId: v.showroomId,
      }));
    } catch (err: any) {
      results.currentVehicles = { error: err.message };
    }

    results.success = true;
    results.message = action === 'update_ids'
      ? 'Showroom setup complete and vehicle IDs updated'
      : 'Showroom setup complete. Call with action="update_ids" to update vehicle IDs.';

  } catch (error: any) {
    results.success = false;
    results.error = error.message;
  }

  return NextResponse.json(results);
}

/**
 * Get tenant code from slug
 * primamobil-id -> PM
 * showroom-xyz -> SX
 */
function getTenantCode(slug: string): string {
  const mapping: Record<string, string> = {
    'primamobil-id': 'PM',
    'primamobil': 'PM',
    'prima-mobil': 'PM',
  };

  if (mapping[slug]) {
    return mapping[slug];
  }

  // Generate from slug: take first letter of each word
  const words = slug.replace(/-/g, ' ').split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return slug.substring(0, 2).toUpperCase();
}

// GET to check current state
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get('tenant');

  if (!tenantSlug) {
    return NextResponse.json({ error: 'tenant param required' }, { status: 400 });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get showrooms
    let showrooms: any[] = [];
    try {
      showrooms = await prisma.$queryRaw<any[]>`
        SELECT id, code, name, "isMain", "isActive"
        FROM showrooms
        WHERE "tenantId" = ${tenant.id}
      `;
    } catch (e) {
      // Table might not exist
    }

    // Get vehicles
    const vehicles = await prisma.$queryRaw<any[]>`
      SELECT id, "displayId", make, model, year, status
      FROM vehicles
      WHERE "tenantId" = ${tenant.id}
      ORDER BY "displayId" ASC
    `;

    return NextResponse.json({
      tenant: { name: tenant.name, slug: tenant.slug },
      showrooms,
      vehicles: vehicles.map(v => ({
        displayId: v.displayId,
        name: `${v.make} ${v.model} ${v.year}`,
        status: v.status,
      })),
      idFormat: {
        current: vehicles[0]?.displayId || 'none',
        recommended: `${getTenantCode(tenantSlug)}-PST-001`,
        description: 'Format: {TENANT}-{SHOWROOM}-{SEQUENCE}',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
