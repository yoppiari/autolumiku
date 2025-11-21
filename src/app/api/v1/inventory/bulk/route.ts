/**
 * Bulk Operations API
 * Epic 4: Story 4.5 - Bulk Operations
 *
 * POST /api/v1/inventory/bulk - Execute bulk operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { bulkOperationsService } from '@/services/inventory/bulk-operations.service';

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const { operation, vehicleIds, data } = body;

    if (!operation || !vehicleIds || !Array.isArray(vehicleIds)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: operation, vehicleIds',
        },
        { status: 400 }
      );
    }

    let result;

    switch (operation) {
      case 'update':
        result = await bulkOperationsService.bulkUpdate({
          vehicleIds,
          updates: data.updates,
          tenantId: user.tenantId,
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          reason: data.reason,
        });
        break;

      case 'delete':
        result = await bulkOperationsService.bulkDelete({
          vehicleIds,
          tenantId: user.tenantId,
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          reason: data.reason,
          softDelete: data.softDelete !== false,
        });
        break;

      case 'status-change':
        result = await bulkOperationsService.bulkStatusChange(
          vehicleIds,
          data.newStatus,
          user.tenantId,
          user.id,
          `${user.firstName} ${user.lastName}`,
          data.reason
        );
        break;

      case 'price-update':
        result = await bulkOperationsService.bulkPriceUpdate(
          vehicleIds,
          data.adjustment,
          user.tenantId,
          user.id,
          `${user.firstName} ${user.lastName}`,
          data.reason
        );
        break;

      case 'import':
        result = await bulkOperationsService.bulkImport(
          data.vehicles,
          user.tenantId,
          user.id,
          `${user.firstName} ${user.lastName}`
        );
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown operation: ${operation}`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Bulk Operations API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute bulk operation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
