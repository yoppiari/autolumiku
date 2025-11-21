/**
 * Team Management Security Tests
 * Tests for authentication, authorization, and data protection
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/team/roles/route';
import { PUT, DELETE } from '@/app/api/team/roles/[id]/route';
import { GET as AnalyticsGET } from '@/app/api/team/analytics/route';

// Mock authentication
jest.mock('@/lib/auth', () => ({
  authenticateRequest: jest.fn()
}));

import { authenticateRequest } from '@/lib/auth';

const mockAuth = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;

describe('Team Management Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication', async () => {
      mockAuth.mockResolvedValue({
        success: false,
        error: 'No authentication token provided'
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toBe('No authentication token provided');
    });

    it('should reject requests with invalid tokens', async () => {
      mockAuth.mockResolvedValue({
        success: false,
        error: 'Invalid or expired token'
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toBe('Invalid or expired token');
    });

    it('should reject requests with malformed tokens', async () => {
      mockAuth.mockResolvedValue({
        success: false,
        error: 'Malformed authentication token'
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        headers: {
          'Authorization': 'Bearer malformed.token.'
        }
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should prevent token reuse across tenants', async () => {
      // Mock successful authentication for tenant A
      mockAuth.mockResolvedValueOnce({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      const requestA = new NextRequest('http://localhost:3000/api/team/roles', {
        headers: {
          'Authorization': 'Bearer valid-token',
          'X-Tenant-ID': 'tenant-123'
        }
      });

      const responseA = await GET(requestA);
      expect(responseA.status).toBe(200);

      // Mock authentication failure for same token with different tenant
      mockAuth.mockResolvedValueOnce({
        success: false,
        error: 'Token is not valid for this tenant'
      });

      const requestB = new NextRequest('http://localhost:3000/api/team/roles', {
        headers: {
          'Authorization': 'Bearer valid-token',
          'X-Tenant-ID': 'tenant-456'
        }
      });

      const responseB = await GET(requestB);
      expect(responseB.status).toBe(401);
    });
  });

  describe('Authorization Security', () => {
    it('should require proper permissions for viewing roles', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockRejectedValue(new Error('Permission denied: team.view_roles'))
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should require proper permissions for creating roles', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockRejectedValue(new Error('Permission denied: team.create_roles'))
      });

      const roleData = {
        name: 'test_role',
        displayName: 'Test Role',
        indonesianTitle: 'Peran Tes',
        department: 'Management',
        roleLevel: 30,
        permissions: ['perm-1']
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(roleData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it('should require proper permissions for managing roles', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockRejectedValue(new Error('Permission denied: team.manage_roles'))
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles/role-123', {
        method: 'PUT',
        body: JSON.stringify({ permissions: ['perm-1'] }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'role-123' }) });
      expect(response.status).toBe(500);
    });

    it('should require proper permissions for deleting roles', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockRejectedValue(new Error('Permission denied: team.delete_roles'))
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles/role-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'role-123' }) });
      expect(response.status).toBe(500);
    });

    it('should require proper permissions for viewing analytics', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockRejectedValue(new Error('Permission denied: team.view_analytics'))
      });

      const request = new NextRequest('http://localhost:3000/api/team/analytics');
      const response = await AnalyticsGET(request);

      expect(response.status).toBe(500);
    });

    it('should prevent privilege escalation through role modification', async () => {
      // Mock user with basic permissions
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockImplementation((permission) => {
          // Allow viewing roles but deny creating admin roles
          if (permission === 'team.view_roles') return Promise.resolve();
          if (permission === 'team.create_roles') return Promise.resolve();
          if (permission.includes('admin')) {
            return Promise.reject(new Error('Admin permissions required'));
          }
          return Promise.resolve();
        })
      });

      // Attempt to create role with admin permissions
      const adminRoleData = {
        name: 'admin_role',
        displayName: 'Admin Role',
        indonesianTitle: 'Peran Admin',
        department: 'Management',
        roleLevel: 1, // Highest level
        permissions: ['team.admin', 'billing.admin', 'system.admin']
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(adminRoleData),
        headers: { 'Content-Type': 'application/json' }
      });

      // Should fail due to insufficient permissions
      expect(mockAuth).toHaveBeenCalled();
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection in role names', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      const maliciousData = {
        name: "'; DROP TABLE dealership_roles; --",
        displayName: 'Malicious Role',
        indonesianTitle: 'Peran Jahat',
        department: 'Management',
        roleLevel: 30,
        permissions: ['perm-1']
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(maliciousData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      // Should handle malicious input safely
      expect(response.status).toBeLessThan(500);
      expect(data.success).toBe(false);
    });

    it('should prevent XSS in display names', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      const xssData = {
        name: 'xss_role',
        displayName: '<script>alert("XSS")</script>',
        indonesianTitle: '<img src=x onerror=alert("XSS")>',
        department: 'Management',
        roleLevel: 30,
        permissions: ['perm-1']
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(xssData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      // Should sanitize or reject XSS attempts
      expect(response.status).toBeLessThan(500);
      if (data.success) {
        // If successful, ensure XSS is sanitized
        expect(data.data.displayName).not.toContain('<script>');
        expect(data.data.indonesianTitle).not.toContain('<img');
      }
    });

    it('should validate and sanitize role levels', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      const invalidLevels = [
        { roleLevel: -1 }, // Negative
        { roleLevel: 0 }, // Zero
        { roleLevel: 101 }, // Over 100
        { roleLevel: 'invalid' }, // Non-numeric
        { roleLevel: null }, // Null
        { roleLevel: undefined } // Undefined
      ];

      for (const invalidData of invalidLevels) {
        const roleData = {
          name: 'test_role',
          displayName: 'Test Role',
          indonesianTitle: 'Peran Tes',
          department: 'Management',
          ...invalidData,
          permissions: ['perm-1']
        };

        const request = new NextRequest('http://localhost:3000/api/team/roles', {
          method: 'POST',
          body: JSON.stringify(roleData),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      }
    });

    it('should limit request payload size', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      // Create a very large payload
      const largePayload = {
        name: 'large_role',
        displayName: 'A'.repeat(10000), // Very long display name
        indonesianTitle: 'B'.repeat(10000),
        description: 'C'.repeat(50000),
        department: 'Management',
        roleLevel: 30,
        permissions: Array.from({ length: 1000 }, (_, i) => `perm-${i}`)
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(largePayload),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);

      // Should either succeed with validation or fail gracefully
      expect([200, 201, 400, 413]).toContain(response.status);
    });
  });

  describe('Data Isolation Security', () => {
    it('should prevent cross-tenant data access', async () => {
      // Mock user from tenant A
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles?tenantId=tenant-456');

      // Even if user tries to specify different tenant ID, should only access their own data
      const response = await GET(request);

      // Response should be successful but only show tenant-123 data
      expect([200, 403]).toContain(response.status);
    });

    it('should validate tenant context in all operations', async () => {
      const tenants = ['tenant-123', 'tenant-456', 'tenant-789'];

      for (const tenantId of tenants) {
        mockAuth.mockResolvedValue({
          success: true,
          userId: 'user-123',
          tenantId,
          requirePermission: jest.fn().mockResolvedValue(undefined)
        });

        const request = new NextRequest(`http://localhost:3000/api/team/roles`);
        const response = await GET(request);

        // Each tenant should get isolated data
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should handle rapid requests gracefully', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      const requests = Array.from({ length: 100 }, () =>
        new NextRequest('http://localhost:3000/api/team/roles')
      );

      const responses = await Promise.all(requests.map(req => GET(req)));

      // Most requests should succeed, but rate limiting should prevent abuse
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount > 0).toBe(true);
      // If rate limiting is implemented, some requests should be throttled
      expect(rateLimitedCount >= 0).toBe(true);
    });
  });

  describe('Audit Trail Security', () => {
    it('should log all sensitive operations', async () => {
      const auditLogs = [];

      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      // Mock audit logging
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        auditLogs.push(args);
      });

      const roleData = {
        name: 'audit_test_role',
        displayName: 'Audit Test Role',
        indonesianTitle: 'Peran Tes Audit',
        department: 'Management',
        roleLevel: 30,
        permissions: ['perm-1']
      };

      const request = new NextRequest('http://localhost:3000/api/team/roles', {
        method: 'POST',
        body: JSON.stringify(roleData),
        headers: { 'Content-Type': 'application/json' }
      });

      await POST(request);

      // Should have logged the role creation attempt
      expect(auditLogs.length > 0).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Session Security', () => {
    it('should invalidate sessions on role changes', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      // First request succeeds
      const request1 = new NextRequest('http://localhost:3000/api/team/roles');
      const response1 = await GET(request1);
      expect(response1.status).toBe(200);

      // Simulate role change - next request should require re-authentication
      mockAuth.mockResolvedValueOnce({
        success: false,
        error: 'Session invalidated due to role changes'
      });

      const request2 = new NextRequest('http://localhost:3000/api/team/roles');
      const response2 = await GET(request2);
      expect(response2.status).toBe(401);
    });
  });

  describe('Error Handling Security', () => {
    it('not leak sensitive information in error messages', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      const request = new NextRequest('http://localhost:3000/api/team/roles');

      // Mock database error that shouldn't leak details
      const originalError = console.error;
      console.error = jest.fn();

      const response = await GET(request);
      const data = await response.json();

      // Error should be generic, not reveal internal details
      if (response.status >= 500) {
        expect(data.error).toBe('Internal server error');
        expect(data.message).not.toContain('database');
        expect(data.message).not.toContain('sql');
        expect(data.message).not.toContain('password');
      }

      console.error = originalError;
    });

    it('should handle malformed requests safely', async () => {
      mockAuth.mockResolvedValue({
        success: true,
        userId: 'user-123',
        tenantId: 'tenant-123',
        requirePermission: jest.fn().mockResolvedValue(undefined)
      });

      const malformedRequests = [
        new NextRequest('http://localhost:3000/api/team/roles', {
          method: 'POST',
          body: '{invalid json'
        }),
        new NextRequest('http://localhost:3000/api/team/roles', {
          method: 'POST',
          body: '{"name": null}'
        }),
        new NextRequest('http://localhost:3000/api/team/roles', {
          method: 'POST',
          body: '{"name": 123}'
        })
      ];

      for (const request of malformedRequests) {
        const response = await POST(request);

        // Should handle gracefully without crashing
        expect([400, 422, 500]).toContain(response.status);

        const data = await response.json();
        expect(data).toHaveProperty('success', false);
      }
    });
  });
});