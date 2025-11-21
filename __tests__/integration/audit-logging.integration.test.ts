/**
 * Integration Tests for Audit Logging Service
 * Story 1.10: Audit Logging for Compliance
 *
 * These tests verify end-to-end functionality including:
 * - Authentication and authorization
 * - Database operations with tenant isolation
 * - Input validation and sanitization
 * - Compliance report generation
 * - Export functionality
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../../src/app'; // Adjust path to your Express app

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

/**
 * Test data and utilities
 */
let testTenantId: string;
let testUserId: string;
let testAdminUserId: string;
let authToken: string;
let adminAuthToken: string;

/**
 * Generate test JWT token
 */
function generateTestToken(userId: string, tenantId: string, permissions: string[]): string {
  return jwt.sign(
    {
      userId,
      tenantId,
      email: `test-${userId}@example.com`,
      role: 'tenant_admin',
      permissions,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Setup: Create test database records
 */
beforeAll(async () => {
  // Create test tenant
  const tenant = await prisma.tenant.create({
    data: {
      id: 'test-tenant-' + Date.now(),
      name: 'Test Showroom',
      slug: 'test-showroom-' + Date.now(),
      contactEmail: 'test@showroom.com',
      status: 'ACTIVE',
      subscriptionTier: 'PREMIUM',
    },
  });
  testTenantId = tenant.id;

  // Create test users
  const user = await prisma.user.create({
    data: {
      id: 'test-user-' + Date.now(),
      email: 'testuser@example.com',
      firstName: 'Test',
      lastName: 'User',
      tenantId: testTenantId,
      role: 'TENANT_ADMIN',
      passwordHash: 'hashed_password',
    },
  });
  testUserId = user.id;

  const adminUser = await prisma.user.create({
    data: {
      id: 'test-admin-' + Date.now(),
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      tenantId: testTenantId,
      role: 'PLATFORM_ADMIN',
      passwordHash: 'hashed_password',
    },
  });
  testAdminUserId = adminUser.id;

  // Generate auth tokens
  authToken = generateTestToken(testUserId, testTenantId, ['audit.view', 'audit.export']);
  adminAuthToken = generateTestToken(testAdminUserId, testTenantId, [
    'audit.view',
    'audit.manage',
    'audit.export',
  ]);

  // Create some test audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: testTenantId,
        userId: testUserId,
        action: 'USER_LOGIN',
        entityType: 'USER',
        entityId: testUserId,
        description: 'User logged in successfully',
        severity: 'LOW',
        category: 'AUTHENTICATION',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        metadata: {},
        isCompliance: false,
      },
      {
        tenantId: testTenantId,
        userId: testUserId,
        action: 'VEHICLE_CREATE',
        entityType: 'VEHICLE',
        entityId: 'vehicle-123',
        description: 'Created new vehicle listing',
        severity: 'MEDIUM',
        category: 'DATA_ACCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        metadata: { vehicleType: 'sedan' },
        isCompliance: true,
      },
      {
        tenantId: testTenantId,
        userId: testUserId,
        action: 'SECURITY_BREACH_ATTEMPT',
        entityType: 'SECURITY',
        entityId: 'security-001',
        description: 'Failed login attempt detected',
        severity: 'CRITICAL',
        category: 'SECURITY_EVENT',
        ipAddress: '192.168.1.100',
        userAgent: 'Malicious Agent',
        metadata: { attempts: 5 },
        isCompliance: true,
      },
    ],
  });
});

/**
 * Teardown: Clean up test data
 */
afterAll(async () => {
  // Delete test data in correct order (foreign key constraints)
  await prisma.auditLog.deleteMany({ where: { tenantId: testTenantId } });
  await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
  await prisma.tenant.delete({ where: { id: testTenantId } });

  await prisma.$disconnect();
});

/**
 * Test Suite: Authentication and Authorization
 */
