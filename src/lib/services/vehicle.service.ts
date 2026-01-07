
import { prisma } from '@/lib/prisma';

export class VehicleService {
    /**
     * Resequence vehicle display IDs for ACTIVE vehicles only
     * This excludes DELETED vehicles so IDs can be reused
     * Use case: After deleting test vehicles, renumber actual vehicles starting from 001
     */
    static async resequenceVehicleIds(tenantId: string, tenantSlug: string) {
        const results: any = {
            timestamp: new Date().toISOString(),
            tenant: tenantSlug,
            tenantId: tenantId,
            updates: [],
        };

        try {
            // Determine tenant code
            let tenantCode = 'XX';
            if (tenantSlug.includes('primamobil')) {
                tenantCode = 'PM';
            } else {
                tenantCode = tenantSlug.substring(0, 2).toUpperCase();
            }
            results.tenantCode = tenantCode;

            const showroomCode = 'PST';
            const prefix = `${tenantCode}-${showroomCode}-`;

            // Step 1: Clear displayId from DELETED vehicles to avoid conflicts
            const deletedUpdate = await prisma.vehicle.updateMany({
                where: {
                    tenantId: tenantId,
                    status: 'DELETED',
                    displayId: { not: null },
                },
                data: { displayId: null },
            });
            results.deletedCleared = deletedUpdate.count;

            // Step 2: Get all ACTIVE vehicles (non-DELETED) ordered by createdAt
            const vehicles = await prisma.vehicle.findMany({
                where: {
                    tenantId: tenantId,
                    status: { not: 'DELETED' },
                },
                orderBy: { createdAt: 'asc' },
                select: { id: true, displayId: true, make: true, model: true, createdAt: true },
            });

            results.activeVehiclesFound = vehicles.length;

            if (vehicles.length === 0) {
                results.message = 'No active vehicles found to resequence.';
                results.success = true;
                return results;
            }

            // Step 3: First pass - set all to temporary IDs to avoid conflicts
            const tempPrefix = `TEMP-${Date.now()}-`;
            for (let i = 0; i < vehicles.length; i++) {
                await prisma.vehicle.update({
                    where: { id: vehicles[i].id },
                    data: { displayId: `${tempPrefix}${i}` },
                });
            }

            // Step 4: Second pass - set final sequential IDs
            let sequence = 1;
            for (const vehicle of vehicles) {
                const newDisplayId = `${prefix}${String(sequence).padStart(3, '0')}`;

                await prisma.vehicle.update({
                    where: { id: vehicle.id },
                    data: { displayId: newDisplayId },
                });

                results.updates.push({
                    vehicle: `${vehicle.make} ${vehicle.model}`,
                    oldId: vehicle.displayId,
                    newId: newDisplayId,
                });

                sequence++;
            }

            results.success = true;
            results.message = `Resequenced ${results.updates.length} vehicle IDs. Active vehicles now numbered from ${prefix}001 to ${prefix}${String(vehicles.length).padStart(3, '0')}`;

        } catch (err: any) {
            console.error('[VehicleService] Resequence error:', err);
            results.success = false;
            results.error = err.message;
        }

        return results;
    }
}
