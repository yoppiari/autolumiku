/**
 * Bulk Operations Service
 * Epic 4: Story 4.5 - Bulk Operations for Multiple Vehicles
 *
 * Handles bulk create, update, delete operations for vehicles
 */

import { prisma } from '@/lib/prisma';
import { Vehicle, Prisma } from '@prisma/client';
import { versionHistoryService } from './version-history.service';
import { realTimeSyncService } from './real-time-sync.service';

export interface BulkUpdateOperation {
  vehicleIds: string[];
  updates: Partial<Vehicle>;
  tenantId: string;
  userId: string;
  userName?: string;
  reason?: string;
}

export interface BulkDeleteOperation {
  vehicleIds: string[];
  tenantId: string;
  userId: string;
  userName?: string;
  reason?: string;
  softDelete?: boolean;
}

export interface BulkImportVehicle {
  make: string;
  model: string;
  year: number;
  variant?: string;
  price: number;
  mileage?: number;
  transmissionType?: string;
  fuelType?: string;
  color?: string;
  licensePlate?: string;
  [key: string]: any;
}

export interface BulkOperationResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: Array<{
    index: number;
    vehicleId?: string;
    error: string;
  }>;
  vehicleIds: string[];
}

export class BulkOperationsService {
  /**
   * Bulk update vehicles
   */
  async bulkUpdate(operation: BulkUpdateOperation): Promise<BulkOperationResult> {
    const { vehicleIds, updates, tenantId, userId, userName, reason } = operation;

    const result: BulkOperationResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: [],
      vehicleIds: [],
    };

    // Get current vehicles for version history
    const currentVehicles = await prisma.vehicle.findMany({
      where: {
        id: { in: vehicleIds },
        tenantId,
      },
    });

    const vehicleMap = new Map(currentVehicles.map((v) => [v.id, v]));

    // Process each vehicle
    for (let i = 0; i < vehicleIds.length; i++) {
      const vehicleId = vehicleIds[i];
      const currentVehicle = vehicleMap.get(vehicleId);

      if (!currentVehicle) {
        result.failedCount++;
        result.errors.push({
          index: i,
          vehicleId,
          error: 'Vehicle not found',
        });
        continue;
      }

      try {
        // Update vehicle
        const updated = await prisma.vehicle.update({
          where: { id: vehicleId },
          data: {
            ...updates,
            updatedAt: new Date(),
            updatedBy: userId,
          },
        });

        // Record version history
        await versionHistoryService.recordUpdate(
          vehicleId,
          tenantId,
          currentVehicle,
          updated,
          userId,
          userName,
          reason || 'Bulk update operation'
        );

        result.processedCount++;
        result.vehicleIds.push(vehicleId);
      } catch (error: any) {
        result.failedCount++;
        result.errors.push({
          index: i,
          vehicleId,
          error: error.message || 'Update failed',
        });
      }
    }

    // Emit real-time event
    if (result.processedCount > 0) {
      realTimeSyncService.emitBulkUpdate(
        tenantId,
        result.vehicleIds,
        'update',
        userId,
        userName
      );
    }

