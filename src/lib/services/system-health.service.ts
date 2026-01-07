import { PrismaClient, VehicleStatus, LeadStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface SystemHealthReport {
    database: {
        status: 'healthy' | 'degraded' | 'error';
        latencyMs: number;
        message?: string;
    };
    vehicles: {
        status: 'healthy' | 'warning' | 'error';
        total: number;
        drafts: number;
        missingPrice: number; // Critical
        missingPhotos: number;
        integrityScore: number; // 0-100
    };
    leads: {
        status: 'healthy' | 'warning' | 'error';
        total: number;
        newLeads: number;
        stuckLeads: number; // Leads in 'NEW' for > 7 days
    };
    whatsapp: {
        status: 'healthy' | 'disconnected' | 'error';
        connectedAccounts: number;
        totalAccounts: number;
        details: any[];
    };
    settings: {
        status: 'healthy' | 'warning' | 'error';
        count: number;
    };
    system: {
        timestamp: Date;
        environment: string;
    };
}

export class SystemHealthService {
    /**
     * Perform a full system integrity check
     */
    static async checkIntegrity(): Promise<SystemHealthReport> {
        const start = Date.now();

        // 1. Database Check
        let dbStatus: 'healthy' | 'degraded' | 'error' = 'healthy';
        let dbMessage = 'Connected';
        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch (error) {
            dbStatus = 'error';
            dbMessage = error instanceof Error ? error.message : 'Unknown DB Error';
        }
        const dbLatency = Date.now() - start;

        // 2. Vehicle Integrity
        const vehiclesTotal = await prisma.vehicle.count();
        const vehiclesDraft = await prisma.vehicle.count({ where: { status: 'DRAFT' } });

        // Critical: Published vehicles with 0 price (BigInt handling needed)
        // Prisma BigInt needs special handling usually, but for count we can query logic
        // We'll fetch a sample or just count those seemingly invalid
        // Note: Can't easily count BigInt comparisons in standard prisma count without raw, 
        // but we can check logic. For now, let's assume price > 0 is mandatory for AVAILABLE

        // We'll define "missing price" as price = 0
        // Querying BigInt(0)
        const vehiclesMissingPrice = await prisma.vehicle.count({
            where: {
                price: 0,
                status: { not: 'DRAFT' } // Only care if not draft
            }
        });

        const vehiclesMissingPhotos = await prisma.vehicle.count({
            where: {
                photos: { none: {} },
                status: { not: 'DRAFT' }
            }
        });

        let vehicleStatus: 'healthy' | 'warning' | 'error' = 'healthy';
        if (vehiclesMissingPrice > 0 || vehiclesMissingPhotos > 0) vehicleStatus = 'warning';

        // 3. Leads Health
        const leadsTotal = await prisma.lead.count();
        const leadsNew = await prisma.lead.count({ where: { status: 'NEW' } });

        // "Stuck" leads: NEW status for more than 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const leadsStuck = await prisma.lead.count({
            where: {
                status: 'NEW',
                createdAt: { lt: sevenDaysAgo }
            }
        });

        let leadStatus: 'healthy' | 'warning' | 'error' = 'healthy';
        if (leadsStuck > 50) leadStatus = 'warning'; // Arbitrary threshold

        // 4. WhatsApp AI Health
        const accounts = await prisma.aimeowAccount.findMany({
            select: {
                id: true,
                phoneNumber: true,
                connectionStatus: true,
                isActive: true,
                tenantId: true
            }
        });

        const connectedCount = accounts.filter(a => a.connectionStatus === 'connected').length;
        let whatsappStatus: 'healthy' | 'disconnected' | 'error' = 'healthy';

        if (accounts.length > 0 && connectedCount === 0) {
            whatsappStatus = 'disconnected';
        }


        // 5. Settings Health
        const settingsCount = await prisma.globalSetting.count();
        // We expect at least some settings to exist in a production system
        const settingsStatus: 'healthy' | 'warning' = settingsCount > 0 ? 'healthy' : 'warning';

        return {
            database: {
                status: dbStatus,
                latencyMs: dbLatency,
                message: dbMessage
            },
            vehicles: {
                status: vehicleStatus,
                total: vehiclesTotal,
                drafts: vehiclesDraft,
                missingPrice: vehiclesMissingPrice,
                missingPhotos: vehiclesMissingPhotos,
                integrityScore: Math.max(0, 100 - (vehiclesMissingPrice * 5) - (vehiclesMissingPhotos * 2))
            },
            leads: {
                status: leadStatus,
                total: leadsTotal,
                newLeads: leadsNew,
                stuckLeads: leadsStuck
            },
            whatsapp: {
                status: whatsappStatus,
                connectedAccounts: connectedCount,
                totalAccounts: accounts.length,
                details: accounts.map(a => ({ phone: a.phoneNumber, status: a.connectionStatus }))
            },
            settings: {
                status: settingsStatus,
                count: settingsCount
            },
            system: {
                timestamp: new Date(),
                environment: process.env.NODE_ENV || 'development'
            }
        };
    }
}
