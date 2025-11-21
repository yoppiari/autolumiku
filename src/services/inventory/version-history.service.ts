/**
 * Version History Service
 * Epic 4: Story 4.3 - Version History and Audit Trail
 *
 * Tracks all changes to vehicle data with full snapshots and diff tracking
 */

import { prisma } from '@/lib/prisma';
import { Vehicle, VehicleHistory } from '@prisma/client';

export interface VersionHistoryEntry {
  id: string;
  version: number;
  action: string;
  changedFields: string[];
  previousValues: Record<string, any>;
  newValues: Record<string, any>;
  changedBy: string;
  changedByName?: string;
  changeReason?: string;
  createdAt: Date;
  snapshot: any;
}

export interface VehicleWithHistory extends Vehicle {
  history: VehicleHistory[];
}

export class VersionHistoryService {
  /**
   * Create version history entry when vehicle is created
   */
  async recordCreate(
    vehicleId: string,
    tenantId: string,
    vehicleData: any,
    userId: string,
    userName?: string
  ): Promise<VehicleHistory> {
    const version = await this.getNextVersion(vehicleId);

    return prisma.vehicleHistory.create({
      data: {
        vehicleId,
        tenantId,
        version,
        action: 'CREATE',
        snapshot: vehicleData,
        changedFields: Object.keys(vehicleData),
        previousValues: null,
        newValues: vehicleData,
        changedBy: userId,
        changedByName: userName,
        changeReason: 'Vehicle created',
      },
    });
  }

  /**
   * Create version history entry when vehicle is updated
   */
  async recordUpdate(
    vehicleId: string,
    tenantId: string,
    previousData: any,
    newData: any,
    userId: string,
    userName?: string,
    changeReason?: string
  ): Promise<VehicleHistory> {
    const version = await this.getNextVersion(vehicleId);
    const changes = this.detectChanges(previousData, newData);

    return prisma.vehicleHistory.create({
      data: {
        vehicleId,
        tenantId,
        version,
        action: 'UPDATE',
        snapshot: newData,
        changedFields: changes.changedFields,
        previousValues: changes.previousValues,
        newValues: changes.newValues,
        changedBy: userId,
        changedByName: userName,
        changeReason,
      },
    });
  }

