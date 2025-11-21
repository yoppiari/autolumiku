/**
 * Real-Time Sync Service
 * Epic 4: Story 4.1 & 4.2 - Real-Time Inventory Status Updates
 *
 * Manages real-time synchronization of vehicle inventory changes
 * across all connected clients using Server-Sent Events (SSE)
 */

import { EventEmitter } from 'events';

export type InventoryEventType =
  | 'VEHICLE_CREATED'
  | 'VEHICLE_UPDATED'
  | 'VEHICLE_DELETED'
  | 'STATUS_CHANGED'
  | 'PRICE_CHANGED'
  | 'PHOTOS_UPDATED'
  | 'BULK_UPDATE';

export interface InventoryEvent {
  type: InventoryEventType;
  tenantId: string;
  vehicleId: string;
  vehicleIds?: string[]; // For bulk operations
  data: any;
  timestamp: Date;
  userId: string;
  userName?: string;
}

export interface SSEClient {
  id: string;
  tenantId: string;
  userId: string;
  response: any; // Response object for SSE
  lastEventId?: number;
  connectedAt: Date;
}

export class RealTimeSyncService {
  private eventEmitter: EventEmitter;
  private clients: Map<string, SSEClient>; // clientId -> SSEClient
  private tenantClients: Map<string, Set<string>>; // tenantId -> Set of clientIds
  private eventCounter: number = 0;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.clients = new Map();
    this.tenantClients = new Map();
  }

  /**
   * Register a new SSE client connection
   */
  registerClient(
    clientId: string,
    tenantId: string,
    userId: string,
    response: any
  ): void {
    const client: SSEClient = {
      id: clientId,
      tenantId,
      userId,
      response,
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);

    // Add to tenant's client list
    if (!this.tenantClients.has(tenantId)) {
      this.tenantClients.set(tenantId, new Set());
    }
    this.tenantClients.get(tenantId)!.add(clientId);

    // Send initial connection message
    this.sendToClient(clientId, {
      type: 'CONNECTED',
      message: 'Real-time sync connected',
      timestamp: new Date(),
    });

    console.log(`[RealTimeSync] Client ${clientId} connected for tenant ${tenantId}`);
  }

  /**
   * Unregister a client connection
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from tenant's client list
    const tenantClientSet = this.tenantClients.get(client.tenantId);
    if (tenantClientSet) {
      tenantClientSet.delete(clientId);
      if (tenantClientSet.size === 0) {
        this.tenantClients.delete(client.tenantId);
      }
    }

    this.clients.delete(clientId);
    console.log(`[RealTimeSync] Client ${clientId} disconnected`);
  }

  /**
   * Broadcast inventory event to all clients of a tenant
   */
  broadcastToTenant(tenantId: string, event: InventoryEvent): void {
    const clientIds = this.tenantClients.get(tenantId);
    if (!clientIds || clientIds.size === 0) {
      return; // No clients connected for this tenant
    }

    const eventId = ++this.eventCounter;
    const eventData = {
      id: eventId,
      ...event,
    };

    clientIds.forEach((clientId) => {
      this.sendToClient(clientId, eventData);
    });

    console.log(
      `[RealTimeSync] Broadcasted ${event.type} to ${clientIds.size} clients for tenant ${tenantId}`
    );
  }

  /**
   * Emit vehicle created event
   */
  emitVehicleCreated(
    tenantId: string,
    vehicleId: string,
    vehicleData: any,
    userId: string,
    userName?: string
  ): void {
    const event: InventoryEvent = {
      type: 'VEHICLE_CREATED',
      tenantId,
      vehicleId,
      data: vehicleData,
      timestamp: new Date(),
      userId,
      userName,
    };

    this.broadcastToTenant(tenantId, event);
    this.eventEmitter.emit('vehicle:created', event);
  }

  /**
   * Emit vehicle updated event
   */
  emitVehicleUpdated(
    tenantId: string,
    vehicleId: string,
    changes: any,
    userId: string,
    userName?: string
  ): void {
    const event: InventoryEvent = {
      type: 'VEHICLE_UPDATED',
      tenantId,
      vehicleId,
      data: changes,
      timestamp: new Date(),
      userId,
      userName,
    };

    this.broadcastToTenant(tenantId, event);
    this.eventEmitter.emit('vehicle:updated', event);
  }

  /**
   * Emit vehicle deleted event
   */
  emitVehicleDeleted(
    tenantId: string,
    vehicleId: string,
    userId: string,
    userName?: string
  ): void {
    const event: InventoryEvent = {
      type: 'VEHICLE_DELETED',
      tenantId,
      vehicleId,
      data: { vehicleId },
      timestamp: new Date(),
      userId,
      userName,
    };

    this.broadcastToTenant(tenantId, event);
    this.eventEmitter.emit('vehicle:deleted', event);
  }

  /**
   * Emit status changed event
   */
  emitStatusChanged(
    tenantId: string,
    vehicleId: string,
    oldStatus: string,
    newStatus: string,
    userId: string,
    userName?: string
  ): void {
    const event: InventoryEvent = {
      type: 'STATUS_CHANGED',
      tenantId,
      vehicleId,
      data: {
        vehicleId,
        oldStatus,
        newStatus,
      },
      timestamp: new Date(),
      userId,
      userName,
    };

    this.broadcastToTenant(tenantId, event);
    this.eventEmitter.emit('vehicle:status-changed', event);
  }

  /**
   * Emit price changed event
   */
  emitPriceChanged(
    tenantId: string,
    vehicleId: string,
    oldPrice: number,
    newPrice: number,
    userId: string,
    userName?: string
  ): void {
    const event: InventoryEvent = {
      type: 'PRICE_CHANGED',
      tenantId,
      vehicleId,
      data: {
        vehicleId,
        oldPrice,
        newPrice,
      },
      timestamp: new Date(),
      userId,
      userName,
    };

    this.broadcastToTenant(tenantId, event);
    this.eventEmitter.emit('vehicle:price-changed', event);
  }

  /**
   * Emit bulk update event
   */
  emitBulkUpdate(
    tenantId: string,
    vehicleIds: string[],
    operation: string,
    userId: string,
    userName?: string
  ): void {
    const event: InventoryEvent = {
      type: 'BULK_UPDATE',
      tenantId,
      vehicleId: vehicleIds[0] || '', // First ID for compatibility
      vehicleIds,
      data: {
        operation,
        count: vehicleIds.length,
        vehicleIds,
      },
      timestamp: new Date(),
      userId,
      userName,
    };

    this.broadcastToTenant(tenantId, event);
    this.eventEmitter.emit('vehicle:bulk-update', event);
  }

  /**
   * Subscribe to inventory events
   */
  on(event: string, listener: (event: InventoryEvent) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Unsubscribe from inventory events
   */
  off(event: string, listener: (event: InventoryEvent) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(tenantId?: string): number {
    if (tenantId) {
      return this.tenantClients.get(tenantId)?.size || 0;
    }
    return this.clients.size;
  }

  /**
   * Get connection stats
   */
  getConnectionStats(): {
    totalClients: number;
    tenants: number;
    clientsByTenant: Record<string, number>;
  } {
    const clientsByTenant: Record<string, number> = {};

    this.tenantClients.forEach((clients, tenantId) => {
      clientsByTenant[tenantId] = clients.size;
    });

    return {
      totalClients: this.clients.size,
      tenants: this.tenantClients.size,
      clientsByTenant,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Send event to specific client
   */
  private sendToClient(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.response) {
      return;
    }

    try {
      // Send as Server-Sent Event format
      client.response.write(`id: ${data.id || Date.now()}\n`);
      client.response.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error(`[RealTimeSync] Error sending to client ${clientId}:`, error);
      // Remove dead connection
      this.unregisterClient(clientId);
    }
  }
}

// Singleton instance
export const realTimeSyncService = new RealTimeSyncService();
