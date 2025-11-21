/**
 * Status Workflow Service
 * Epic 4: Story 4.6 - Vehicle Status Workflow Management
 *
 * Manages status transitions: Available → Booked → Sold
 * with proper validation and workflow rules
 */

import { prisma } from '@/lib/prisma';
import { Vehicle, VehicleStatus } from '@prisma/client';
import { versionHistoryService } from './version-history.service';
import { realTimeSyncService } from './real-time-sync.service';

export interface StatusTransition {
  vehicleId: string;
  fromStatus: VehicleStatus;
  toStatus: VehicleStatus;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface StatusWorkflowRules {
  allowedTransitions: Map<VehicleStatus, VehicleStatus[]>;
  requiresApproval: Set<string>; // transition keys like "AVAILABLE->SOLD"
}

export class StatusWorkflowService {
  private workflowRules: StatusWorkflowRules;

  constructor() {
    this.workflowRules = this.initializeWorkflowRules();
  }

  /**
   * Change vehicle status with workflow validation
   */
  async changeStatus(
    vehicleId: string,
    newStatus: VehicleStatus,
    tenantId: string,
    userId: string,
    userName?: string,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<{
    success: boolean;
    vehicle?: Vehicle;
    error?: string;
  }> {
    try {
      // Get current vehicle
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          tenantId,
        },
      });

      if (!vehicle) {
        return {
          success: false,
          error: 'Vehicle not found',
        };
      }

      // Validate transition
      const validation = this.validateTransition(vehicle.status, newStatus);

      if (!validation.allowed) {
        return {
          success: false,
          error: validation.reason || 'Invalid status transition',
        };
      }

      const oldStatus = vehicle.status;

      // Execute pre-transition hooks
      await this.executePreTransitionHooks(vehicle, newStatus, metadata);

