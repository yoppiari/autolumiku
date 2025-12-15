/**
 * GET /api/v1/vehicles/[id] - Get single vehicle
 * PUT /api/v1/vehicles/[id] - Update vehicle
 * DELETE /api/v1/vehicles/[id] - Delete vehicle
 */

import { NextRequest, NextResponse } from 'next/server';
import { VehicleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/vehicles/[id]
 * Get single vehicle by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
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
  try {
    const { id } = await params;

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

    // TODO: Get userId from authenticated user session
    const { userId, ...updateData } = body;

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const dataToUpdate: any = {};

    // Basic Information
    if (updateData.make !== undefined) dataToUpdate.make = updateData.make;
    if (updateData.model !== undefined) dataToUpdate.model = updateData.model;
    if (updateData.year !== undefined) dataToUpdate.year = updateData.year;
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
    if (updateData.mileage !== undefined) dataToUpdate.mileage = updateData.mileage;
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

    // Metadata
    if (userId) dataToUpdate.updatedBy = userId;

    // Update vehicle
    const vehicle = await prisma.vehicle.update({
      where: { id },
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
  try {
    const { id } = await params;

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting status to DELETED
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        status: VehicleStatus.DELETED,
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
