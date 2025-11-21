/**
 * Integration Tests for Branding Service
 *
 * Tests the branding service with real database connections
 */

import { Pool } from 'pg';
import { BrandingService } from '../../src/services/branding.service';
import { FileStorageService } from '../../src/services/file-storage.service';
import { CacheService } from '../../src/services/cache.service';
import { Logger } from '../../src/utils/logger';
import { CreateBrandingRequest, UpdateBrandingRequest } from '../../src/models/tenant-branding.model';

// Mock external dependencies
jest.mock('../../src/services/file-storage.service');
jest.mock('../../src/services/cache.service');

const MockFileStorageService = FileStorageService as jest.MockedClass<typeof FileStorageService>;
const MockCacheService = CacheService as jest.MockedClass<typeof CacheService>;

describe('BrandingService Integration', () => {
  let brandingService: BrandingService;
  let db: Pool;
  let mockFileStorage: jest.Mocked<FileStorageService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockLogger: jest.Mocked<Logger>;

  const testTenantId = 'test-tenant-123';
  const testBranding: CreateBrandingRequest = {
    tenantId: testTenantId,
    primaryColor: '#FF5733',
    secondaryColor: '#33FF57',
    companyInfo: {
      name: 'Test Company',
      address: '123 Test Street',
      phone: '+628123456789',
      email: 'test@example.com',
      website: 'https://example.com'
    }
  };

  beforeAll(async () => {
    // Setup test database connection
    db = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'autolumiku_test',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'password',
    });

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Mock file storage service
    mockFileStorage = new MockFileStorageService({}, mockLogger) as jest.Mocked<FileStorageService>;
    mockFileStorage.uploadFile = jest.fn().mockResolvedValue('https://test-bucket.s3.amazonaws.com/test-logo.png');

    // Mock cache service
    mockCache = new MockCacheService({}, mockLogger) as jest.Mocked<CacheService>;
    mockCache.get = jest.fn().mockResolvedValue(null);
    mockCache.set = jest.fn().mockResolvedValue(undefined);
    mockCache.delete = jest.fn().mockResolvedValue(true);

    // Create branding service
    brandingService = new BrandingService(db, mockFileStorage, mockCache, mockLogger);

    // Setup test database schema
    await setupTestDatabase();
  });

  afterAll(async () => {
    // Clean up test database
    await cleanupTestDatabase();
    await db.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.query('DELETE FROM tenant_branding WHERE tenant_id = $1', [testTenantId]);

    // Reset mocks
    jest.clearAllMocks();
  });

  async function setupTestDatabase() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tenant_branding (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        logo_url VARCHAR(500),
        favicon_url VARCHAR(500),
        primary_color VARCHAR(7) DEFAULT '#3B82F6',
        secondary_color VARCHAR(7) DEFAULT '#64748B',
        company_name VARCHAR(255) NOT NULL,
        company_address TEXT,
        company_phone VARCHAR(20),
        company_email VARCHAR(255),
        company_website VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_tenant_branding UNIQUE(tenant_id)
      );
    `;

    await db.query(createTableQuery);
  }

  async function cleanupTestDatabase() {
    await db.query('DROP TABLE IF EXISTS tenant_branding');
  }

  describe('createBranding', () => {
    it('should create branding configuration successfully', async () => {
      const result = await brandingService.createBranding(testBranding);

      expect(result).toBeDefined();
      expect(result.tenantId).toBe(testTenantId);
      expect(result.primaryColor).toBe(testBranding.primaryColor);
      expect(result.secondaryColor).toBe(testBranding.secondaryColor);
      expect(result.companyInfo.name).toBe(testBranding.companyInfo.name);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      // Verify cache invalidation
      expect(mockCache.delete).toHaveBeenCalled();
    });

    it('should set default colors when not provided', async () => {
      const brandingWithoutColors = {
        ...testBranding,
        primaryColor: undefined,
        secondaryColor: undefined
      };

      const result = await brandingService.createBranding(brandingWithoutColors);

      expect(result.primaryColor).toBe('#3B82F6'); // Default primary color
      expect(result.secondaryColor).toBe('#64748B'); // Default secondary color
    });

    it('should throw error for invalid tenant ID', async () => {
      const invalidBranding = { ...testBranding, tenantId: '' };

      await expect(brandingService.createBranding(invalidBranding))
        .rejects.toThrow('Validation failed');
    });

    it('should throw error for invalid hex colors', async () => {
      const invalidBranding = {
        ...testBranding,
        primaryColor: 'invalid-color'
      };

      await expect(brandingService.createBranding(invalidBranding))
        .rejects.toThrow('Validation failed');
    });

    it('should throw error for duplicate tenant branding', async () => {
      // Create first branding
      await brandingService.createBranding(testBranding);

      // Try to create again
      await expect(brandingService.createBranding(testBranding))
        .rejects.toThrow('Branding configuration already exists for this tenant');
    });
  });

  describe('getBrandingByTenantId', () => {
    it('should retrieve existing branding', async () => {
      // Create branding first
      const created = await brandingService.createBranding(testBranding);

      // Retrieve branding
      const retrieved = await brandingService.getBrandingByTenantId(testTenantId);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.tenantId).toBe(testTenantId);
      expect(retrieved!.companyInfo.name).toBe(testBranding.companyInfo.name);
    });

    it('should return null for non-existent branding', async () => {
      const result = await brandingService.getBrandingByTenantId('non-existent-tenant');
      expect(result).toBeNull();
    });

    it('should check cache first', async () => {
      // Mock cache hit
      const cachedBranding = { id: 'cached-id', tenantId: testTenantId } as any;
      mockCache.get.mockResolvedValueOnce(JSON.stringify(cachedBranding));

      const result = await brandingService.getBrandingByTenantId(testTenantId);

      expect(result).toEqual(cachedBranding);
      expect(mockCache.get).toHaveBeenCalledWith(`branding:${testTenantId}`);
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should cache database results', async () => {
      // Create branding
      await brandingService.createBranding(testBranding);

      // Clear mock history
      mockCache.get.mockResolvedValueOnce(null);

      // Retrieve branding
      await brandingService.getBrandingByTenantId(testTenantId);

      // Verify cache was set
      expect(mockCache.set).toHaveBeenCalledWith(
        `branding:${testTenantId}`,
        expect.any(String),
        3600
      );
    });
  });

  describe('updateBranding', () => {
    beforeEach(async () => {
      // Create branding to update
      await brandingService.createBranding(testBranding);
    });

    it('should update branding successfully', async () => {
      const updateData: UpdateBrandingRequest = {
        primaryColor: '#FF0000',
        companyInfo: {
          name: 'Updated Company Name'
        }
      };

      const result = await brandingService.updateBranding(testTenantId, updateData);

      expect(result.primaryColor).toBe(updateData.primaryColor);
      expect(result.companyInfo.name).toBe(updateData.companyInfo.name);
      expect(result.secondaryColor).toBe(testBranding.secondaryColor); // Should remain unchanged

      // Verify cache invalidation
      expect(mockCache.delete).toHaveBeenCalled();
    });

    it('should throw error for non-existent branding', async () => {
      await expect(brandingService.updateBranding('non-existent-tenant', {}))
        .rejects.toThrow('Branding configuration not found for this tenant');
    });

    it('should validate updated data', async () => {
      const invalidUpdate = { primaryColor: 'invalid-color' };

      await expect(brandingService.updateBranding(testTenantId, invalidUpdate))
        .rejects.toThrow('Validation failed');
    });
  });

  describe('uploadLogo', () => {
    beforeEach(async () => {
      await brandingService.createBranding(testBranding);
    });

    it('should upload logo successfully', async () => {
      const fileBuffer = Buffer.from('fake image data');
      const filename = 'logo.png';
      const mimeType = 'image/png';

      const result = await brandingService.uploadLogo(testTenantId, fileBuffer, filename, mimeType);

      expect(result).toBe('https://test-bucket.s3.amazonaws.com/test-logo.png');
      expect(mockFileStorage.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining(`tenants/${testTenantId}/branding/`),
        fileBuffer,
        mimeType,
        expect.any(Object)
      );
    });

    it('should validate file type', async () => {
      const fileBuffer = Buffer.from('fake file data');
      const filename = 'document.pdf';
      const mimeType = 'application/pdf';

      await expect(brandingService.uploadLogo(testTenantId, fileBuffer, filename, mimeType))
        .rejects.toThrow('Invalid file type');
    });

    it('should validate file size', async () => {
      const largeFileBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const filename = 'large-logo.png';
      const mimeType = 'image/png';

      await expect(brandingService.uploadLogo(testTenantId, largeFileBuffer, filename, mimeType))
        .rejects.toThrow('File size too large');
    });
  });

  describe('generateBrandingPreview', () => {
    beforeEach(async () => {
      await brandingService.createBranding(testBranding);
    });

    it('should generate preview successfully', async () => {
      const previewData: UpdateBrandingRequest = {
        primaryColor: '#FF0000'
      };

      const result = await brandingService.generateBrandingPreview(testTenantId, previewData);

      expect(result.primaryColor).toBe('#FF0000');
      expect(result.secondaryColor).toBe(testBranding.secondaryColor); // Should use existing
      expect(result.cssVariables).toBeDefined();
      expect(result.previewHtml).toContain('<!DOCTYPE html>');
      expect(result.previewHtml).toContain('#FF0000');
    });

    it('should throw error for non-existent branding', async () => {
      await expect(brandingService.generateBrandingPreview('non-existent-tenant', {}))
        .rejects.toThrow('Branding configuration not found for this tenant');
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate all cache keys on update', async () => {
      await brandingService.createBranding(testBranding);

      const updateData: UpdateBrandingRequest = { primaryColor: '#FF0000' };
      await brandingService.updateBranding(testTenantId, updateData);

      // Verify multiple cache keys were invalidated
      expect(mockCache.delete).toHaveBeenCalledTimes(3); // branding, branding:css, branding:preview
    });
  });

  describe('color contrast validation', () => {
    it('should warn about poor color contrast', async () => {
      const poorContrastBranding = {
        ...testBranding,
        primaryColor: '#CCCCCC',
        secondaryColor: '#DDDDDD'
      };

      // Should not throw error, but should log warning
      const result = await brandingService.createBranding(poorContrastBranding);

      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Color contrast does not meet accessibility standards',
        expect.objectContaining({
          tenantId: testTenantId,
          ratio: expect.any(Number),
        })
      );
    });
  });
});