  /**
   * Create version history entry for status changes
   */
  async recordStatusChange(
    vehicleId: string,
    tenantId: string,
    previousStatus: string,
    newStatus: string,
    vehicleSnapshot: any,
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<VehicleHistory> {
    const version = await this.getNextVersion(vehicleId);

    return prisma.vehicleHistory.create({
      data: {
        vehicleId,
        tenantId,
        version,
        action: 'STATUS_CHANGE',
        snapshot: vehicleSnapshot,
        changedFields: ['status'],
        previousValues: { status: previousStatus },
        newValues: { status: newStatus },
        changedBy: userId,
        changedByName: userName,
        changeReason: reason || `Status changed from ${previousStatus} to ${newStatus}`,
      },
    });
  }

  /**
   * Create version history entry for price changes
   */
  async recordPriceChange(
    vehicleId: string,
    tenantId: string,
    previousPrice: number,
    newPrice: number,
    vehicleSnapshot: any,
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<VehicleHistory> {
    const version = await this.getNextVersion(vehicleId);

    return prisma.vehicleHistory.create({
      data: {
        vehicleId,
        tenantId,
        version,
        action: 'PRICE_CHANGE',
        snapshot: vehicleSnapshot,
        changedFields: ['price'],
        previousValues: { price: previousPrice },
        newValues: { price: newPrice },
        changedBy: userId,
        changedByName: userName,
        changeReason: reason || `Price changed from Rp ${previousPrice.toLocaleString()} to Rp ${newPrice.toLocaleString()}`,
      },
    });
  }

  /**
   * Get version history for a vehicle
   */
  async getHistory(
    vehicleId: string,
    options?: {
      limit?: number;
      offset?: number;
      action?: string;
    }
  ): Promise<VehicleHistory[]> {
    const where: any = { vehicleId };

    if (options?.action) {
      where.action = options.action;
    }

    return prisma.vehicleHistory.findMany({
      where,
      orderBy: {
        version: 'desc',
      },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  /**
   * Get specific version
   */
  async getVersion(vehicleId: string, version: number): Promise<VehicleHistory | null> {
    return prisma.vehicleHistory.findFirst({
      where: {
        vehicleId,
        version,
      },
    });
  }

  /**
   * Get latest version number
   */
  async getLatestVersion(vehicleId: string): Promise<number> {
    const latest = await prisma.vehicleHistory.findFirst({
      where: { vehicleId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return latest?.version || 0;
  }

  /**
   * Restore vehicle to a specific version
   */
  async restoreToVersion(
    vehicleId: string,
    version: number,
    userId: string,
    userName?: string
  ): Promise<Vehicle> {
    // Get the version to restore
    const historyEntry = await this.getVersion(vehicleId, version);

    if (!historyEntry) {
      throw new Error(`Version ${version} not found for vehicle ${vehicleId}`);
    }

    // Get current vehicle data for comparison
    const currentVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!currentVehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    // Restore the snapshot data
    const snapshotData = historyEntry.snapshot as any;

    // Update vehicle with snapshot data
    const restored = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...snapshotData,
        updatedAt: new Date(),
        updatedBy: userId,
      },
    });

    // Record this restore action
    await this.recordUpdate(
      vehicleId,
      currentVehicle.tenantId,
      currentVehicle,
      restored,
      userId,
      userName,
      `Restored to version ${version}`
    );

    return restored;
  }

  /**
   * Get change summary between two versions
   */
  async getChangeSummary(
    vehicleId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<{
    changedFields: string[];
    changes: Record<string, { from: any; to: any }>;
  }> {
    const [from, to] = await Promise.all([
      this.getVersion(vehicleId, fromVersion),
      this.getVersion(vehicleId, toVersion),
    ]);

    if (!from || !to) {
      throw new Error('One or both versions not found');
    }

    const fromData = from.snapshot as any;
    const toData = to.snapshot as any;

    return this.detectChanges(fromData, toData);
  }

  /**
   * Delete old history entries (cleanup)
   */
  async cleanupOldHistory(vehicleId: string, keepVersions: number = 50): Promise<number> {
    const latestVersion = await this.getLatestVersion(vehicleId);
    const cutoffVersion = latestVersion - keepVersions;

    if (cutoffVersion <= 0) {
      return 0; // Nothing to delete
    }

    const result = await prisma.vehicleHistory.deleteMany({
      where: {
        vehicleId,
        version: {
          lt: cutoffVersion,
        },
      },
    });

    return result.count;
  }

  /**
   * Get history statistics
   */
  async getHistoryStats(vehicleId: string): Promise<{
    totalVersions: number;
    firstVersion: Date;
    lastVersion: Date;
    changesByUser: Record<string, number>;
    changesByAction: Record<string, number>;
  }> {
    const history = await prisma.vehicleHistory.findMany({
      where: { vehicleId },
      select: {
        createdAt: true,
        changedBy: true,
        changedByName: true,
        action: true,
      },
      orderBy: {
        version: 'asc',
      },
    });

    const changesByUser: Record<string, number> = {};
    const changesByAction: Record<string, number> = {};

    history.forEach((entry) => {
      const userName = entry.changedByName || entry.changedBy;
      changesByUser[userName] = (changesByUser[userName] || 0) + 1;
      changesByAction[entry.action] = (changesByAction[entry.action] || 0) + 1;
    });

    return {
      totalVersions: history.length,
      firstVersion: history[0]?.createdAt || new Date(),
      lastVersion: history[history.length - 1]?.createdAt || new Date(),
      changesByUser,
      changesByAction,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Get next version number
   */
  private async getNextVersion(vehicleId: string): Promise<number> {
    const latestVersion = await this.getLatestVersion(vehicleId);
    return latestVersion + 1;
  }

  /**
   * Detect changes between two objects
   */
  private detectChanges(
    previousData: any,
    newData: any
  ): {
    changedFields: string[];
    previousValues: Record<string, any>;
    newValues: Record<string, any>;
  } {
    const changedFields: string[] = [];
    const previousValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    // Get all unique keys from both objects
    const allKeys = new Set([...Object.keys(previousData), ...Object.keys(newData)]);

    allKeys.forEach((key) => {
      // Skip metadata fields
      if (['createdAt', 'updatedAt', 'id'].includes(key)) {
        return;
      }

      const prevValue = previousData[key];
      const newValue = newData[key];

      // Deep comparison for objects/arrays
      if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
        changedFields.push(key);
        previousValues[key] = prevValue;
        newValues[key] = newValue;
      }
    });

    return {
      changedFields,
      previousValues,
      newValues,
    };
  }
}

export const versionHistoryService = new VersionHistoryService();
