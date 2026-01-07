import { SystemHealthService } from '../system-health.service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        $queryRaw: jest.fn(),
        vehicle: { count: jest.fn() },
        lead: { count: jest.fn() },
        aimeowAccount: { findMany: jest.fn() },
        globalSetting: { count: jest.fn() }
    }
}));

describe('SystemHealthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('checkIntegrity returns detailed health report', async () => {
        // Setup healthy state mocks
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([1]);
        (prisma.vehicle.count as jest.Mock).mockResolvedValue(0);
        (prisma.lead.count as jest.Mock).mockResolvedValue(0);
        (prisma.globalSetting.count as jest.Mock).mockResolvedValue(5); // Healthy settings
        (prisma.aimeowAccount.findMany as jest.Mock).mockResolvedValue([
            { id: '1', phoneNumber: '628123', connectionStatus: 'connected', isActive: true, tenantId: 't1' }
        ]);

        const report = await SystemHealthService.checkIntegrity();

        expect(report).toBeDefined();
        expect(report.database.status).toBe('healthy');
        expect(report.vehicles.status).toBe('healthy');
        expect(report.leads.status).toBe('healthy');
        expect(report.whatsapp.status).toBe('healthy');
        expect(report.settings.status).toBe('healthy');
        expect(report.whatsapp.connectedAccounts).toBe(1);
    });

    test('checkIntegrity detects database failure', async () => {
        (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB Connection Failed'));

        // other mocks need to be set to avoid crashes if they run
        (prisma.vehicle.count as jest.Mock).mockResolvedValue(0);
        (prisma.lead.count as jest.Mock).mockResolvedValue(0);
        (prisma.globalSetting.count as jest.Mock).mockResolvedValue(0);
        (prisma.aimeowAccount.findMany as jest.Mock).mockResolvedValue([]);

        const report = await SystemHealthService.checkIntegrity();

        expect(report.database.status).toBe('error');
        expect(report.database.message).toContain('DB Connection Failed');
    });

    test('checkIntegrity detects vehicle integrity issues', async () => {
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([1]);

        // Mock count calls sequentially: 
        // 1. Total, 2. Drafts, 3. Missing Price, 4. Missing Photos
        (prisma.vehicle.count as jest.Mock)
            .mockResolvedValueOnce(10) // Total
            .mockResolvedValueOnce(0)  // Drafts
            .mockResolvedValueOnce(2)  // Missing Price (Warning)
            .mockResolvedValueOnce(0); // Missing Photos

        (prisma.lead.count as jest.Mock).mockResolvedValue(0);
        (prisma.globalSetting.count as jest.Mock).mockResolvedValue(1);
        (prisma.aimeowAccount.findMany as jest.Mock).mockResolvedValue([]);

        const report = await SystemHealthService.checkIntegrity();
        expect(report.vehicles.status).toBe('warning');
        expect(report.vehicles.missingPrice).toBe(2);
    });
});
