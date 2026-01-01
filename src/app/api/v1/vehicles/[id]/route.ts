/**
 * GET /api/v1/vehicles/[id] - Get single vehicle
 * PUT /api/v1/vehicles/[id] - Update vehicle
 * DELETE /api/v1/vehicles/[id] - Delete vehicle
 *
 * Protected: Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { VehicleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';

// Reserved route names that should not be treated as vehicle IDs
const RESERVED_ROUTES = ['update-ids', 'ai-identify', 'search', 'bulk'];

import { isValidUUID, parseVehicleSlug } from '@/lib/utils';

// ... existing imports

/**
 * GET /api/v1/vehicles/[id]
 * Get single vehicle by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ... auth logic

  try {
    const { id } = await params;

    // Skip reserved routes - let Next.js handle them
    if (RESERVED_ROUTES.includes(id)) {
      return NextResponse.json(
        { error: 'Invalid route', message: 'This endpoint requires a vehicle ID' },
        { status: 400 }
      );
    }

    let vehicle;
    const { id: searchId, isUuid } = parseVehicleSlug(id);

    console.log(`[Vehicle API] GET request for: ${id} -> searchId: ${searchId}, isUuid: ${isUuid}`);

    if (isUuid) {
      vehicle = await prisma.vehicle.findUnique({
        where: { id: searchId },
        include: {
          photos: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
    } else {
      // Try exact match as displayId
      vehicle = await prisma.vehicle.findUnique({
        where: { displayId: searchId },
        include: {
          photos: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      // Fallback: If not found, try to resolve from slug parts if the searchId itself wasn't found
      // (This handles cases where parseVehicleSlug might have returned the whole string if year wasn't found)
      if (!vehicle && id.includes('-') && !searchId.includes('-')) {
        // SearchId is likely already the displayId candidate from parseVehicleSlug
        // No need for complex logic here if parseVehicleSlug works well
      }
    }

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Tenant validation: non-super_admin can only view vehicles from their own tenant
    if (auth.user.role.toLowerCase() !== 'super_admin' && vehicle.tenantId !== auth.user.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot access vehicles from other tenant' },
        { status: 403 }
      );
    }

    // Convert BigInt to number for JSON serialization
    const vehicleResponse = {
      ...vehicle,
      price: Number(vehicle.price),
      aiSuggestedPrice: vehicle.aiSuggestedPrice ? Number(vehicle.aiSuggestedPrice) : null,
    };

    return NextResponse.json({
      success: true,
      data: vehicleResponse,
    });
  } catch (error) {
    console.error('Get vehicle error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get vehicle',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/vehicles/[id]
 * Update vehicle
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // RBAC: No exclusions - all authenticated roles can update vehicles
  // Sales, Admin, Owner, Super Admin all have access

  // Check permission - admin, owner, and sales/staff can update vehicles
  if (!['admin', 'super_admin', 'owner', 'staff', 'sales'].includes(auth.user.role.toLowerCase())) {
    return NextResponse.json(
      { error: 'Forbidden - No permission to update vehicles' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Skip reserved routes
    if (RESERVED_ROUTES.includes(id)) {
      return NextResponse.json(
        { error: 'Invalid route' },
        { status: 400 }
      );
    }

    let targetId = id;
    const { id: searchId, isUuid } = parseVehicleSlug(id);

    // If not UUID, resolve to actual internal ID first
    if (!isUuid) {
      console.log(`[Vehicle API] 🔍 PUT: Slug/DisplayId detected: ${id} -> ${searchId}. Resolving...`);
      const resolved = await prisma.vehicle.findUnique({
        where: { displayId: searchId },
        select: { id: true }
      });

      if (!resolved) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
      }
      targetId = resolved.id;
      console.log(`[Vehicle API] ✅ Resolved ${id} -> ${targetId}`);
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    console.log('[Vehicle Update] Request body:', JSON.stringify(body, null, 2));

    const { userId, ...updateData } = body;

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: targetId },
    });

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Tenant validation: non-super_admin can only update vehicles from their own tenant
    if (auth.user.role.toLowerCase() !== 'super_admin' && existingVehicle.tenantId !== auth.user.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot update vehicles from other tenant' },
        { status: 403 }
      );
    }

    // Prepare update data
    const dataToUpdate: any = {};

    // Basic Information
    if (updateData.make !== undefined) dataToUpdate.make = updateData.make;
    if (updateData.model !== undefined) dataToUpdate.model = updateData.model;
    if (updateData.year !== undefined) dataToUpdate.year = parseInt(String(updateData.year), 10); // Ensure integer
    if (updateData.variant !== undefined) dataToUpdate.variant = updateData.variant;

    // AI-Generated Content
    if (updateData.descriptionId !== undefined) dataToUpdate.descriptionId = updateData.descriptionId;
    if (updateData.descriptionEn !== undefined) dataToUpdate.descriptionEn = updateData.descriptionEn;
    if (updateData.features !== undefined) dataToUpdate.features = updateData.features;
    if (updateData.specifications !== undefined) dataToUpdate.specifications = updateData.specifications;

    // AI Metadata
    if (updateData.aiConfidence !== undefined) dataToUpdate.aiConfidence = updateData.aiConfidence;
    if (updateData.aiReasoning !== undefined) dataToUpdate.aiReasoning = updateData.aiReasoning;
    if (updateData.manuallyEdited !== undefined) dataToUpdate.manuallyEdited = updateData.manuallyEdited;

    // Pricing (convert to BigInt for database)
    if (updateData.price !== undefined) dataToUpdate.price = BigInt(updateData.price);
    if (updateData.aiSuggestedPrice !== undefined) {
      dataToUpdate.aiSuggestedPrice = updateData.aiSuggestedPrice ? BigInt(updateData.aiSuggestedPrice) : null;
    }
    if (updateData.priceConfidence !== undefined) dataToUpdate.priceConfidence = updateData.priceConfidence;
    if (updateData.priceAnalysis !== undefined) dataToUpdate.priceAnalysis = updateData.priceAnalysis;

    // Vehicle Details
    if (updateData.mileage !== undefined) dataToUpdate.mileage = updateData.mileage ? parseInt(String(updateData.mileage), 10) : null;
    if (updateData.transmissionType !== undefined) dataToUpdate.transmissionType = updateData.transmissionType;
    if (updateData.fuelType !== undefined) dataToUpdate.fuelType = updateData.fuelType;
    if (updateData.color !== undefined) dataToUpdate.color = updateData.color;
    if (updateData.licensePlate !== undefined) dataToUpdate.licensePlate = updateData.licensePlate;
    if (updateData.engineCapacity !== undefined) dataToUpdate.engineCapacity = updateData.engineCapacity;
    if (updateData.condition !== undefined) dataToUpdate.condition = updateData.condition;

    // Status
    if (updateData.status !== undefined) {
      dataToUpdate.status = updateData.status;
      // Set publishedAt when status changes to AVAILABLE
      if (updateData.status === VehicleStatus.AVAILABLE && !existingVehicle.publishedAt) {
        dataToUpdate.publishedAt = new Date();
      }
    }

    // Organization
    if (updateData.tags !== undefined) dataToUpdate.tags = updateData.tags;
    if (updateData.categories !== undefined) dataToUpdate.categories = updateData.categories;
    if (updateData.isFeatured !== undefined) dataToUpdate.isFeatured = updateData.isFeatured;
    if (updateData.displayOrder !== undefined) dataToUpdate.displayOrder = updateData.displayOrder;

    // Metadata - use authenticated user ID
    dataToUpdate.updatedBy = auth.user.id;

    // Update vehicle
    const vehicle = await prisma.vehicle.update({
      where: { id: targetId },
      data: dataToUpdate,
      include: {
        photos: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    // Convert BigInt to number for JSON serialization
    const vehicleResponse = {
      ...vehicle,
      price: Number(vehicle.price),
      aiSuggestedPrice: vehicle.aiSuggestedPrice ? Number(vehicle.aiSuggestedPrice) : null,
    };

    return NextResponse.json({
      success: true,
      data: vehicleResponse,
    });
  } catch (error) {
    console.error('Update vehicle error:', error);

    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        error: 'Failed to update vehicle',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.name : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/vehicles/[id]
 * Soft delete vehicle (set status to DELETED)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // RBAC: No exclusions for checking access - permission check happens below
  // Delete permission requires Admin+, but all roles pass this initial check

  // Check permission - only admin, owner, and super_admin can delete vehicles
  if (!['admin', 'super_admin', 'owner'].includes(auth.user.role.toLowerCase())) {
    return NextResponse.json(
      { error: 'Forbidden - Admin or Owner access required to delete vehicles' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Skip reserved routes
    if (RESERVED_ROUTES.includes(id)) {
      return NextResponse.json(
        { error: 'Invalid route' },
        { status: 400 }
      );
    }

    let targetId = id;
    const { id: searchId, isUuid } = parseVehicleSlug(id);

    // If not UUID, resolve to actual internal ID first
    if (!isUuid) {
      const resolved = await prisma.vehicle.findUnique({
        where: { displayId: searchId },
        select: { id: true }
      });

      if (!resolved) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
      }
      targetId = resolved.id;
    }

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: targetId },
    });

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Tenant validation: non-super_admin can only delete vehicles from their own tenant
    if (auth.user.role.toLowerCase() !== 'super_admin' && existingVehicle.tenantId !== auth.user.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot delete vehicles from other tenant' },
        { status: 403 }
      );
    }

    // Soft delete by setting status to DELETED
    const vehicle = await prisma.vehicle.update({
      where: { id: targetId },
      data: {
        status: VehicleStatus.DELETED,
        updatedBy: auth.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Vehicle deleted successfully',
      data: { id: vehicle.id },
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete vehicle',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
