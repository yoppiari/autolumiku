/**
 * Role Management Service Unit Tests
 * Tests for advanced role management functionality
 */

import { RoleManagementService } from '@/services/rbac-service/roles/manager';
import { DatabaseClient } from '@/lib/database';
import { Cache } from '@/lib/cache';
import { Logger } from '@/lib/logger';

// Mock dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/cache');
jest.mock('@/lib/logger');

describe('RoleManagementService', () => {
  let service: RoleManagementService;
  let mockDb: jest.Mocked<DatabaseClient>;
  let mockCache: jest.Mocked<Cache>;
  let mockLogger: jest.Mocked<Logger>;

  const tenantId = 'test-tenant-123';

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      query: jest.fn(),
      close: jest.fn()
    } as any;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      deletePattern: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    service = new RoleManagementService(mockDb, tenantId);
  });

  describe('getRoleMatrix', () => {
    it('should return complete role matrix with permissions', async () => {
      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Mock database responses
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'role-1',
              name: 'sales_manager',
              display_name: 'Sales Manager',
              indonesian_title: 'Manager Penjualan',
              department: 'Sales',
              role_level: 20,
              is_active: true,
              member_count: '3',
              is_system: false
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'perm-1',
              code: 'team.view_members',
              name: 'View Team Members',
              category: 'Team',
              description: 'Can view team member list'
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              role_id: 'role-1',
              id: 'perm-1',
              code: 'team.view_members',
              name: 'View Team Members',
              category: 'Team',
              description: 'Can view team member list',
              granted: true
            }
          ]
        });

      const result = await service.getRoleMatrix();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        roleId: 'role-1',
        roleName: 'sales_manager',
        displayName: 'Sales Manager',
        indonesianTitle: 'Manager Penjualan',
        department: 'Sales',
        roleLevel: 20,
        memberCount: 3,
        isSystem: false,
        isActive: true
      });

      expect(result[0].permissions).toHaveLength(1);
      expect(result[0].permissions[0]).toMatchObject({
        permissionCode: 'team.view_members',
        permissionName: 'View Team Members',
        category: 'Team',
        granted: true
      });

      expect(mockCache.set).toHaveBeenCalledWith(
        `role_matrix:${tenantId}`,
        expect.any(String)
      );
    });

    it('should return cached result when available', async () => {
      const cachedMatrix = [
        {
          roleId: 'role-1',
          roleName: 'cached_role',
          displayName: 'Cached Role',
          permissions: []
        }
      ];

      mockCache.get.mockResolvedValue(JSON.stringify(cachedMatrix));

      const result = await service.getRoleMatrix();

      expect(result).toEqual(cachedMatrix);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getRoleMatrix()).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get role matrix',
        expect.any(Object)
      );
    });
  });

  describe('createCustomRole', () => {
    const roleData = {
      name: 'custom_role',
      displayName: 'Custom Role',
      indonesianTitle: 'Peran Kustom',
      description: 'A custom role',
      department: 'Management',
      roleLevel: 30,
      permissions: ['perm-1', 'perm-2']
    };

    it('should create a new custom role successfully', async () => {
      // Mock role name uniqueness check
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No existing role
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'new-role-id',
              name: roleData.name,
              display_name: roleData.displayName,
              indonesian_title: roleData.indonesianTitle,
              description: roleData.description,
              department: roleData.department,
              role_level: roleData.roleLevel,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            }
          ]
        });

      const result = await service.createCustomRole('user-123', roleData);

      expect(result).toMatchObject({
        id: 'new-role-id',
        name: roleData.name,
        displayName: roleData.displayName,
        indonesianTitle: roleData.indonesianTitle,
        description: roleData.description,
        department: roleData.department,
        roleLevel: roleData.roleLevel
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dealership_roles'),
        expect.arrayContaining([
          tenantId,
          roleData.name,
          roleData.displayName,
          roleData.indonesianTitle,
          roleData.description,
          roleData.department,
          roleData.roleLevel
        ])
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Custom role created successfully',
        expect.objectContaining({
          roleId: 'new-role-id',
          roleName: roleData.name,
          createdBy: 'user-123'
        })
      );
    });

    it('should reject duplicate role names', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-role', name: roleData.name }]
      });

      await expect(service.createCustomRole('user-123', roleData)).rejects.toThrow(
        'Role with name "custom_role" already exists'
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM dealership_roles'),
        [roleData.name, tenantId]
      );
    });

    it('should validate role level range', async () => {
      const invalidRoleData = { ...roleData, roleLevel: 150 };

      mockDb.query.mockResolvedValueOnce({ rows: [] }); // No existing role

      await expect(service.createCustomRole('user-123', invalidRoleData)).rejects.toThrow(
        'Role level must be between 1 and 100'
      );
    });

    it('should handle role inheritance', async () => {
      const roleWithInheritance = {
        ...roleData,
        inheritsFrom: ['parent-role-1']
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No existing role
        .mockResolvedValueOnce({
          rows: [{ id: 'new-role-id', name: roleData.name }]
        })
        .mockResolvedValueOnce({}); // Permission insertion
      // Mock parent role permissions copy
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.createCustomRole('user-123', roleWithInheritance);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT permission_id FROM role_permissions'),
        ['new-role-id', 'parent-role-1']
      );
    });

    it('should rollback on errors', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No existing role
        .mockRejectedValueOnce(new Error('Insert failed'));

      await expect(service.createCustomRole('user-123', roleData)).rejects.toThrow('Insert failed');

      expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('updateRolePermissions', () => {
    const roleId = 'role-123';
    const permissionIds = ['perm-1', 'perm-2', 'perm-3'];

    it('should update role permissions successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: roleId,
              name: 'test_role',
              is_system: false
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ permission_id: 'old-perm' }] // Current permissions
        })
        .mockResolvedValueOnce({}) // Delete old permissions
        .mockResolvedValueOnce({}); // Insert new permissions

      await service.updateRolePermissions(roleId, 'user-123', permissionIds);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM role_permissions'),
        [roleId]
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO role_permissions'),
        expect.arrayContaining([roleId, ...permissionIds])
      );

      expect(mockCache.deletePattern).toHaveBeenCalled();
    });

    it('should reject updates to system roles', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: roleId,
            name: 'system_role',
            is_system: true
          }
        ]
      });

      await expect(
        service.updateRolePermissions(roleId, 'user-123', permissionIds)
      ).rejects.toThrow('Cannot modify system role permissions');
    });

    it('should handle non-existent roles', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateRolePermissions('non-existent', 'user-123', permissionIds)
      ).rejects.toThrow('Role not found');
    });
  });

  describe('deleteCustomRole', () => {
    const roleId = 'role-123';

    it('should delete unused custom role successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: roleId,
              name: 'test_role',
              is_system: false
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] }) // No members assigned
        .mockResolvedValueOnce({}) // Delete permissions
        .mockResolvedValueOnce({}); // Delete role

      await service.deleteCustomRole(roleId, 'user-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM role_permissions'),
        [roleId]
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM dealership_roles'),
        [roleId]
      );
    });

    it('should reject deletion of system roles', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: roleId,
            name: 'system_role',
            is_system: true
          }
        ]
      });

      await expect(service.deleteCustomRole(roleId, 'user-123')).rejects.toThrow(
        'Cannot delete system role'
      );
    });

    it('should reject deletion of roles with assigned members', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: roleId,
              name: 'test_role',
              is_system: false
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ usage_count: '5' }] }); // 5 members assigned

      await expect(service.deleteCustomRole(roleId, 'user-123')).rejects.toThrow(
        'Cannot delete role that is assigned to 5 team member(s)'
      );
    });
  });

  describe('cloneRole', () => {
    const sourceRoleId = 'source-role-123';
    const cloneData = {
      name: 'cloned_role',
      displayName: 'Cloned Role',
      indonesianTitle: 'Peran Kloning',
      description: 'A cloned role',
      department: 'Management',
      roleLevel: 30,
      permissions: ['perm-1', 'perm-2']
    };

    it('should clone existing role successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: sourceRoleId,
              name: 'source_role',
              display_name: 'Source Role',
              indonesian_title: 'Peran Sumber',
              description: 'Source role description',
              department: 'Management',
              role_level: 25
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ permission_id: 'perm-1' }, { permission_id: 'perm-2' }]
        });

      const result = await service.cloneRole(sourceRoleId, 'user-123', cloneData);

      expect(result).toMatchObject({
        name: cloneData.name,
        displayName: cloneData.displayName
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Role cloned successfully',
        expect.objectContaining({
          sourceRoleId,
          clonedRoleId: expect.any(String),
          clonedBy: 'user-123'
        })
      );
    });

    it('should handle non-existent source role', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.cloneRole('non-existent', 'user-123', cloneData)
      ).rejects.toThrow('Source role not found');
    });
  });

  describe('getRoleUsageStatistics', () => {
    it('should return role usage statistics', async () => {
      mockCache.get.mockResolvedValue(null);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'role-1',
            name: 'sales_manager',
            display_name: 'Sales Manager',
            indonesian_title: 'Manager Penjualan',
            department: 'Sales',
            role_level: 20,
            is_system: false,
            current_members: '3',
            primary_assignments: '2',
            last_assignment: new Date(),
            active_members: '3'
          }
        ]
      });

      const result = await service.getRoleUsageStatistics();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'role-1',
        name: 'sales_manager',
        currentMembers: 3,
        primaryAssignments: 2,
        activeMembers: 3,
        isSystem: false
      });

      expect(mockCache.set).toHaveBeenCalledWith(
        `role_usage_stats:${tenantId}`,
        expect.any(String)
      );
    });
  });

  describe('exportRoleConfiguration', () => {
    it('should export role configuration in specified format', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            configuration: {
              roles: [
                {
                  name: 'test_role',
                  displayName: 'Test Role',
                  permissions: ['team.view_members']
                }
              ],
              exportedAt: new Date(),
              exportedBy: 'user-123',
              tenantId: tenantId
            }
          }
        ]
      });

      const result = await service.exportRoleConfiguration();

      expect(result).toMatchObject({
        roles: expect.any(Array),
        exportedAt: expect.any(Date),
        tenantId: tenantId
      });
    });
  });

  describe('importRoleConfiguration', () => {
    const configuration = {
      roles: [
        {
          name: 'imported_role',
          displayName: 'Imported Role',
          indonesianTitle: 'Peran Impor',
          description: 'Imported role',
          department: 'Management',
          roleLevel: 30,
          permissions: ['team.view_members']
        }
      ]
    };

    it('should import role configuration successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No existing role
        .mockResolvedValueOnce({
          rows: [{ id: 'new-role-id', name: 'imported_role' }]
        });

      const result = await service.importRoleConfiguration(configuration, 'user-123');

      expect(result).toMatchObject({
        imported: 1,
        skipped: 0,
        errors: []
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Role configuration imported successfully',
        expect.objectContaining({
          imported: 1,
          importedBy: 'user-123'
        })
      );
    });

    it('should skip existing roles when overwrite is disabled', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-role', name: 'imported_role' }]
      });

      const result = await service.importRoleConfiguration(configuration, 'user-123', {
        overwriteExisting: false
      });

      expect(result).toMatchObject({
        imported: 0,
        skipped: 1
      });
    });

    it('should handle import errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Import failed'));

      const result = await service.importRoleConfiguration(configuration, 'user-123');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to import role "imported_role"');
    });
  });

  describe('cache management', () => {
    it('should clear role cache on updates', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'role-1', name: 'test_role', is_system: false }]
      });
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // No current permissions

      await service.updateRolePermissions('role-1', 'user-123', ['perm-1']);

      expect(mockCache.deletePattern).toHaveBeenCalledWith(`role_matrix:${tenantId}`);
    });

    it('should clear permission cache for role users', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ user_id: 'user-1' }, { user_id: 'user-2' }]
      });

      await service['clearPermissionCacheForRole']('role-1');

      expect(mockCache.deletePattern).toHaveBeenCalledWith(
        `permission:${tenantId}:user-1:*`
      );
      expect(mockCache.deletePattern).toHaveBeenCalledWith(
        `permission:${tenantId}:user-2:*`
      );
    });
  });
});