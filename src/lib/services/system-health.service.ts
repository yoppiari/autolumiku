/**
 * AI 5.0 System Health Service
 * "Central Nervous System" for AutoLumiku Platform
 * Monitors, Analyzes, and Self-Heals system components
 */

import { prisma } from '@/lib/prisma';
import { AIHealthMonitorService } from './whatsapp-ai/ai-health-monitor.service';
import { LeadStatus } from '@prisma/client';

export type ModuleStatus = 'healthy' | 'degraded' | 'error' | 'maintenance';

export interface SystemHealthReport {
    overallStatus: ModuleStatus;
    checkedAt: Date;
    modules: {
        dashboard: ModuleHealth;
        vehicles: ModuleHealth;
        leads: ModuleHealth;
        whatsapp_ai: ModuleHealth;
        team: ModuleHealth;
        settings: ModuleHealth;
    };
    actionsTaken: string[]; // Self-healing actions performed
}

export interface ModuleHealth {
    status: ModuleStatus;
    message: string;
    details?: any;
    lastHealedAt?: Date;
}

export class SystemHealthService {
    /**
     * Run full system diagnostic and attempt self-healing
     */
    static async runDiagnostic(tenantId: string): Promise<SystemHealthReport> {
        const actionsTaken: string[] = [];

        // Parallel Execution of Diagnostics
        const [
            dashboardHealth,
            vehiclesHealth,
            leadsHealth,
            aiHealthResult,
            settingsHealth
        ] = await Promise.all([
            this.checkDashboardHealth(),
            this.checkVehiclesHealth(tenantId, actionsTaken),
            this.checkLeadsHealth(tenantId, actionsTaken),
            AIHealthMonitorService.getHealthState(tenantId),
            this.checkSettingsHealth(tenantId, actionsTaken)
        ]);

        // Map AI Health to ModuleHealth format
        const aiHealth: ModuleHealth = {
            status: aiHealthResult ? (aiHealthResult.status === 'active' ? 'healthy' : (aiHealthResult.status === 'disabled' ? 'error' : 'degraded')) : 'error',
            message: aiHealthResult ? `AI Status: ${aiHealthResult.status}` : 'AI Config Not Found',
            details: aiHealthResult
        };

        // Determine Overall Status
        const allStatuses = [dashboardHealth.status, vehiclesHealth.status, leadsHealth.status, aiHealth.status, settingsHealth.status];
        let overallStatus: ModuleStatus = 'healthy';
        if (allStatuses.includes('error')) overallStatus = 'error';
        else if (allStatuses.includes('degraded')) overallStatus = 'degraded';

        return {
            overallStatus,
            checkedAt: new Date(),
            modules: {
                dashboard: dashboardHealth,
                vehicles: vehiclesHealth,
                leads: leadsHealth,
                whatsapp_ai: aiHealth,
                team: { status: 'healthy', message: 'Team Module Active' }, // Placeholder for now
                settings: settingsHealth
            },
            actionsTaken
        };
    }

    /**
     * 1. Dashboard / Database Health
     * Checks basic database connectivity
     */
    private static async checkDashboardHealth(): Promise<ModuleHealth> {
        try {
            const start = Date.now();
            await prisma.$queryRaw`SELECT 1`; // Simple ping
            const latency = Date.now() - start;

            return {
                status: latency < 1000 ? 'healthy' : 'degraded',
                message: `Database connected (Latency: ${latency}ms)`,
                details: { latency }
            };
        } catch (error: any) {
            return {
                status: 'error',
                message: 'Database Connection Failed',
                details: { error: error.message }
            };
        }
    }

    /**
     * 2. Vehicle Integrity Check
     * Checks for data anomalies (e.g. missing price, invalid status)
     */
    private static async checkVehiclesHealth(tenantId: string, actions: string[]): Promise<ModuleHealth> {
        try {
            const invalidVehicles = await prisma.vehicle.count({
                where: {
                    tenantId,
                    status: 'AVAILABLE',
                    OR: [
                        { price: { equals: 0 } }, // Price missing
                        { price: { equals: null as any } } // Handling improper nulls if any
                    ]
                }
            });

            if (invalidVehicles > 0) {
                // [SELF-HEALING] Flag them as DRAFT to prevent frontend issues
                // We log this mainly; usually we don't auto-publish. Here we auto-unpublish bad data.
                await prisma.vehicle.updateMany({
                    where: {
                        tenantId,
                        status: 'AVAILABLE',
                        price: { equals: 0 }
                    },
                    data: { status: 'DRAFT' }
                });

                const actionMsg = `Auto-corrected ${invalidVehicles} vehicles with 0 price to DRAFT status.`;
                actions.push(actionMsg);

                return {
                    status: 'degraded', // Was degraded, now fixed but worth reporting
                    message: actionMsg,
                    details: { invalidCount: invalidVehicles }
                };
            }

            return { status: 'healthy', message: 'Vehicle Inventory Integrity Verified' };
        } catch (error: any) {
            console.error("[SystemHealth] Vehicle check failed:", error);
            return { status: 'degraded', message: 'Vehicle Integrity Check Failed' };
        }
    }

    /**
     * 3. Leads Standardization Check
     * Ensures no leads have invalid/legacy statuses
     */
    private static async checkLeadsHealth(tenantId: string, actions: string[]): Promise<ModuleHealth> {
        try {
            // Prisma enforces Enum at typo level, but let's check for 'logical' issues
            // e.g. Stalled leads (New for > 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const stalledLeadsCount = await prisma.lead.count({
                where: {
                    tenantId,
                    status: 'NEW',
                    createdAt: { lt: sevenDaysAgo }
                }
            });

            if (stalledLeadsCount > 0) {
                return {
                    status: 'degraded',
                    message: `${stalledLeadsCount} Leads stuck in NEW status for > 7 days`,
                    details: { stalledCount: stalledLeadsCount }
                };
            }

            return { status: 'healthy', message: 'Lead Pipeline Flowing Normal' };
        } catch (error) {
            return { status: 'error', message: 'Lead Check Failed' };
        }
    }

    /**
     * 5. Settings / Config Health [SELF-HEALING]
     * Ensures critical keys exist
     */
    private static async checkSettingsHealth(tenantId: string, actions: string[]): Promise<ModuleHealth> {
        try {
            const requiredKeys = ['site_title', 'currency', 'language_default'];
            const missingKeys: string[] = [];

            // Check each
            for (const key of requiredKeys) {
                const exists = await prisma.globalSetting.findFirst({
                    where: { key, tenantId }
                });
                if (!exists) missingKeys.push(key);
            }

            if (missingKeys.length > 0) {
                // [SELF-HEALING] Create default for missing settings
                for (const key of missingKeys) {
                    let defaultVal: any = "AutoLumiku";
                    if (key === 'currency') defaultVal = "IDR";
                    if (key === 'language_default') defaultVal = "id";

                    await prisma.globalSetting.create({
                        data: {
                            key,
                            value: defaultVal,
                            category: 'platform',
                            dataType: 'string',
                            tenantId: tenantId
                        }
                    });
                }
                const msg = `Restored missing settings: ${missingKeys.join(', ')}`;
                actions.push(msg);

                return {
                    status: 'healthy', // Considered healthy after healing
                    message: msg,
                    lastHealedAt: new Date()
                };
            }

            return { status: 'healthy', message: 'Configuration Valid' };

        } catch (error) {
            return { status: 'error', message: 'Settings Integrity Check Failed' };
        }
    }
}
