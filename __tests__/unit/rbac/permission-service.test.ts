/**
 * Permission Service Unit Tests
 * Story 1.8: Role-Based Access Control
 */

import { PermissionService } from '@/services/rbac-service/checks/evaluator';
import { DatabaseClient } from '@/lib/database';
import { Cache } from '@/lib/cache';

jest.mock('@/lib/database');
jest.mock('@/lib/cache');
jest.mock('@/lib/logger');

describe('PermissionService', () => {
  let service: PermissionService;
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

    service = new PermissionService(mockDb, testTenantId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hasPermission', () => {
    const permissionCode = 'inventory.view';

    it('should return true when user has permission', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ has_permission: true }]
      });

      const result = await service.hasPermission(testUserId, permissionCode);

      expect(result).toBe(true);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining(permissionCode),
        'true'
      );
    });

    it('should return false when user lacks permission', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ has_permission: false }]
      });

      const result = await service.hasPermission(testUserId, permissionCode);

      expect(result).toBe(false);
    });

    it('should use cached result if available', async () => {
      mockCache.get = jest.fn().mockResolvedValue('true');

      const result = await service.hasPermission(testUserId, permissionCode);

      expect(result).toBe(true);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should check active team member and effective role dates', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ has_permission: true }]
      });

      await service.hasPermission(testUserId, permissionCode);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tm.is_active = true'),
        expect.arrayContaining([testUserId, testTenantId, permissionCode])
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tmr.effective_from <= CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });
  });

  describe('requirePermission', () => {
    const permissionCode = 'team.manage';

    it('should not throw when user has permission', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ has_permission: true }]
      });

      await expect(service.requirePermission(testUserId, permissionCode))
        .resolves.not.toThrow();
    });

    it('should throw when user lacks permission', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ has_permission: false }]
      });

      await expect(service.requirePermission(testUserId, permissionCode))
        .rejects.toThrow('does not have required permission');
    });

    it('should throw custom message when provided', async () => {
      const customMessage = 'Custom permission denied message';
      mockDb.query.mockResolvedValueOnce({
        rows: [{ has_permission: false }]
      });

      await expect(service.requirePermission(testUserId, permissionCode, customMessage))
        .rejects.toThrow(customMessage);
    });
  });

  describe('hasAnyPermission', () => {
    const permissions = ['inventory.view', 'inventory.update', 'inventory.delete'];

    it('should return true when user has at least one permission', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ has_any_permission: true }]
      });

      const result = await service.hasAnyPermission(testUserId, permissions);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the permissions', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ has_any_permission: false }]
      });

      const result = await service.hasAnyPermission(testUserId, permissions);

      expect(result).toBe(false);
    });

    it('should return false for empty permission array', async () => {
      const result = await service.hasAnyPermission(testUserId, []);

      expect(result).toBe(false);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should use cached result for permission combination', async () => {
      mockCache.get = jest.fn().mockResolvedValue('true');

      const result = await service.hasAnyPermission(testUserId, permissions);

      expect(result).toBe(true);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('hasAllPermissions', () => {
    const permissions = ['inventory.view', 'inventory.update'];

    it('should return true when user has all permissions', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ has_permission: true }] })
        .mockResolvedValueOnce({ rows: [{ has_permission: true }] });

      const result = await service.hasAllPermissions(testUserId, permissions);

      expect(result).toBe(true);
    });

    it('should return false when user lacks any permission', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ has_permission: true }] })
        .mockResolvedValueOnce({ rows: [{ has_permission: false }] });

      const result = await service.hasAllPermissions(testUserId, permissions);

      expect(result).toBe(false);
    });

    it('should return true for empty permission array', async () => {
      const result = await service.hasAllPermissions(testUserId, []);

      expect(result).toBe(true);
    });

    it('should short-circuit on first missing permission', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ has_permission: false }] });

      const result = await service.hasAllPermissions(testUserId, permissions);

      expect(result).toBe(false);
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Should stop after first failure
    });
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for user', async () => {
      const mockPermissions = [
        { code: 'inventory.view' },
        { code: 'inventory.update' },
        { code: 'team.view' }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockPermissions });

      const permissions = await service.getUserPermissions(testUserId);

      expect(permissions).toEqual(['inventory.view', 'inventory.update', 'team.view']);
    });

    it('should only return permissions from active roles', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.getUserPermissions(testUserId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tm.is_active = true'),
        expect.any(Array)
      );
    });

    it('should use cached permissions if available', async () => {
      const cachedPermissions = JSON.stringify(['cached.permission']);
      mockCache.get = jest.fn().mockResolvedValue(cachedPermissions);

      const permissions = await service.getUserPermissions(testUserId);

      expect(permissions).toEqual(['cached.permission']);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('getUserRoles', () => {
    it('should return all active roles for user', async () => {
      const mockRoles = [
        {
          id: 'role-1',
          name: 'showroom_manager',
          display_name: 'Showroom Manager',
          indonesian_title: 'Pemilik Showroom',
          is_primary: true
        },
        {
          id: 'role-2',
          name: 'sales_manager',
          display_name: 'Sales Manager',
          indonesian_title: 'Manager Penjualan',
          is_primary: false
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockRoles });

      const roles = await service.getUserRoles(testUserId);

      expect(roles).toHaveLength(2);
      expect(roles[0].name).toBe('showroom_manager');
    });

    it('should filter by effective date range', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.getUserRoles(testUserId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tmr.effective_from <= CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });
  });

  describe('getPrimaryRole', () => {
    it('should return primary role for user', async () => {
      const mockRole = {
        id: 'role-1',
        name: 'showroom_manager',
        display_name: 'Showroom Manager'
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockRole] });

      const role = await service.getPrimaryRole(testUserId);

      expect(role).not.toBeNull();
      expect(role.name).toBe('showroom_manager');
    });

    it('should return null when user has no primary role', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const role = await service.getPrimaryRole(testUserId);

      expect(role).toBeNull();
    });

    it('should only return roles marked as primary', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.getPrimaryRole(testUserId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tmr.is_primary = true'),
        expect.any(Array)
      );
    });
  });

  describe('hasRole', () => {
    const roleName = 'showroom_manager';

    it('should return true when user has role', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ has_role: true }] });

      const result = await service.hasRole(testUserId, roleName);

      expect(result).toBe(true);
    });

    it('should return false when user lacks role', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ has_role: false }] });

      const result = await service.hasRole(testUserId, roleName);

      expect(result).toBe(false);
    });

    it('should check role is active', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ has_role: false }] });

      await service.hasRole(testUserId, roleName);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('dr.is_active = true'),
        expect.any(Array)
      );
    });
  });

  describe('getUserPermissionLevel', () => {
    it('should return highest permission level (lowest number)', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ highest_level: 2 }]
      });

      const level = await service.getUserPermissionLevel(testUserId);

      expect(level).toBe(2);
    });

    it('should return 999 when user has no roles', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ highest_level: null }]
      });

      const level = await service.getUserPermissionLevel(testUserId);

      expect(level).toBe(999);
    });

    it('should use MIN function to get highest level', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ highest_level: 1 }] });

      await service.getUserPermissionLevel(testUserId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('MIN(dr.role_level)'),
        expect.any(Array)
      );
    });
  });

  describe('canManageUser', () => {
    const targetUserId = 'target-user-id';

    it('should return true when user can manage themselves', async () => {
      const result = await service.canManageUser(testUserId, testUserId);

      expect(result).toBe(true);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should return true when manager has higher permission level', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ highest_level: 2 }] }) // Manager level
        .mockResolvedValueOnce({ rows: [{ highest_level: 3 }] }); // Target level

      const result = await service.canManageUser(testUserId, targetUserId);

      expect(result).toBe(true);
    });

    it('should return false when manager has lower permission level', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ highest_level: 3 }] }) // Manager level
        .mockResolvedValueOnce({ rows: [{ highest_level: 2 }] }); // Target level

      const result = await service.canManageUser(testUserId, targetUserId);

      expect(result).toBe(false);
    });

    it('should return false when manager has no roles', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ highest_level: null }] }) // Manager has no roles
        .mockResolvedValueOnce({ rows: [{ highest_level: 3 }] });

      const result = await service.canManageUser(testUserId, targetUserId);

      expect(result).toBe(false);
    });
  });

  describe('clearUserPermissionCache', () => {
    it('should clear all permission-related cache for user', async () => {
      await service.clearUserPermissionCache(testUserId);

      expect(mockCache.deletePattern).toHaveBeenCalledWith(
        expect.stringContaining(testUserId)
      );
      expect(mockCache.deletePattern).toHaveBeenCalledTimes(7); // All pattern types
    });
  });

  describe('getAvailablePermissions', () => {
    it('should return all available permissions', async () => {
      const mockPermissions = [
        { id: 'perm-1', code: 'inventory.view', in_use: true },
        { id: 'perm-2', code: 'inventory.update', in_use: false }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockPermissions });

      const permissions = await service.getAvailablePermissions();

      expect(permissions).toHaveLength(2);
      expect(permissions[0].in_use).toBe(true);
    });
  });

  describe('getPermissionsByCategory', () => {
    it('should return permissions for specific category', async () => {
      const mockPermissions = [
        { id: 'perm-1', code: 'inventory.view', category: 'inventory' },
        { id: 'perm-2', code: 'inventory.update', category: 'inventory' }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockPermissions });

      const permissions = await service.getPermissionsByCategory('inventory');

      expect(permissions).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE category = $1'),
        ['inventory']
      );
    });
  });
});
