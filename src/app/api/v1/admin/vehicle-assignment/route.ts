/**
 * Vehicle Sales Assignment API
 * Tracks which sales person handles each vehicle from upload to sale
 *
 * GET /api/v1/admin/vehicle-assignment?tenant=primamobil-id
 *   - List all vehicles with their assigned sales
 *
 * POST /api/v1/admin/vehicle-assignment
 *   - Assign vehicle to sales person
 *   - Record sale (when status changes to SOLD)
 *
 * POST /api/v1/admin/vehicle-assignment/setup
 *   - Add tracking columns to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List vehicles with sales assignments
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get('tenant');
  const salesId = searchParams.get('salesId');

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

    // Get vehicles with assignment info
    let query = `
      SELECT
        v.id,
        v."displayId",
        v.make,
        v.model,
        v.year,
        v.status,
        v.price,
        v."createdBy",
        v."assignedSalesId",
        v."assignedSalesName",
        v."assignedAt",
        v."soldBy",
        v."soldByName",
        v."soldAt",
        v."createdAt",
        u."firstName" || ' ' || u."lastName" as "creatorName"
      FROM vehicles v
      LEFT JOIN users u ON v."createdBy" = u.id
      WHERE v."tenantId" = $1
    `;

    const params: any[] = [tenant.id];

    if (salesId) {
      query += ` AND v."assignedSalesId" = $2`;
      params.push(salesId);
    }

    query += ` ORDER BY v."createdAt" DESC`;

    const vehicles = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    // Get sales staff for this tenant
    const salesStaff = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        role: { in: ['SALES', 'STAFF', 'ADMIN', 'MANAGER'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    // Summary stats
    const stats = {
      total: vehicles.length,
      assigned: vehicles.filter(v => v.assignedSalesId).length,
      unassigned: vehicles.filter(v => !v.assignedSalesId).length,
      sold: vehicles.filter(v => v.status === 'SOLD').length,
      available: vehicles.filter(v => v.status === 'AVAILABLE').length,
    };

    // Group by sales
    const bySales: Record<string, any[]> = {};
    vehicles.forEach(v => {
      const key = v.assignedSalesName || 'Belum Ditugaskan';
      if (!bySales[key]) bySales[key] = [];
      bySales[key].push({
        displayId: v.displayId,
        name: `${v.make} ${v.model} ${v.year}`,
        status: v.status,
        price: Number(v.price),
      });
    });

    return NextResponse.json({
      tenant: { name: tenant.name, slug: tenant.slug },
      stats,
      salesStaff: salesStaff.map(s => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        role: s.role,
      })),
      vehiclesBySales: bySales,
      vehicles: vehicles.map(v => ({
        id: v.id,
        displayId: v.displayId,
        name: `${v.make} ${v.model} ${v.year}`,
        status: v.status,
        price: Number(v.price),
        uploadedBy: v.creatorName || 'Unknown',
        assignedTo: v.assignedSalesName || null,
        assignedSalesId: v.assignedSalesId || null,
        assignedAt: v.assignedAt,
        soldBy: v.soldByName || null,
        soldAt: v.soldAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Assign vehicle or record sale
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, vehicleId, salesId, tenantSlug } = body;

    if (!vehicleId || !tenantSlug) {
      return NextResponse.json(
        { error: 'vehicleId and tenantSlug are required' },
        { status: 400 }
      );
    }

    // Verify tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Handle different actions
    if (action === 'setup') {
      // Add tracking columns to vehicles table
      const results: any[] = [];

      const columns = [
        { name: 'assignedSalesId', type: 'TEXT' },
        { name: 'assignedSalesName', type: 'TEXT' },
        { name: 'assignedAt', type: 'TIMESTAMP(3)' },
        { name: 'soldBy', type: 'TEXT' },
        { name: 'soldByName', type: 'TEXT' },
        { name: 'soldAt', type: 'TIMESTAMP(3)' },
      ];

      for (const col of columns) {
        try {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
          );
          results.push({ column: col.name, status: 'ok' });
        } catch (err: any) {
          results.push({ column: col.name, status: 'error', error: err.message });
        }
      }

      // Add index for assignedSalesId
      try {
        await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "vehicles_assignedSalesId_idx" ON "vehicles"("assignedSalesId")
        `;
        results.push({ index: 'assignedSalesId', status: 'ok' });
      } catch (err: any) {
        results.push({ index: 'assignedSalesId', status: 'error', error: err.message });
      }

      return NextResponse.json({
        success: true,
        message: 'Sales tracking columns added',
        results,
      });
    }

    if (action === 'assign') {
      // Assign vehicle to sales person
      if (!salesId) {
        return NextResponse.json({ error: 'salesId is required for assign' }, { status: 400 });
      }

      // Get sales person info
      const sales = await prisma.user.findUnique({
        where: { id: salesId },
        select: { id: true, firstName: true, lastName: true },
      });

      if (!sales) {
        return NextResponse.json({ error: 'Sales person not found' }, { status: 404 });
      }

      const salesName = `${sales.firstName} ${sales.lastName}`;

      // Update vehicle
      await prisma.$executeRaw`
        UPDATE vehicles
        SET "assignedSalesId" = ${salesId},
            "assignedSalesName" = ${salesName},
            "assignedAt" = NOW()
        WHERE id = ${vehicleId}
      `;

      return NextResponse.json({
        success: true,
        message: `Vehicle assigned to ${salesName}`,
        data: { vehicleId, salesId, salesName },
      });
    }

    if (action === 'unassign') {
      // Remove assignment
      await prisma.$executeRaw`
        UPDATE vehicles
        SET "assignedSalesId" = NULL,
            "assignedSalesName" = NULL,
            "assignedAt" = NULL
        WHERE id = ${vehicleId}
      `;

      return NextResponse.json({
        success: true,
        message: 'Vehicle unassigned',
      });
    }

    if (action === 'sold') {
      // Record sale - use assigned sales or provided salesId
      let soldById = salesId;
      let soldByName = '';

      if (!soldById) {
        // Get current assigned sales
        const vehicle = await prisma.$queryRaw<any[]>`
          SELECT "assignedSalesId", "assignedSalesName" FROM vehicles WHERE id = ${vehicleId}
        `;
        if (vehicle.length > 0 && vehicle[0].assignedSalesId) {
          soldById = vehicle[0].assignedSalesId;
          soldByName = vehicle[0].assignedSalesName;
        }
      } else {
        // Get sales name
        const sales = await prisma.user.findUnique({
          where: { id: soldById },
          select: { firstName: true, lastName: true },
        });
        if (sales) {
          soldByName = `${sales.firstName} ${sales.lastName}`;
        }
      }

      if (!soldById) {
        return NextResponse.json(
          { error: 'No sales assigned. Please assign first or provide salesId.' },
          { status: 400 }
        );
      }

      // Update vehicle status and record sale
      await prisma.$executeRaw`
        UPDATE vehicles
        SET status = 'SOLD',
            "soldBy" = ${soldById},
            "soldByName" = ${soldByName},
            "soldAt" = NOW()
        WHERE id = ${vehicleId}
      `;

      return NextResponse.json({
        success: true,
        message: `Vehicle sold by ${soldByName}`,
        data: { vehicleId, soldBy: soldById, soldByName },
      });
    }

    // Auto-assign on upload (when createdBy is set)
    if (action === 'auto_assign_creator') {
      // Get vehicle creator and assign to them
      const vehicle = await prisma.$queryRaw<any[]>`
        SELECT v."createdBy", u."firstName", u."lastName"
        FROM vehicles v
        LEFT JOIN users u ON v."createdBy" = u.id
        WHERE v.id = ${vehicleId}
      `;

      if (vehicle.length > 0 && vehicle[0].createdBy) {
        const creatorName = `${vehicle[0].firstName || ''} ${vehicle[0].lastName || ''}`.trim();

        await prisma.$executeRaw`
          UPDATE vehicles
          SET "assignedSalesId" = ${vehicle[0].createdBy},
              "assignedSalesName" = ${creatorName || 'Unknown'},
              "assignedAt" = NOW()
          WHERE id = ${vehicleId}
        `;

        return NextResponse.json({
          success: true,
          message: `Auto-assigned to creator: ${creatorName}`,
        });
      }

      return NextResponse.json({ error: 'No creator found' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