    result.success = result.failedCount === 0;
    return result;
  }

  /**
   * Bulk delete vehicles
   */
  async bulkDelete(operation: BulkDeleteOperation): Promise<BulkOperationResult> {
    const { vehicleIds, tenantId, userId, userName, reason, softDelete = true } = operation;

    const result: BulkOperationResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: [],
      vehicleIds: [],
    };

    for (let i = 0; i < vehicleIds.length; i++) {
      const vehicleId = vehicleIds[i];

      try {
        if (softDelete) {
          // Soft delete: update status to deleted
          await prisma.vehicle.update({
            where: {
              id: vehicleId,
              tenantId,
            },
            data: {
              status: 'DELETED',
              updatedAt: new Date(),
              updatedBy: userId,
            },
          });
        } else {
          // Hard delete
          await prisma.vehicle.delete({
            where: {
              id: vehicleId,
              tenantId,
            },
          });
        }

        result.processedCount++;
        result.vehicleIds.push(vehicleId);

        // Emit real-time event
        realTimeSyncService.emitVehicleDeleted(tenantId, vehicleId, userId, userName);
      } catch (error: any) {
        result.failedCount++;
        result.errors.push({
          index: i,
          vehicleId,
          error: error.message || 'Delete failed',
        });
      }
    }

    result.success = result.failedCount === 0;
    return result;
  }

  /**
   * Bulk import vehicles from CSV data
   */
  async bulkImport(
    vehicles: BulkImportVehicle[],
    tenantId: string,
    userId: string,
    userName?: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: [],
      vehicleIds: [],
    };

    for (let i = 0; i < vehicles.length; i++) {
      const vehicleData = vehicles[i];

      try {
        // Validate required fields
        if (!vehicleData.make || !vehicleData.model || !vehicleData.year || !vehicleData.price) {
          throw new Error('Missing required fields: make, model, year, price');
        }

        // Create vehicle
        const created = await prisma.vehicle.create({
          data: {
            ...vehicleData,
            tenantId,
            status: 'DRAFT',
            createdBy: userId,
            createdAt: new Date(),
          },
        });

        // Record version history
        await versionHistoryService.recordCreate(
          created.id,
          tenantId,
          created,
          userId,
          userName
        );

        result.processedCount++;
        result.vehicleIds.push(created.id);

        // Emit real-time event
        realTimeSyncService.emitVehicleCreated(tenantId, created.id, created, userId, userName);
      } catch (error: any) {
        result.failedCount++;
        result.errors.push({
          index: i,
          error: error.message || 'Import failed',
        });
      }
    }

    result.success = result.failedCount === 0;
    return result;
  }

  /**
   * Bulk status change
   */
  async bulkStatusChange(
    vehicleIds: string[],
    newStatus: string,
    tenantId: string,
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: [],
      vehicleIds: [],
    };

    // Get current vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: {
        id: { in: vehicleIds },
        tenantId,
      },
    });

    for (const vehicle of vehicles) {
      try {
        const oldStatus = vehicle.status;

        // Update status
        const updated = await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            status: newStatus as any,
            updatedAt: new Date(),
            updatedBy: userId,
          },
        });

        // Record status change in version history
        await versionHistoryService.recordStatusChange(
          vehicle.id,
          tenantId,
          oldStatus,
          newStatus,
          updated,
          userId,
          userName,
          reason
        );

        result.processedCount++;
        result.vehicleIds.push(vehicle.id);

        // Emit real-time event
        realTimeSyncService.emitStatusChanged(
          tenantId,
          vehicle.id,
          oldStatus,
          newStatus,
          userId,
          userName
        );
      } catch (error: any) {
        result.failedCount++;
        result.errors.push({
          vehicleId: vehicle.id,
          error: error.message || 'Status change failed',
        });
      }
    }

    result.success = result.failedCount === 0;
    return result;
  }

  /**
   * Bulk price update
   */
  async bulkPriceUpdate(
    vehicleIds: string[],
    adjustment: { type: 'fixed' | 'percentage'; value: number },
    tenantId: string,
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: [],
      vehicleIds: [],
    };

    // Get current vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: {
        id: { in: vehicleIds },
        tenantId,
      },
    });

    for (const vehicle of vehicles) {
      try {
        const oldPrice = vehicle.price;
        let newPrice: number;

        if (adjustment.type === 'percentage') {
          newPrice = Math.round(oldPrice * (1 + adjustment.value / 100));
        } else {
          newPrice = oldPrice + adjustment.value;
        }

        // Ensure price is positive
        newPrice = Math.max(0, newPrice);

        // Update price
        const updated = await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            price: newPrice,
            updatedAt: new Date(),
            updatedBy: userId,
          },
        });

        // Record price change in version history
        await versionHistoryService.recordPriceChange(
          vehicle.id,
          tenantId,
          oldPrice,
          newPrice,
          updated,
          userId,
          userName,
          reason
        );

        result.processedCount++;
        result.vehicleIds.push(vehicle.id);

        // Emit real-time event
        realTimeSyncService.emitPriceChanged(
          tenantId,
          vehicle.id,
          oldPrice,
          newPrice,
          userId,
          userName
        );
      } catch (error: any) {
        result.failedCount++;
        result.errors.push({
          vehicleId: vehicle.id,
          error: error.message || 'Price update failed',
        });
      }
    }

    result.success = result.failedCount === 0;
    return result;
  }
}

export const bulkOperationsService = new BulkOperationsService();
