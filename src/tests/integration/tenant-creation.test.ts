import { TenantService } from '@/services/tenant-service';
import { TenantCreationWorkflowService } from '@/services/tenant-service/workflows';
import { UserService } from '@/services/user-service';
import { CreateTenantRequest, TenantStatus } from '@/types/tenant';
import { withTenantResolution } from '@/lib/middleware/tenant-resolution';
import { withTenantDatabase } from '@/lib/database/data-isolation';

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

describe('Tenant Creation Integration Tests', () => {
  let tenantService: TenantService;
  let workflowService: TenantCreationWorkflowService;
  let userService: UserService;

  beforeEach(() => {
    tenantService = new TenantService();
    workflowService = new TenantCreationWorkflowService();
    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('Complete Tenant Creation Workflow', () => {
    const validTenantRequest: CreateTenantRequest = {
      name: 'Integration Test Showroom',
      subdomain: 'integration-test',
      adminUser: {
        email: 'admin@integration-test.com',
        firstName: 'Integration',
        lastName: 'Admin',
        phone: '+62812345678'
      }
    };

    it('should create tenant with admin user successfully', async () => {
      // Step 1: Create tenant
      const tenant = await tenantService.createTenant(validTenantRequest);
      expect(tenant).toBeDefined();
      expect(tenant.name).toBe(validTenantRequest.name);
      expect(tenant.subdomain).toBe(validTenantRequest.subdomain);
      expect(tenant.status).toBe(TenantStatus.ACTIVE);

      // Step 2: Create admin user for tenant
      const adminUser = await userService.createTenantAdminUser(
        tenant.id,
        validTenantRequest.adminUser.email,
        validTenantRequest.adminUser.firstName,
        validTenantRequest.adminUser.lastName,
        validTenantRequest.adminUser.phone
      );

      expect(adminUser.user).toBeDefined();
      expect(adminUser.user.email).toBe(validTenantRequest.adminUser.email);
      expect(adminUser.user.tenantId).toBe(tenant.id);
      expect(adminUser.user.role).toBe('tenant_admin');
      expect(adminUser.temporaryPassword).toBeDefined();

      // Step 3: Verify admin user can log in
      const loginResult = await userService.loginUser({
        email: adminUser.user.email,
        password: adminUser.temporaryPassword,
        tenantId: tenant.id
      });

      expect(loginResult.user.email).toBe(adminUser.user.email);
      expect(loginResult.user.tenantId).toBe(tenant.id);
      expect(loginResult.token).toBeDefined();
      expect(loginResult.refreshToken).toBeDefined();
    });

    it('should handle tenant creation workflow steps', async () => {
      // Mock successful tenant creation
      const mockTenant = {
        id: 'tenant-workflow-123',
        name: validTenantRequest.name,
        subdomain: validTenantRequest.subdomain,
        status: TenantStatus.ACTIVE
      };

      (tenantService as any).getTenant = jest.fn().mockResolvedValue(mockTenant);

      // Execute workflow
      const workflowResult = await workflowService.executeWorkflow(mockTenant.id);

      expect(workflowResult).toBeDefined();
      expect(workflowResult.tenantId).toBe(mockTenant.id);
      expect(workflowResult.workflowId).toBeDefined();
      expect(workflowResult.steps).toBeDefined();
      expect(workflowResult.steps.length).toBeGreaterThan(0);

      // Verify all steps completed successfully
      const completedSteps = workflowResult.steps.filter(step => step.status === 'completed');
      expect(completedSteps.length).toBe(workflowResult.steps.length);
      expect(workflowResult.status).toBe('success');
    });
  });

  describe('Tenant Resolution Integration', () => {
    it('should resolve tenant from subdomain correctly', async () => {
      // Create mock request
      const mockRequest = {
        headers: new Headers({
          'host': 'integration-test.autolumiku.com'
        }),
        nextUrl: { pathname: '/dashboard' }
      } as any;

      // Mock tenant service
      const mockTenant = {
        id: 'tenant-123',
        name: 'Integration Test Showroom',
        subdomain: 'integration-test',
        status: TenantStatus.ACTIVE
      };

      (tenantService as any).getTenantBySubdomain = jest.fn().mockResolvedValue(mockTenant);

      // Test tenant resolution
      const context = await (async () => {
        const { extractTenantFromRequest } = require('@/lib/middleware/tenant-resolution');
        return await extractTenantFromRequest(mockRequest);
      })();

      expect(context.tenant).toEqual(mockTenant);
      expect(context.subdomain).toBe('integration-test');
      expect(context.isPublicRoute).toBe(false);
      expect(context.isAdminRoute).toBe(false);
    });

    it('should handle admin routes without tenant resolution', async () => {
      // Create mock admin request
      const mockRequest = {
        headers: new Headers({
          'host': 'autolumiku.com'
        }),
        nextUrl: { pathname: '/admin/tenants' }
      } as any;

      // Test tenant resolution for admin routes
      const context = await (async () => {
        const { extractTenantFromRequest } = require('@/lib/middleware/tenant-resolution');
        return await extractTenantFromRequest(mockRequest);
      })();

      expect(context.tenant).toBeNull();
      expect(context.subdomain).toBeNull();
      expect(context.isPublicRoute).toBe(false);
      expect(context.isAdminRoute).toBe(true);
    });

    it('should handle public routes without tenant resolution', async () => {
      // Create mock public request
      const mockRequest = {
        headers: new Headers({
          'host': 'autolumiku.com'
        }),
        nextUrl: { pathname: '/about' }
      } as any;

      // Test tenant resolution for public routes
      const context = await (async () => {
        const { extractTenantFromRequest } = require('@/lib/middleware/tenant-resolution');
        return await extractTenantFromRequest(mockRequest);
      })();

      expect(context.tenant).toBeNull();
      expect(context.subdomain).toBeNull();
      expect(context.isPublicRoute).toBe(true);
      expect(context.isAdminRoute).toBe(false);
    });
  });

  describe('Data Isolation Integration', () => {
    it('should validate tenant access permissions', async () => {
      const { TenantDataAccessValidator } = await import('@/lib/database/data-isolation');

      // Test super admin access
      const superAdminAccess = TenantDataAccessValidator.validateTenantAccess(
        null, // No tenant restriction for super admin
        'tenant-123',
        'super_admin'
      );
      expect(superAdminAccess.valid).toBe(true);

      // Test platform admin access
      const platformAdminAccess = TenantDataAccessValidator.validateTenantAccess(
        null, // No tenant restriction for platform admin
        'tenant-123',
        'admin'
      );
      expect(platformAdminAccess.valid).toBe(true);

      // Test tenant admin access to own tenant
      const tenantAdminAccess = TenantDataAccessValidator.validateTenantAccess(
        'tenant-123',
        'tenant-123',
        'tenant_admin'
      );
      expect(tenantAdminAccess.valid).toBe(true);

      // Test tenant admin access to different tenant (should fail)
      const crossTenantAccess = TenantDataAccessValidator.validateTenantAccess(
        'tenant-123',
        'tenant-456',
        'tenant_admin'
      );
      expect(crossTenantAccess.valid).toBe(false);
      expect(crossTenantAccess.reason).toContain('only access their own tenant');
    });

    it('should prevent cross-tenant operations', async () => {
      const { TenantDataAccessValidator } = await import('@/lib/database/data-isolation');

      // Test same tenant operation (should be allowed)
      const sameTenantOperation = TenantDataAccessValidator.validateCrossTenantOperation(
        'tenant-123',
        'tenant-123',
        'data_transfer'
      );
      expect(sameTenantOperation.valid).toBe(true);

      // Test cross-tenant operation (should be blocked)
      const crossTenantOperation = TenantDataAccessValidator.validateCrossTenantOperation(
        'tenant-123',
        'tenant-456',
        'data_transfer'
      );
      expect(crossTenantOperation.valid).toBe(false);
      expect(crossTenantOperation.reason).toContain('not allowed');
    });
  });

  describe('Tenant Database Query Builder', () => {
    it('should build tenant-scoped queries', async () => {
      const { createTenantQueryBuilder } = await import('@/lib/database/data-isolation');

      const queryBuilder = createTenantQueryBuilder('tenant-123');
      const query = queryBuilder.query('customers')
        .where('status = $1')
        .orderBy('created_at', 'DESC')
        .limit(10);

      const selectQuery = query.buildSelect();
      expect(selectQuery).toContain('SELECT * FROM customers');
      expect(selectQuery).toContain("WHERE tenant_id = 'tenant-123'");
      expect(selectQuery).toContain('status = $1');
      expect(selectQuery).toContain('ORDER BY created_at DESC');
      expect(selectQuery).toContain('LIMIT 10');

      const insertQuery = query.buildInsert({
        name: 'John Doe',
        email: 'john@example.com'
      });
      expect(insertQuery.query).toContain('INSERT INTO customers');
      expect(insertQuery.query).toContain('tenant_id');
      expect(insertQuery.values).toContain('tenant-123');

      const updateQuery = query.buildUpdate({
        name: 'Jane Doe'
      });
      expect(updateQuery.query).toContain('UPDATE customers');
      expect(updateQuery.query).toContain('SET name = $1');
      expect(updateQuery.query).toContain("WHERE tenant_id = 'tenant-123'");
    });
  });

  describe('User Service Integration', () => {
    it('should handle complete user lifecycle', async () => {
      const userData = {
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user' as const,
        tenantId: 'tenant-123'
      };

      // Create user
      const user = await userService.createUser(userData);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.tenantId).toBe(userData.tenantId);

      // Get user by ID
      const retrievedUser = await userService.getUser(user.id);
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.id).toBe(user.id);

      // Update user
      const updatedUser = await userService.updateUser(user.id, {
        firstName: 'Updated'
      });
      expect(updatedUser?.firstName).toBe('Updated');

      // Change password
      const newPassword = 'newSecurePassword123!';
      await expect(
        userService.changePassword(user.id, 'temporaryPassword', newPassword)
      ).resolves.not.toThrow();

      // Reset password
      const resetPassword = await userService.resetPassword(user.id);
      expect(resetPassword).toBeDefined();
      expect(resetPassword.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database connection failure
      const { tenantDatabasePool } = await import('@/lib/database/tenant-pool');
      (tenantDatabasePool.getTenantConnection as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const healthStatus = await tenantService.getTenantHealth('tenant-123');
      expect(healthStatus?.database.status).toBe('unhealthy');
      expect(healthStatus?.database.error).toBe('Database connection failed');
    });

    it('should handle tenant not found scenarios', async () => {
      // Mock tenant not found
      (tenantService as any).getTenant = jest.fn().mockResolvedValue(null);

      await expect(tenantService.getTenant('non-existent')).resolves.toBeNull();
      await expect(tenantService.updateTenant('non-existent', {})).resolves.toBeNull();
      await expect(tenantService.deleteTenant('non-existent')).resolves.toBe(false);
      await expect(tenantService.getTenantHealth('non-existent')).resolves.toBeNull();
    });

    it('should handle validation errors appropriately', async () => {
      const invalidRequests = [
        {
          request: {
            name: '',
            subdomain: 'test',
            adminUser: { email: 'test@test.com', firstName: 'Test', lastName: 'User' }
          },
          expectedError: 'Tenant name is required'
        },
        {
          request: {
            name: 'Test',
            subdomain: '',
            adminUser: { email: 'test@test.com', firstName: 'Test', lastName: 'User' }
          },
          expectedError: 'Subdomain is required'
        },
        {
          request: {
            name: 'Test',
            subdomain: 'test',
            adminUser: { email: 'invalid-email', firstName: 'Test', lastName: 'User' }
          },
          expectedError: 'Invalid admin email format'
        }
      ];

      for (const { request, expectedError } of invalidRequests) {
        await expect(tenantService.createTenant(request)).rejects.toThrow(expectedError);
      }
    });
  });
});