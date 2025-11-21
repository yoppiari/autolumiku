/**
 * Role Management Service Unit Tests
 * Story 1.8: Role-Based Access Control
 */

import { RoleManagementService } from '@/services/rbac-service/roles/manager';
import { DatabaseClient } from '@/lib/database';
import { Cache } from '@/lib/cache';

// Mock dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/cache');
jest.mock('@/lib/logger');

describe('RoleManagementService', () => {
  let service: RoleManagementService;
  let mockDb: jest.Mocked<DatabaseClient>;
  let mockCache: jest.Mocked<Cache>;
  const testTenantId = 'test-tenant-id';
  const testUserId = 'test-user-id';

  beforeEach(() => {
    mockDb = new DatabaseClient() as jest.Mocked<DatabaseClient>;
    mockCache = new Cache('test', 300) as jest.Mocked<Cache>;

    mockDb.query = jest.fn();
    mockCache.get = jest.fn().mockResolvedValue(null);
    mockCache.set = jest.fn();
    mockCache.deletePattern = jest.fn();

    service = new RoleManagementService(mockDb, testTenantId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoleMatrix', () => {
    it('should return role matrix with permissions', async () => {
      const mockRoles = [
        {
          id: 'role-1',
          name: 'showroom_manager',
          display_name: 'Showroom Manager',
          indonesian_title: 'Pemilik Showroom',
          department: 'Management',
          role_level: 1,
          member_count: '5',
          is_system: true,
          is_active: true
        }
      ];

      const mockPermissions = [
        {
          id: 'perm-1',
          code: 'team.manage',
          name: 'Manage Team',
          category: 'team',
          description: 'Can manage team members'
        }
      ];

      const mockRolePermissions = [
        {
          role_id: 'role-1',
          id: 'perm-1',
          code: 'team.manage',
          name: 'Manage Team',
          category: 'team',
          description: 'Can manage team members'
        }
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockRoles })
        .mockResolvedValueOnce({ rows: mockPermissions })
        .mockResolvedValueOnce({ rows: mockRolePermissions });

      const matrix = await service.getRoleMatrix();

      expect(matrix).toHaveLength(1);
      expect(matrix[0].roleName).toBe('showroom_manager');
      expect(matrix[0].permissions).toBeDefined();
      expect(matrix[0].memberCount).toBe(5);
    });

    it('should use cached result if available', async () => {
      const cachedMatrix = JSON.stringify([{ roleId: 'cached-role' }]);
      mockCache.get = jest.fn().mockResolvedValue(cachedMatrix);

      const matrix = await service.getRoleMatrix();

      expect(matrix).toHaveLength(1);
      expect(matrix[0].roleId).toBe('cached-role');
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('createCustomRole', () => {
    const roleData = {
      name: 'custom_role',
      displayName: 'Custom Role',
      indonesianTitle: 'Peran Kustom',
      description: 'Custom role for testing',
      department: 'Sales',
      roleLevel: 3,
      permissions: ['perm-1', 'perm-2']
    };

    it('should create custom role successfully', async () => {
      const mockNewRole = {
        id: 'new-role-id',
        name: roleData.name,
        display_name: roleData.displayName
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing role
        .mockResolvedValueOnce({ rows: [mockNewRole] }) // Insert role
        .mockResolvedValueOnce({ rows: [] }); // Insert permissions

      const result = await service.createCustomRole(testUserId, roleData);

      expect(result.id).toBe('new-role-id');
      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject duplicate role name', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-role' }] });

      await expect(service.createCustomRole(testUserId, roleData))
        .rejects.toThrow('already exists');

      expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject invalid role level', async () => {
      const invalidRoleData = { ...roleData, roleLevel: 101 };

      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.createCustomRole(testUserId, invalidRoleData))
        .rejects.toThrow('Role level must be between 1 and 100');
    });

    it('should handle role inheritance', async () => {
      const roleDataWithInheritance = {
        ...roleData,
        inheritsFrom: ['parent-role-id']
      };

      const mockNewRole = { id: 'new-role-id', name: roleData.name };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [mockNewRole] }) // Insert role
        .mockResolvedValueOnce({ rows: [] }) // Insert permissions
        .mockResolvedValueOnce({ rows: [] }); // Inherit permissions

      await service.createCustomRole(testUserId, roleDataWithInheritance);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO role_permissions'),
        expect.arrayContaining(['new-role-id', 'parent-role-id'])
      );
    });
  });

  describe('updateRolePermissions', () => {
    const roleId = 'test-role-id';
    const newPermissions = ['perm-1', 'perm-2', 'perm-3'];

    it('should update role permissions successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: roleId, name: 'test_role', is_system: false }] }) // Get role
        .mockResolvedValueOnce({ rows: [{ permission_id: 'old-perm' }] }) // Get current permissions
        .mockResolvedValueOnce({ rows: [] }) // Delete old permissions
        .mockResolvedValueOnce({ rows: [] }) // Insert new permissions
        .mockResolvedValueOnce({ rows: [] }); // Update timestamp

      await service.updateRolePermissions(roleId, testUserId, newPermissions);

      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject updates to system roles', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: roleId, name: 'showroom_manager', is_system: true }]
      });

      await expect(service.updateRolePermissions(roleId, testUserId, newPermissions))
        .rejects.toThrow('Cannot modify system role permissions');

      expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject non-existent role', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateRolePermissions(roleId, testUserId, newPermissions))
        .rejects.toThrow('Role not found');
    });

    it('should clear relevant cache after update', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: roleId, name: 'test_role', is_system: false }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }); // Get users with this role

      await service.updateRolePermissions(roleId, testUserId, newPermissions);

      expect(mockCache.deletePattern).toHaveBeenCalled();
    });
  });

  describe('cloneRole', () => {
    const sourceRoleId = 'source-role-id';
    const newRoleData = {
      name: 'cloned_role',
      displayName: 'Cloned Role',
      indonesianTitle: 'Peran Tiruan'
    };

    it('should clone role successfully', async () => {
      const mockSourceRole = {
        id: sourceRoleId,
        name: 'original_role',
        display_name: 'Original Role',
        indonesian_title: 'Peran Asli',
        description: 'Original description',
        department: 'Sales',
        role_level: 3
      };

      const mockSourcePermissions = [{ permission_id: 'perm-1' }, { permission_id: 'perm-2' }];
      const mockNewRole = { id: 'cloned-role-id', name: newRoleData.name };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockSourceRole] }) // Get source role
        .mockResolvedValueOnce({ rows: mockSourcePermissions }) // Get source permissions
        .mockResolvedValueOnce({ rows: [] }) // Check duplicate (for create)
        .mockResolvedValueOnce({ rows: [mockNewRole] }) // Insert new role
        .mockResolvedValueOnce({ rows: [] }); // Insert permissions

      const result = await service.cloneRole(sourceRoleId, testUserId, newRoleData);

      expect(result.id).toBe('cloned-role-id');
      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject non-existent source role', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.cloneRole(sourceRoleId, testUserId, newRoleData))
        .rejects.toThrow('Source role not found');
    });
  });

  describe('deleteCustomRole', () => {
    const roleId = 'role-to-delete';

    it('should delete custom role successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ name: 'custom_role', is_system: false }] }) // Get role
        .mockResolvedValueOnce({ rows: [{ usage_count: '0' }] }) // Check usage
        .mockResolvedValueOnce({ rows: [] }) // Delete permissions
        .mockResolvedValueOnce({ rows: [] }); // Delete role

      await service.deleteCustomRole(roleId, testUserId);

      expect(mockDb.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject deletion of system roles', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ name: 'showroom_manager', is_system: true }]
      });

      await expect(service.deleteCustomRole(roleId, testUserId))
        .rejects.toThrow('Cannot delete system role');
    });

    it('should reject deletion of roles in use', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ name: 'custom_role', is_system: false }] })
        .mockResolvedValueOnce({ rows: [{ usage_count: '5' }] });

      await expect(service.deleteCustomRole(roleId, testUserId))
        .rejects.toThrow('assigned to 5 team member(s)');
    });
  });

  describe('getRoleUsageStatistics', () => {
    it('should return usage statistics for all roles', async () => {
      const mockStats = [
        {
          id: 'role-1',
          name: 'showroom_manager',
          current_members: '5',
          active_members: '4'
        },
        {
          id: 'role-2',
          name: 'sales_executive',
          current_members: '10',
          active_members: '8'
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockStats });

      const stats = await service.getRoleUsageStatistics();

      expect(stats).toHaveLength(2);
      expect(stats[0].current_members).toBe('5');
    });

    it('should use cached statistics if available', async () => {
      const cachedStats = JSON.stringify([{ id: 'cached' }]);
      mockCache.get = jest.fn().mockResolvedValue(cachedStats);

      const stats = await service.getRoleUsageStatistics();

      expect(stats[0].id).toBe('cached');
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('exportRoleConfiguration', () => {
    it('should export all roles for tenant', async () => {
      const mockConfig = {
        configuration: {
          roles: [
            { name: 'role1', permissions: ['perm1', 'perm2'] },
            { name: 'role2', permissions: ['perm3'] }
          ],
          exportedAt: new Date(),
          tenantId: testTenantId
        }
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockConfig] });

      const config = await service.exportRoleConfiguration();

      expect(config.roles).toHaveLength(2);
      expect(config.tenantId).toBe(testTenantId);
    });

    it('should export single role when roleId provided', async () => {
      const roleId = 'specific-role-id';
      const mockConfig = {
        configuration: {
          roles: [{ name: 'single_role', permissions: ['perm1'] }]
        }
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockConfig] });

      const config = await service.exportRoleConfiguration(roleId);

      expect(config.roles).toHaveLength(1);
    });
  });

  describe('importRoleConfiguration', () => {
    const importConfig = {
      roles: [
        {
          name: 'imported_role',
          displayName: 'Imported Role',
          indonesianTitle: 'Peran Impor',
          description: 'Imported role',
          department: 'Sales',
          roleLevel: 3,
          permissions: ['inventory.view', 'customers.view']
        }
      ]
    };

    it('should import new roles successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing role
        .mockResolvedValueOnce({ rows: [{ id: 'perm-1' }, { id: 'perm-2' }] }) // Get permission IDs
        .mockResolvedValueOnce({ rows: [{ id: 'new-role-id' }] }) // Insert role
        .mockResolvedValueOnce({ rows: [] }); // Insert permissions

      const result = await service.importRoleConfiguration(
        importConfig,
        testUserId,
        { overwriteExisting: false }
      );

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip existing roles when overwrite is false', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-role-id', is_system: false }]
      });

      const result = await service.importRoleConfiguration(
        importConfig,
        testUserId,
        { overwriteExisting: false }
      );

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('should preserve system roles when flag is set', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'system-role-id', is_system: true }]
      });

      const result = await service.importRoleConfiguration(
        importConfig,
        testUserId,
        { preserveSystemRoles: true }
      );

      expect(result.skipped).toBe(1);
    });
  });
});