describe('Audit Logging API - Authentication', () => {
  test('should reject requests without authentication token', async () => {
    const response = await request(app).get('/api/audit/logs').query({ tenantId: testTenantId });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  test('should reject requests with invalid token', async () => {
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', 'Bearer invalid-token')
      .set('x-tenant-id', testTenantId);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  test('should reject requests without required permissions', async () => {
    // Token without audit.view permission
    const limitedToken = generateTestToken(testUserId, testTenantId, ['vehicle.create']);

    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${limitedToken}`)
      .set('x-tenant-id', testTenantId);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error');
  });

  test('should allow requests with valid authentication and permissions', async () => {
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
  });
});

/**
 * Test Suite: Query Audit Logs
 */
describe('Audit Logging API - Query Logs', () => {
  test('should query audit logs with basic filters', async () => {
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .query({
        limit: 10,
        offset: 0,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('logs');
    expect(response.body.data).toHaveProperty('total');
    expect(Array.isArray(response.body.data.logs)).toBe(true);
  });

  test('should filter logs by severity', async () => {
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .query({
        severity: 'CRITICAL',
        limit: 10,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.logs.every((log: any) => log.severity === 'CRITICAL')).toBe(true);
  });

  test('should filter logs by category', async () => {
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .query({
        category: 'AUTHENTICATION',
        limit: 10,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.logs.every((log: any) => log.category === 'AUTHENTICATION')).toBe(
      true
    );
  });

  test('should filter logs by date range', async () => {
    const startDate = new Date('2024-01-01').toISOString();
    const endDate = new Date().toISOString();

    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .query({
        startDate,
        endDate,
        limit: 10,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should reject invalid severity values', async () => {
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .query({
        severity: 'INVALID_SEVERITY',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('should reject invalid date formats', async () => {
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .query({
        startDate: 'not-a-date',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('should sanitize searchTerm input', async () => {
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .query({
        searchTerm: '<script>alert("XSS")</script>',
      });

    // Should not cause error, should sanitize input
    expect(response.status).toBe(200);
  });
});

/**
 * Test Suite: Tenant Isolation
 */
describe('Audit Logging API - Tenant Isolation', () => {
  test('should only return logs for authenticated tenant', async () => {
    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .query({ limit: 100 });

    expect(response.status).toBe(200);
    expect(response.body.data.logs.every((log: any) => log.tenantId === testTenantId)).toBe(true);
  });

  test('should reject requests with mismatched tenant ID', async () => {
    const otherTenantToken = generateTestToken(testUserId, 'other-tenant-id', ['audit.view']);

    const response = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .set('x-tenant-id', testTenantId); // Different from token

    expect(response.status).toBe(403);
  });
});

/**
 * Test Suite: Compliance Reporting
 */
describe('Audit Logging API - Compliance Reports', () => {
  test('should generate PDPA compliance report', async () => {
    const response = await request(app)
      .post('/api/audit/reports/compliance')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .set('x-tenant-id', testTenantId)
      .send({
        reportType: 'PDPA_COMPLIANCE',
        periodStart: new Date('2024-01-01').toISOString(),
        periodEnd: new Date().toISOString(),
        format: 'PDF',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('reportId');
  });

  test('should reject invalid report type', async () => {
    const response = await request(app)
      .post('/api/audit/reports/compliance')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .set('x-tenant-id', testTenantId)
      .send({
        reportType: 'INVALID_TYPE',
        periodStart: new Date('2024-01-01').toISOString(),
        periodEnd: new Date().toISOString(),
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('should reject missing required fields', async () => {
    const response = await request(app)
      .post('/api/audit/reports/compliance')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .set('x-tenant-id', testTenantId)
      .send({
        reportType: 'PDPA_COMPLIANCE',
        // Missing periodStart and periodEnd
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});

/**
 * Test Suite: Export Functionality
 */
describe('Audit Logging API - Export', () => {
  test('should export logs as CSV', async () => {
    const response = await request(app)
      .post('/api/audit/export')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .send({
        format: 'CSV',
        startDate: new Date('2024-01-01').toISOString(),
        endDate: new Date().toISOString(),
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment');
  });

  test('should export logs as JSON', async () => {
    const response = await request(app)
      .post('/api/audit/export')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .send({
        format: 'JSON',
        startDate: new Date('2024-01-01').toISOString(),
        endDate: new Date().toISOString(),
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
  });

  test('should reject invalid export format', async () => {
    const response = await request(app)
      .post('/api/audit/export')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .send({
        format: 'INVALID_FORMAT',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});

/**
 * Test Suite: Security Dashboard
 */
describe('Audit Logging API - Security Dashboard', () => {
  test('should get security dashboard data', async () => {
    const response = await request(app)
      .get('/api/audit/security/dashboard')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .set('x-tenant-id', testTenantId);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('recentAlerts');
    expect(response.body.data).toHaveProperty('securityMetrics');
  });
});

/**
 * Test Suite: Audit Summary
 */
describe('Audit Logging API - Summary Statistics', () => {
  test('should get audit summary for date range', async () => {
    const response = await request(app)
      .get('/api/audit/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenantId)
      .query({
        startDate: new Date('2024-01-01').toISOString(),
        endDate: new Date().toISOString(),
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('totalLogs');
    expect(response.body.data).toHaveProperty('bySeverity');
    expect(response.body.data).toHaveProperty('byCategory');
  });
});
