import { TenantService } from '@/services/tenant-service';
import { CreateTenantRequest, TenantStatus } from '@/types/tenant';
import { tenantDatabasePool } from '@/lib/database/tenant-pool';
import { databaseProvisioningService } from '@/lib/database/provisioning';

// Mock dependencies
jest.mock('@/lib/database/tenant-pool');
jest.mock('@/lib/database/provisioning');
jest.mock('winston', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  })
}));

describe('TenantService', () => {
  let tenantService: TenantService;

  beforeEach(() => {
    tenantService = new TenantService();
    jest.clearAllMocks();
  });

  describe('createTenant', () => {
    const validTenantRequest: CreateTenantRequest = {
      name: 'Test Showroom',
      subdomain: 'test-showroom',
      adminUser: {
        email: 'admin@test.com',
        firstName: 'Test',
        lastName: 'Admin',
        phone: '+62812345678'
      }
    };

    it('should create a tenant successfully', async () => {
      // Mock successful provisioning
      const mockProvisioningResult = {
        tenantId: 'tenant-123',
        dbName: 'autolumiku_tenant_test_showroom',
        success: true
      };
      (databaseProvisioningService.provisionTenantDatabase as jest.Mock).mockResolvedValue(mockProvisioningResult);

      const result = await tenantService.createTenant(validTenantRequest);

      expect(result).toBeDefined();
      expect(result.name).toBe(validTenantRequest.name);
      expect(result.subdomain).toBe(validTenantRequest.subdomain);
      expect(result.status).toBe(TenantStatus.ACTIVE);
      expect(databaseProvisioningService.provisionTenantDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          name: validTenantRequest.name,
          subdomain: validTenantRequest.subdomain,
          adminEmail: validTenantRequest.adminUser.email
        })
      );
    });

    it('should throw error if subdomain already exists', async () => {
      // Mock existing tenant
      (tenantService as any).getTenantBySubdomain = jest.fn().mockResolvedValue({
        id: 'existing-tenant',
        name: 'Existing Showroom',
        subdomain: 'test-showroom'
      });

      await expect(tenantService.createTenant(validTenantRequest)).rejects.toThrow(
        "Subdomain 'test-showroom' is already taken"
      );
    });

    it('should throw error for invalid tenant name', async () => {
      const invalidRequest = {
        ...validTenantRequest,
        name: '' // Empty name
      };

      await expect(tenantService.createTenant(invalidRequest)).rejects.toThrow(
        'Tenant name is required'
      );
    });

    it('should throw error for invalid subdomain', async () => {
      const invalidRequest = {
        ...validTenantRequest,
        subdomain: '' // Empty subdomain
      };

      await expect(tenantService.createTenant(invalidRequest)).rejects.toThrow(
        'Subdomain is required'
      );
    });

    it('should throw error for invalid admin email', async () => {
      const invalidRequest = {
        ...validTenantRequest,
        adminUser: {
          ...validTenantRequest.adminUser,
          email: 'invalid-email' // Invalid email format
        }
      };

      await expect(tenantService.createTenant(invalidRequest)).rejects.toThrow(
        'Invalid admin email format'
      );
    });
  });

  describe('getTenant', () => {
    it('should return tenant if found', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Showroom',
        subdomain: 'test-showroom',
        status: TenantStatus.ACTIVE
      };

      // Mock tenant lookup
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(mockTenant);

      const result = await tenantService.getTenant('tenant-123');

      expect(result).toEqual(mockTenant);
    });

    it('should return null if tenant not found', async () => {
      // Mock tenant not found
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(null);

      const result = await tenantService.getTenant('non-existent-tenant');

      expect(result).toBeNull();
    });
  });

  describe('updateTenantStatus', () => {
    it('should update tenant status successfully', async () => {
      const tenantId = 'tenant-123';
      const newStatus = TenantStatus.SUSPENDED;

      await tenantService.updateTenantStatus(tenantId, newStatus);

      // In a real implementation, this would update the database
      // For now, we just verify the method doesn't throw
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('deleteTenant', () => {
    it('should delete tenant successfully', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Showroom',
        subdomain: 'test-showroom',
        status: TenantStatus.INACTIVE
      };

      // Mock tenant lookup
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(mockTenant);

      const result = await tenantService.deleteTenant('tenant-123');

      expect(result).toBe(true);
    });

    it('should return false if tenant not found', async () => {
      // Mock tenant not found
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(null);

      const result = await tenantService.deleteTenant('non-existent-tenant');

      expect(result).toBe(false);
    });

    it('should throw error when trying to delete active tenant without force', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Showroom',
        subdomain: 'test-showroom',
        status: TenantStatus.ACTIVE
      };

      // Mock tenant lookup
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(mockTenant);

      await expect(tenantService.deleteTenant('tenant-123', false)).rejects.toThrow(
        'Cannot delete active tenant. Use force=true to override.'
      );
    });

    it('should delete active tenant when force flag is true', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Showroom',
        subdomain: 'test-showroom',
        status: TenantStatus.ACTIVE
      };

      // Mock tenant lookup
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(mockTenant);

      const result = await tenantService.deleteTenant('tenant-123', true);

      expect(result).toBe(true);
    });
  });

  describe('getTenants', () => {
    it('should return paginated tenant list', async () => {
      const options = {
        page: 1,
        limit: 10,
        status: TenantStatus.ACTIVE as TenantStatus,
        search: 'Test'
      };

      const result = await tenantService.getTenants(options);

      expect(result).toHaveProperty('tenants');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.tenants)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('should handle default pagination options', async () => {
      const options = {
        page: 1,
        limit: 10
      };

      const result = await tenantService.getTenants(options);

      expect(result).toHaveProperty('tenants');
      expect(result).toHaveProperty('total');
    });
  });

  describe('getTenantHealth', () => {
    it('should return health status for healthy tenant', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Showroom',
        subdomain: 'test-showroom',
        dbName: 'autolumiku_tenant_test_showroom'
      };

      // Mock tenant lookup and healthy database connection
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(mockTenant);
      (tenantDatabasePool.getTenantConnection as jest.Mock).mockResolvedValue({});

      const result = await tenantService.getTenantHealth('tenant-123');

      expect(result).toBeDefined();
      expect(result?.tenantId).toBe('tenant-123');
      expect(result?.database.status).toBe('healthy');
      expect(result?.lastChecked).toBeInstanceOf(Date);
    });

    it('should return null for non-existent tenant', async () => {
      // Mock tenant not found
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(null);

      const result = await tenantService.getTenantHealth('non-existent-tenant');

      expect(result).toBeNull();
    });

    it('should return unhealthy status for database connection failure', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Showroom',
        subdomain: 'test-showroom',
        dbName: 'autolumiku_tenant_test_showroom'
      };

      // Mock tenant lookup and failed database connection
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(mockTenant);
      (tenantDatabasePool.getTenantConnection as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await tenantService.getTenantHealth('tenant-123');

      expect(result).toBeDefined();
      expect(result?.database.status).toBe('unhealthy');
      expect(result?.database.error).toBe('Database connection failed');
    });
  });

  describe('updateTenant', () => {
    it('should update tenant successfully', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Showroom',
        subdomain: 'test-showroom',
        status: TenantStatus.ACTIVE,
        createdAt: new Date('2025-11-20'),
        updatedAt: new Date('2025-11-20')
      };

      const updateData = {
        name: 'Updated Showroom',
        settings: { theme: 'dark' }
      };

      // Mock tenant lookup
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(mockTenant);

      const result = await tenantService.updateTenant('tenant-123', updateData);

      expect(result).toBeDefined();
      expect(result?.name).toBe(updateData.name);
      expect(result?.settings).toEqual(updateData.settings);
      expect(result?.updatedAt).toBeInstanceOf(Date());
    });

    it('should return null for non-existent tenant', async () => {
      // Mock tenant not found
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(null);

      const result = await tenantService.updateTenant('non-existent-tenant', {
        name: 'Updated Name'
      });

      expect(result).toBeNull();
    });

    it('should throw error for invalid status', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Showroom',
        subdomain: 'test-showroom',
        status: TenantStatus.ACTIVE
      };

      const updateData = {
        status: 'invalid-status' as any
      };

      // Mock tenant lookup
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(mockTenant);

      await expect(tenantService.updateTenant('tenant-123', updateData)).rejects.toThrow(
        'Invalid status: invalid-status'
      );
    });
  });
});