      // Update status
      const updated = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
          updatedBy: userId,
          // Set publishedAt when moving to AVAILABLE
          ...(newStatus === 'AVAILABLE' && !vehicle.publishedAt
            ? { publishedAt: new Date() }
            : {}),
        },
      });

      // Record version history
      await versionHistoryService.recordStatusChange(
        vehicleId,
        tenantId,
        oldStatus,
        newStatus,
        updated,
        userId,
        userName,
        reason
      );

      // Execute post-transition hooks
      await this.executePostTransitionHooks(updated, oldStatus, newStatus, metadata);

      // Emit real-time event
      realTimeSyncService.emitStatusChanged(
        tenantId,
        vehicleId,
        oldStatus,
        newStatus,
        userId,
        userName
      );

      return {
        success: true,
        vehicle: updated,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Status change failed',
      };
    }
  }

  /**
   * Mark vehicle as booked
   */
  async markAsBooked(
    vehicleId: string,
    tenantId: string,
    userId: string,
    userName?: string,
    bookingInfo?: {
      customerName?: string;
      customerContact?: string;
      bookingDate?: Date;
      expectedPurchaseDate?: Date;
      notes?: string;
    }
  ): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
    return this.changeStatus(
      vehicleId,
      'BOOKED',
      tenantId,
      userId,
      userName,
      'Vehicle marked as booked',
      { bookingInfo }
    );
  }

  /**
   * Mark vehicle as sold
   */
  async markAsSold(
    vehicleId: string,
    tenantId: string,
    userId: string,
    userName?: string,
    saleInfo?: {
      soldPrice?: number;
      soldDate?: Date;
      customerName?: string;
      customerContact?: string;
      paymentMethod?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
    return this.changeStatus(
      vehicleId,
      'SOLD',
      tenantId,
      userId,
      userName,
      'Vehicle marked as sold',
      { saleInfo }
    );
  }

  /**
   * Mark vehicle as available (from booked/draft)
   */
  async markAsAvailable(
    vehicleId: string,
    tenantId: string,
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
    return this.changeStatus(
      vehicleId,
      'AVAILABLE',
      tenantId,
      userId,
      userName,
      reason || 'Vehicle marked as available'
    );
  }

  /**
   * Cancel booking and restore to available
   */
  async cancelBooking(
    vehicleId: string,
    tenantId: string,
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
    return this.changeStatus(
      vehicleId,
      'AVAILABLE',
      tenantId,
      userId,
      userName,
      reason || 'Booking cancelled'
    );
  }

  /**
   * Get allowed status transitions for a vehicle
   */
  getAllowedTransitions(currentStatus: VehicleStatus): VehicleStatus[] {
    return this.workflowRules.allowedTransitions.get(currentStatus) || [];
  }

  /**
   * Check if a transition is allowed
   */
  canTransition(fromStatus: VehicleStatus, toStatus: VehicleStatus): boolean {
    const allowed = this.workflowRules.allowedTransitions.get(fromStatus) || [];
    return allowed.includes(toStatus);
  }

  /**
   * Get vehicles by status with counts
   */
  async getStatusCounts(tenantId: string): Promise<Record<string, number>> {
    const counts = await prisma.vehicle.groupBy({
      by: ['status'],
      where: {
        tenantId,
      },
      _count: {
        id: true,
      },
    });

    const result: Record<string, number> = {};
    counts.forEach((item) => {
      result[item.status] = item._count.id;
    });

    return result;
  }

  /**
   * Get status transition history for a vehicle
   */
  async getTransitionHistory(vehicleId: string): Promise<VehicleHistory[]> {
    return versionHistoryService.getHistory(vehicleId, {
      action: 'STATUS_CHANGE',
    });
  }

  /**
   * Get vehicles that have been in a status for too long
   */
  async getStaledVehicles(
    tenantId: string,
    status: VehicleStatus,
    daysThreshold: number
  ): Promise<Vehicle[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    return prisma.vehicle.findMany({
      where: {
        tenantId,
        status,
        updatedAt: {
          lte: thresholdDate,
        },
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Initialize workflow rules
   */
  private initializeWorkflowRules(): StatusWorkflowRules {
    const allowedTransitions = new Map<VehicleStatus, VehicleStatus[]>();

    // Define allowed transitions
    allowedTransitions.set('DRAFT', ['AVAILABLE']);
    allowedTransitions.set('AVAILABLE', ['BOOKED', 'SOLD', 'DRAFT']);
    allowedTransitions.set('BOOKED', ['AVAILABLE', 'SOLD']);
    allowedTransitions.set('SOLD', []); // Sold is final, cannot transition
    allowedTransitions.set('DELETED', []); // Deleted is final

    // Transitions that require approval
    const requiresApproval = new Set<string>([
      'BOOKED->SOLD', // May require approval
    ]);

    return {
      allowedTransitions,
      requiresApproval,
    };
  }

  /**
   * Validate status transition
   */
  private validateTransition(
    fromStatus: VehicleStatus,
    toStatus: VehicleStatus
  ): {
    allowed: boolean;
    reason?: string;
  } {
    // Same status is no-op
    if (fromStatus === toStatus) {
      return {
        allowed: false,
        reason: 'Vehicle is already in this status',
      };
    }

    // Check if transition is allowed
    const allowedStatuses = this.workflowRules.allowedTransitions.get(fromStatus) || [];

    if (!allowedStatuses.includes(toStatus)) {
      return {
        allowed: false,
        reason: `Cannot transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${allowedStatuses.join(', ')}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Execute hooks before status transition
   */
  private async executePreTransitionHooks(
    vehicle: Vehicle,
    newStatus: VehicleStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Add business logic before transition
    // For example: validate booking info when marking as booked

    if (newStatus === 'BOOKED' && metadata?.bookingInfo) {
      // Could validate booking info here
      // Could send notification to customer
    }

    if (newStatus === 'SOLD' && metadata?.saleInfo) {
      // Could validate sale info
      // Could trigger invoice generation
    }
  }

  /**
   * Execute hooks after status transition
   */
  private async executePostTransitionHooks(
    vehicle: Vehicle,
    oldStatus: VehicleStatus,
    newStatus: VehicleStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Add business logic after transition

    // When marking as sold, could:
    // - Archive vehicle
    // - Update inventory counts
    // - Send congratulations to sales team
    // - Trigger analytics event

    if (newStatus === 'SOLD') {
      // Could create audit log entry
      await prisma.auditLog.create({
        data: {
          tenantId: vehicle.tenantId,
          userId: vehicle.updatedBy || vehicle.createdBy,
          action: 'VEHICLE_SOLD',
          entityType: 'vehicle',
          entityId: vehicle.id,
          changes: {
            oldStatus,
            newStatus,
            soldPrice: metadata?.saleInfo?.soldPrice,
            soldDate: metadata?.saleInfo?.soldDate,
          },
        },
      });
    }

    // When marking as available, could:
    // - Publish to website
    // - Notify interested customers
    // - Trigger SEO indexing

    if (newStatus === 'AVAILABLE' && oldStatus === 'DRAFT') {
      // Vehicle is newly published
      console.log(`[StatusWorkflow] Vehicle ${vehicle.id} published`);
    }
  }
}

export const statusWorkflowService = new StatusWorkflowService();
