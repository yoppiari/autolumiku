/**
 * Team Role Management API Integration Tests
 * Tests for the complete role management workflow
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/team/roles/route';
import { PUT, DELETE } from '@/app/api/team/roles/[id]/route';
import { POST as ClonePOST } from '@/app/api/team/roles/[id]/clone/route';

// Mock authentication
jest.mock('@/lib/auth', () => ({
  authenticateRequest: jest.fn()
}));

// Mock database
jest.mock('@/lib/database', () => ({
  DatabaseClient: jest.fn()
}));

import { authenticateRequest } from '@/lib/auth';
import { DatabaseClient } from '@/lib/database';

const mockAuth = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const mockDb = DatabaseClient as jest.MockedClass<typeof DatabaseClient>;

describe('Team Role Management API Integration', () => {
  let mockDbInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDbInstance = {
      query: jest.fn(),
      close: jest.fn()
    };

    mockDb.mockImplementation(() => mockDbInstance);

    // Default successful authentication
    mockAuth.mockResolvedValue({
      success: true,
      userId: 'user-123',
      tenantId: 'tenant-123',
      requirePermission: jest.fn().mockResolvedValue(undefined)
    });
  });

  describe('GET /api/team/roles', () => {
    it('should return role list with matrix', async () => {
      const request = new NextRequest('http://localhost:3000/api/team/roles?includeMatrix=true');

      mockDbInstance.query
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

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toMatchObject({
        roleName: 'sales_manager',
        displayName: 'Sales Manager',
        permissions: expect.any(Array)
      });

      expect(mockAuth).toHaveBeenCalledWith(request);
    });

    it('should return role usage statistics', async () => {
      const request = new NextRequest('http://localhost:3000/api/team/roles?includeUsage=true');

      mockDbInstance.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'role-1',
            name: 'sales_manager',
            display_name: 'Sales Manager',
            department: 'Sales',
            role_level: 20,
            is_system: false,
            current_members: '5',
            primary_assignments: '3',
            last_assignment: new Date(),
            active_members: '4'
          }
        ]
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data[0]).toMatchObject({
        name: 'sales_manager',
        currentMembers: 5,
        primaryAssignments: 3,
        activeMembers: 4
      });
    });

    it('should handle authentication failure', async () => {
      mockAuth.mockResolvedValue({
        success: false,
        error: 'Invalid token'
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle permission denied', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockRejectedValue(new Error('Permission denied'))
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST /api/team/roles', () => {
    const validRoleData = {
      name: 'custom_role',
      displayName: 'Custom Role',
      indonesianTitle: 'Peran Kustom',
      description: 'A custom role for testing',
      department: 'Management',
      roleLevel: 30,
      permissions: ['perm-1', 'perm-2']
    };

    it('should create a new custom role successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(validRoleData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      mockDbInstance.query
        .mockResolvedValueOnce({ rows: [] }) // No existing role
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'new-role-id',
              name: validRoleData.name,
              display_name: validRoleData.displayName,
              indonesian_title: validRoleData.indonesianTitle,
              description: validRoleData.description,
              department: validRoleData.department,
              role_level: validRoleData.roleLevel,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            }
          ]
        })
        .mockResolvedValueOnce({}); // Permissions insertion

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        name: validRoleData.name,
        displayName: validRoleData.displayName
      });

      expect(mockDbInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dealership_roles'),
        expect.arrayContaining([
          'tenant-123',
          validRoleData.name,
          validRoleData.displayName,
          validRoleData.indonesianTitle,
          validRoleData.description,
          validRoleData.department,
          validRoleData.roleLevel
        ])
      );
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'test_role'
        // Missing required fields
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation error');
      expect(data.message).toContain('Missing required fields');
    });

    it('should validate role level range', async () => {
      const invalidData = {
        ...validRoleData,
        roleLevel: 150 // Invalid: > 100
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Role level must be between 1 and 100');
    });

    it('should handle role name conflicts', async () => {
      mockDbInstance.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-role', name: validRoleData.name }]
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(validRoleData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Conflict');
      expect(data.message).toContain('already exists');
    });

    it('should validate permissions array', async () => {
      const invalidData = {
        ...validRoleData,
        permissions: 'not-an-array'
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Permissions must be an array');
    });
  });

  describe('PUT /api/team/roles/[id]', () => {
    const roleId = 'role-123';
    const permissionIds = ['perm-1', 'perm-2', 'perm-3'];

    it('should update role permissions successfully', async () => {
      const request = new NextRequest(`http://localhost:3000/api/team/roles/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: permissionIds }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      mockDbInstance.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: roleId,
              name: 'test_role',
              is_system: false
            }
          ]
        })
        .mockResolvedValueOnce({}); // Permissions update

      const response = await PUT(request, { params: Promise.resolve({ id: roleId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Role permissions updated successfully');
    });

    it('should reject updates to system roles', async () => {
      const request = new NextRequest(`http://localhost:3000/api/team/roles/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: permissionIds }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      mockDbInstance.query.mockResolvedValueOnce({
        rows: [
          {
            id: roleId,
            name: 'system_role',
            is_system: true
          }
        ]
      });

      const response = await PUT(request, { params: Promise.resolve({ id: roleId }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(data.message).toContain('system role');
    });

    it('should handle non-existent roles', async () => {
      const request = new NextRequest(`http://localhost:3000/api/team/roles/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: permissionIds }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      mockDbInstance.query.mockResolvedValueOnce({ rows: [] });

      const response = await PUT(request, { params: Promise.resolve({ id: roleId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });
  });

  describe('DELETE /api/team/roles/[id]', () => {
    const roleId = 'role-123';

    it('should delete unused custom role successfully', async () => {
      const request = new NextRequest(`http://localhost:3000/api/team/roles/${roleId}`, {
        method: 'DELETE'
      });

      mockDbInstance.query
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

      const response = await DELETE(request, { params: Promise.resolve({ id: roleId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Custom role deleted successfully');
    });

    it('should reject deletion of system roles', async () => {
      const request = new NextRequest(`http://localhost:3000/api/team/roles/${roleId}`, {
        method: 'DELETE'
      });

      mockDbInstance.query.mockResolvedValueOnce({
        rows: [
          {
            id: roleId,
            name: 'system_role',
            is_system: true
          }
        ]
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: roleId }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(data.message).toContain('system role');
    });

    it('should reject deletion of roles with assigned members', async () => {
      const request = new NextRequest(`http://localhost:3000/api/team/roles/${roleId}`, {
        method: 'DELETE'
      });

      mockDbInstance.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: roleId,
              name: 'test_role',
              is_system: false
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ usage_count: '3' }] }); // 3 members assigned

      const response = await DELETE(request, { params: Promise.resolve({ id: roleId }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Conflict');
      expect(data.message).toContain('assigned to 3 team member');
    });
  });

  describe('POST /api/team/roles/[id]/clone', () => {
    const roleId = 'role-123';
    const cloneData = {
      name: 'cloned_role',
      displayName: 'Cloned Role',
      indonesianTitle: 'Peran Kloning',
      description: 'A cloned role',
      department: 'Management',
      roleLevel: 30
    };

    it('should clone existing role successfully', async () => {
      const request = new NextRequest(`http://localhost:3000/api/team/roles/${roleId}/clone`, {
        method: 'POST',
        body: JSON.stringify(cloneData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      mockDbInstance.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: roleId,
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
          rows: [{ permission_id: 'perm-1' }]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'cloned-role-id',
              name: cloneData.name,
              display_name: cloneData.displayName
            }
          ]
        });

      const response = await ClonePOST(request, { params: Promise.resolve({ id: roleId }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        name: cloneData.name,
        displayName: cloneData.displayName
      });
    });

    it('should handle non-existent source role', async () => {
      const request = new NextRequest(`http://localhost:3000/api/team/roles/${roleId}/clone`, {
        method: 'POST',
        body: JSON.stringify(cloneData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      mockDbInstance.query.mockResolvedValueOnce({ rows: [] });

      const response = await ClonePOST(request, { params: Promise.resolve({ id: roleId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
      expect(data.message).toContain('Source role not found');
    });

    it('should validate clone data', async () => {
      const invalidData = {
        name: 'clone_test'
        // Missing required fields
      };

      const request = new NextRequest(`http://localhost:3000/api/team/roles/${roleId}/clone`, {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await ClonePOST(request, { params: Promise.resolve({ id: roleId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
      expect(data.message).toContain('Missing required fields');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: 'invalid-json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should handle database connection errors', async () => {
      mockDbInstance.query.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/team/roles');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should handle concurrent role creation attempts', async () => {
      const roleData = {
        name: 'concurrent_role',
        displayName: 'Concurrent Role',
        indonesianTitle: 'Peran Bersamaan',
        description: 'Test concurrent creation',
        department: 'Management',
        roleLevel: 30,
        permissions: ['perm-1']
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(roleData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // First call succeeds, second call detects conflict
      mockDbInstance.query
        .mockResolvedValueOnce({ rows: [] }) // No existing role check
        .mockRejectedValueOnce(new Error('Unique constraint violation'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle very large permission arrays', async () => {
      const roleData = {
        name: 'role_with_many_perms',
        displayName: 'Role with Many Permissions',
        indonesianTitle: 'Peran Banyak Izin',
        description: 'Test role with many permissions',
        department: 'Management',
        roleLevel: 30,
        permissions: Array.from({ length: 1000 }, (_, i) => `perm-${i}`)
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(roleData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      mockDbInstance.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 'new-role-id', name: roleData.name }]
        });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should maintain tenant isolation', async () => {
      const request = new NextRequest('http://localhost:3000/api/team/roles');

      // Mock authentication with different tenant
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-456',
        tenantId: 'different-tenant',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      mockDbInstance.query.mockResolvedValue({ rows: [] });

      await GET(request);

      // Verify that tenant isolation is maintained
      expect(mockDbInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['different-tenant']
      );
    });
  });
});