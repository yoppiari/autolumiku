import request from 'supertest';
import { app } from '@/app';
import { fileStorageCompleteService } from '@/services/file-storage-complete.service';
import { brandingService } from '@/services/branding.service';
import { TenantBranding } from '@/types/tenant-branding';
import { setupTestDatabase, cleanupTestDatabase } from '@/tests/helpers/database';

describe('Branding Service Integration Tests', () => {
  let testTenantId: string;
  let authToken: string;

  beforeAll(async () => {
    // Setup test database and create test tenant
    await setupTestDatabase();
    testTenantId = 'test-tenant-' + Date.now();

    // Create auth token for testing
    authToken = 'Bearer test-jwt-token';
  });

  afterAll(async () => {
    // Cleanup test database
    await cleanupTestDatabase();
  });

  describe('POST /api/branding', () => {
    it('should create tenant branding configuration', async () => {
      const brandingData = {
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        companyName: 'Test Showroom',
        website: 'https://testshowroom.com',
        email: 'contact@testshowroom.com',
        phone: '+62812345678'
      };

      const response = await request(app)
        .post('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId)
        .send(brandingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.primaryColor).toBe(brandingData.primaryColor);
      expect(response.body.data.companyName).toBe(brandingData.companyName);
      expect(response.body.data.tenantId).toBe(testTenantId);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        primaryColor: 'invalid-color',
        companyName: ''
      };

      const response = await request(app)
        .post('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('GET /api/branding', () => {
    it('should retrieve tenant branding configuration', async () => {
      const response = await request(app)
        .get('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('primaryColor');
      expect(response.body.data).toHaveProperty('companyName');
      expect(response.body.data.tenantId).toBe(testTenantId);
    });

    it('should return 404 for non-existent tenant', async () => {
      const response = await request(app)
        .get('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', 'non-existent-tenant')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('PUT /api/branding', () => {
    it('should update tenant branding configuration', async () => {
      const updateData = {
        primaryColor: '#dc2626',
        companyName: 'Updated Test Showroom'
      };

      const response = await request(app)
        .put('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.primaryColor).toBe(updateData.primaryColor);
      expect(response.body.data.companyName).toBe(updateData.companyName);
    });
  });

  describe('POST /api/branding/logo', () => {
    it('should upload and process logo image', async () => {
      // Create test image buffer
      const testImageBuffer = Buffer.from('fake-image-data');

      const response = await request(app)
        .post('/api/branding/logo')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId)
        .attach('logo', testImageBuffer, 'test-logo.png')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('logoUrl');
      expect(response.body.data).toHaveProperty('presignedUrl');
      expect(response.body.data.metadata.width).toBeGreaterThan(0);
      expect(response.body.data.metadata.height).toBeGreaterThan(0);
    });

    it('should validate file types and sizes', async () => {
      // Test invalid file type
      const invalidFileBuffer = Buffer.from('fake-file-data');

      const response = await request(app)
        .post('/api/branding/logo')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId)
        .attach('logo', invalidFileBuffer, 'test.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('file type');
    });
  });

  describe('GET /api/branding/preview', () => {
    it('should generate branding preview', async () => {
      const response = await request(app)
        .get('/api/branding/preview')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('previewHtml');
      expect(response.body.data.previewHtml).toContain('Test Showroom');
    });
  });

  describe('File Storage Integration', () => {
    it('should generate responsive image sizes', async () => {
      const testImageBuffer = Buffer.from('fake-large-image-data');

      const result = await fileStorageCompleteService.generateResponsiveImages(
        testImageBuffer,
        'test-logo.png',
        'image/png',
        testTenantId
      );

      expect(result).toHaveLength(4); // small, medium, large, xl
      expect(result[0]).toHaveProperty('key');
      expect(result[0]).toHaveProperty('presignedUrl');
      expect(result[0].metadata.width).toBeLessThanOrEqual(320);
    });

    it('should generate favicon from uploaded image', async () => {
      const testImageBuffer = Buffer.from('fake-favicon-source');

      const result = await fileStorageCompleteService.generateFavicon(
        testImageBuffer,
        testTenantId
      );

      expect(result.mimeType).toBe('image/x-icon');
      expect(result.metadata.width).toBe(32);
      expect(result.metadata.height).toBe(32);
      expect(result.key).toContain('favicon');
    });

    it('should generate secure presigned URLs', async () => {
      const testKey = `test/${testTenantId}/presigned-test.jpg`;

      const presignedUrl = await fileStorageCompleteService.generatePresignedUrl(
        testKey,
        1800 // 30 minutes
      );

      expect(presignedUrl).toContain('AWS4-HMAC-SHA256');
      expect(presignedUrl).toContain('X-Amz-Expires=1800');
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache when branding updates', async () => {
      // First, get branding to populate cache
      await request(app)
        .get('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId);

      // Update branding
      await request(app)
        .put('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId)
        .send({ primaryColor: '#10b981' });

      // Get branding again to verify cache was invalidated
      const response = await request(app)
        .get('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId);

      expect(response.body.data.primaryColor).toBe('#10b981');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Simulate database error by using invalid tenant ID format
      const response = await request(app)
        .get('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', '')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle file upload errors gracefully', async () => {
      const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB buffer

      const response = await request(app)
        .post('/api/branding/logo')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId)
        .attach('logo', oversizedBuffer, 'oversized.png')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('size');
    });
  });

  describe('Security Tests', () => {
    it('should prevent cross-tenant data access', async () => {
      const otherTenantId = 'other-tenant-' + Date.now();

      // Try to access branding for different tenant
      const response = await request(app)
        .get('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', otherTenantId)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate JWT token', async () => {
      const response = await request(app)
        .get('/api/branding')
        .set('X-Tenant-ID', testTenantId)
        // Missing Authorization header
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('unauthorized');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get('/api/branding')
            .set('Authorization', authToken)
            .set('X-Tenant-ID', testTenantId)
        );
      }

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/branding')
        .set('Authorization', authToken)
        .set('X-Tenant-ID', testTenantId);

      const responseTime = Date.now() - startTime;

      // Should respond within 500ms
      expect(responseTime).toBeLessThan(500);
    });
  });
});