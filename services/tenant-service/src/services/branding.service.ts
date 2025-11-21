/**
 * Tenant Branding Service
 *
 * Handles all business logic for tenant branding configuration including
 * CRUD operations, file management, cache invalidation, and theme generation.
 */

import { Pool } from 'pg';
import {
  TenantBranding,
  CreateBrandingRequest,
  UpdateBrandingRequest,
  BrandingPreview,
  TenantBrandingRow,
  TenantBrandingMapper,
  BrandingValidator,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  CSSVariables
} from '../models/tenant-branding.model';
import { FileStorageService } from './file-storage.service';
import { CacheService } from './cache.service';
import { Logger } from '../utils/logger';

export class BrandingService {
  constructor(
    private readonly db: Pool,
    private readonly fileStorage: FileStorageService,
    private readonly cache: CacheService,
    private readonly logger: Logger
  ) {}

  /**
   * Get branding configuration for a tenant
   */
  async getBrandingByTenantId(tenantId: string): Promise<TenantBranding | null> {
    this.logger.info('Getting branding for tenant', { tenantId });

    try {
      // Try cache first
      const cached = await this.cache.get(`branding:${tenantId}`);
      if (cached) {
        this.logger.debug('Branding found in cache', { tenantId });
        return JSON.parse(cached);
      }

      // Query database
      const query = `
        SELECT * FROM tenant_branding
        WHERE tenant_id = $1
      `;

      const result = await this.db.query(query, [tenantId]);

      if (result.rows.length === 0) {
        this.logger.warn('No branding found for tenant', { tenantId });
        return null;
      }

      const branding = TenantBrandingMapper.fromRow(result.rows[0]);

      // Cache the result
      await this.cache.set(`branding:${tenantId}`, JSON.stringify(branding), 3600); // 1 hour

      this.logger.info('Branding retrieved successfully', { tenantId, brandingId: branding.id });
      return branding;

    } catch (error) {
      this.logger.error('Failed to get branding', { tenantId, error: error.message });
      throw new Error(`Failed to retrieve branding: ${error.message}`);
    }
  }

  /**
   * Create branding configuration for a tenant
   */
  async createBranding(request: CreateBrandingRequest): Promise<TenantBranding> {
    this.logger.info('Creating branding for tenant', { tenantId: request.tenantId });

    // Validate request
    const validation = BrandingValidator.validateBrandingRequest(request);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Set default colors if not provided
    const primaryColor = request.primaryColor || DEFAULT_PRIMARY_COLOR;
    const secondaryColor = request.secondaryColor || DEFAULT_SECONDARY_COLOR;

    // Validate color contrast
    const contrastCheck = BrandingValidator.validateColorContrast(primaryColor, secondaryColor);
    if (!contrastCheck.isAccessible) {
      this.logger.warn('Color contrast does not meet accessibility standards', {
        tenantId: request.tenantId,
        ratio: contrastCheck.ratio,
        recommendation: contrastCheck.recommendation
      });
    }

    try {
      const query = `
        INSERT INTO tenant_branding (
          tenant_id, logo_url, favicon_url, primary_color, secondary_color,
          company_name, company_address, company_phone, company_email, company_website
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        request.tenantId,
        request.logoUrl,
        request.faviconUrl,
        primaryColor,
        secondaryColor,
        request.companyInfo.name,
        request.companyInfo.address,
        request.companyInfo.phone,
        request.companyInfo.email,
        request.companyInfo.website
      ];

      const result = await this.db.query(query, values);
      const branding = TenantBrandingMapper.fromRow(result.rows[0]);

      // Invalidate cache
      await this.invalidateCache(request.tenantId);

      // Generate theme CSS
      await this.generateThemeCSS(branding);

      this.logger.info('Branding created successfully', {
        tenantId: request.tenantId,
        brandingId: branding.id
      });

      return branding;

    } catch (error) {
      this.logger.error('Failed to create branding', {
        tenantId: request.tenantId,
        error: error.message
      });

      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Branding configuration already exists for this tenant');
      }

      throw new Error(`Failed to create branding: ${error.message}`);
    }
  }

  /**
   * Update branding configuration for a tenant
   */
  async updateBranding(tenantId: string, request: UpdateBrandingRequest): Promise<TenantBranding> {
    this.logger.info('Updating branding for tenant', { tenantId });

    // Get existing branding
    const existing = await this.getBrandingByTenantId(tenantId);
    if (!existing) {
      throw new Error('Branding configuration not found for this tenant');
    }

    // Merge with existing data
    const mergedRequest: CreateBrandingRequest = {
      tenantId,
      logoUrl: request.logoUrl ?? existing.logoUrl,
      faviconUrl: request.faviconUrl ?? existing.faviconUrl,
      primaryColor: request.primaryColor ?? existing.primaryColor,
      secondaryColor: request.secondaryColor ?? existing.secondaryColor,
      companyInfo: {
        ...existing.companyInfo,
        ...request.companyInfo
      }
    };

    // Validate merged request
    const validation = BrandingValidator.validateBrandingRequest(mergedRequest);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Validate color contrast if colors changed
    if (request.primaryColor || request.secondaryColor) {
      const contrastCheck = BrandingValidator.validateColorContrast(
        mergedRequest.primaryColor!,
        mergedRequest.secondaryColor!
      );

      if (!contrastCheck.isAccessible) {
        this.logger.warn('Updated color contrast does not meet accessibility standards', {
          tenantId,
          ratio: contrastCheck.ratio,
          recommendation: contrastCheck.recommendation
        });
      }
    }

    try {
      const row = TenantBrandingMapper.toRow(request);
      const fields = Object.keys(row).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = Object.values(row);

      const query = `
        UPDATE tenant_branding
        SET ${fields}, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
        RETURNING *
      `;

      const result = await this.db.query(query, [tenantId, ...values]);
      const branding = TenantBrandingMapper.fromRow(result.rows[0]);

      // Invalidate cache
      await this.invalidateCache(tenantId);

      // Generate theme CSS
      await this.generateThemeCSS(branding);

      this.logger.info('Branding updated successfully', {
        tenantId,
        brandingId: branding.id
      });

      return branding;

    } catch (error) {
      this.logger.error('Failed to update branding', {
        tenantId,
        error: error.message
      });
      throw new Error(`Failed to update branding: ${error.message}`);
    }
  }

  /**
   * Upload logo for tenant
   */
  async uploadLogo(tenantId: string, file: Buffer, filename: string, mimeType: string): Promise<string> {
    this.logger.info('Uploading logo for tenant', { tenantId, filename, mimeType });

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!allowedTypes.includes(mimeType)) {
      throw new Error('Invalid file type. Only PNG, JPG, and SVG files are allowed');
    }

    // Validate file size (5MB limit)
    if (file.length > 5 * 1024 * 1024) {
      throw new Error('File size too large. Maximum size is 5MB');
    }

    try {
      // Generate unique filename
      const extension = filename.split('.').pop();
      const uniqueFilename = `logo-${Date.now()}.${extension}`;
      const key = `tenants/${tenantId}/branding/${uniqueFilename}`;

      // Upload to S3
      const url = await this.fileStorage.uploadFile(key, file, mimeType, {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000' // 1 year
      });

      // Update branding with new logo URL
      await this.updateBranding(tenantId, { logoUrl: url });

      this.logger.info('Logo uploaded successfully', { tenantId, url });
      return url;

    } catch (error) {
      this.logger.error('Failed to upload logo', {
        tenantId,
        filename,
        error: error.message
      });
      throw new Error(`Failed to upload logo: ${error.message}`);
    }
  }

  /**
   * Upload favicon for tenant
   */
  async uploadFavicon(tenantId: string, file: Buffer, filename: string, mimeType: string): Promise<string> {
    this.logger.info('Uploading favicon for tenant', { tenantId, filename, mimeType });

    // Validate file type (favicon should be ICO or PNG)
    const allowedTypes = ['image/x-icon', 'image/png'];
    if (!allowedTypes.includes(mimeType)) {
      throw new Error('Invalid file type. Only ICO and PNG files are allowed for favicon');
    }

    // Validate file size (1MB limit for favicon)
    if (file.length > 1024 * 1024) {
      throw new Error('File size too large. Maximum size is 1MB');
    }

    try {
      // Generate unique filename
      const extension = mimeType === 'image/x-icon' ? 'ico' : 'png';
      const uniqueFilename = `favicon-${Date.now()}.${extension}`;
      const key = `tenants/${tenantId}/branding/${uniqueFilename}`;

      // Upload to S3
      const url = await this.fileStorage.uploadFile(key, file, mimeType, {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000' // 1 year
      });

      // Update branding with new favicon URL
      await this.updateBranding(tenantId, { faviconUrl: url });

      this.logger.info('Favicon uploaded successfully', { tenantId, url });
      return url;

    } catch (error) {
      this.logger.error('Failed to upload favicon', {
        tenantId,
        filename,
        error: error.message
      });
      throw new Error(`Failed to upload favicon: ${error.message}`);
    }
  }

  /**
   * Generate branding preview
   */
  async generateBrandingPreview(tenantId: string, request: UpdateBrandingRequest): Promise<BrandingPreview> {
    this.logger.info('Generating branding preview for tenant', { tenantId });

    // Get existing branding
    const existing = await this.getBrandingByTenantId(tenantId);
    if (!existing) {
      throw new Error('Branding configuration not found for this tenant');
    }

    // Merge with preview data
    const previewBranding: TenantBranding = {
      ...existing,
      ...request,
      companyInfo: {
        ...existing.companyInfo,
        ...request.companyInfo
      }
    };

    // Generate CSS variables
    const cssVariables = this.generateCSSVariables(previewBranding);

    // Generate preview HTML
    const previewHtml = this.generatePreviewHTML(previewBranding);

    this.logger.info('Branding preview generated', { tenantId });
    return {
      logoUrl: previewBranding.logoUrl,
      faviconUrl: previewBranding.faviconUrl,
      primaryColor: previewBranding.primaryColor,
      secondaryColor: previewBranding.secondaryColor,
      companyInfo: previewBranding.companyInfo,
      cssVariables,
      previewHtml
    };
  }

  /**
   * Generate CSS variables for theme
   */
  private generateCSSVariables(branding: TenantBranding): CSSVariables {
    return {
      '--tenant-primary': branding.primaryColor,
      '--tenant-secondary': branding.secondaryColor,
      '--tenant-logo': branding.logoUrl || '',
      '--tenant-favicon': branding.faviconUrl || ''
    };
  }

  /**
   * Generate theme CSS file
   */
  private async generateThemeCSS(branding: TenantBranding): Promise<void> {
    const cssVariables = this.generateCSSVariables(branding);
    const css = `
/* Tenant Theme: ${branding.tenantId} */
/* Generated: ${new Date().toISOString()} */

:root {
  --tenant-primary: ${cssVariables['--tenant-primary']};
  --tenant-secondary: ${cssVariables['--tenant-secondary']};
  --tenant-logo: ${cssVariables['--tenant-logo']};
  --tenant-favicon: ${cssVariables['--tenant-favicon']};
}

.tenant-${branding.tenantId} {
  --primary-color: var(--tenant-primary);
  --secondary-color: var(--tenant-secondary);
  --logo-url: var(--tenant-logo);
  --favicon-url: var(--tenant-favicon);
}

/* Component-specific styling */
.tenant-${branding.tenantId} .header {
  background-color: var(--primary-color);
}

.tenant-${branding.tenantId} .btn-primary {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}

.tenant-${branding.tenantId} .btn-secondary {
  background-color: var(--secondary-color);
  border-color: var(--secondary-color);
}

.tenant-${branding.tenantId} .logo {
  content: var(--logo-url);
}
`;

    // Upload CSS to S3
    const key = `tenants/${branding.tenantId}/branding/theme.css`;
    await this.fileStorage.uploadFile(key, Buffer.from(css), 'text/css', {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=3600' // 1 hour
    });

    this.logger.info('Theme CSS generated', { tenantId: branding.tenantId, key });
  }

  /**
   * Generate preview HTML
   */
  private generatePreviewHTML(branding: TenantBranding): string {
    const cssVariables = this.generateCSSVariables(branding);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${branding.companyInfo.name} - Branding Preview</title>
    <style>
        :root {
            --tenant-primary: ${cssVariables['--tenant-primary']};
            --tenant-secondary: ${cssVariables['--tenant-secondary']};
            --tenant-logo: ${cssVariables['--tenant-logo']};
        }

        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .preview-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background-color: var(--tenant-primary);
            color: white;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .logo {
            width: 48px;
            height: 48px;
            background: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: var(--tenant-primary);
        }

        .company-name {
            font-size: 24px;
            font-weight: bold;
        }

        .content {
            padding: 20px;
        }

        .company-info {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            margin-right: 8px;
        }

        .btn-primary {
            background-color: var(--tenant-primary);
            color: white;
        }

        .btn-secondary {
            background-color: var(--tenant-secondary);
            color: white;
        }

        .footer {
            background-color: var(--tenant-secondary);
            color: white;
            padding: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="preview-container">
        <div class="header">
            <div class="logo">
                ${branding.logoUrl ?
                  `<img src="${branding.logoUrl}" alt="Logo" style="max-width: 40px; max-height: 40px;">` :
                  branding.companyInfo.name.charAt(0).toUpperCase()
                }
            </div>
            <div class="company-name">${branding.companyInfo.name}</div>
        </div>

        <div class="content">
            <div class="company-info">
                <h3>Company Information</h3>
                <p><strong>Name:</strong> ${branding.companyInfo.name}</p>
                ${branding.companyInfo.address ? `<p><strong>Address:</strong> ${branding.companyInfo.address}</p>` : ''}
                ${branding.companyInfo.phone ? `<p><strong>Phone:</strong> ${branding.companyInfo.phone}</p>` : ''}
                ${branding.companyInfo.email ? `<p><strong>Email:</strong> ${branding.companyInfo.email}</p>` : ''}
                ${branding.companyInfo.website ? `<p><strong>Website:</strong> <a href="${branding.companyInfo.website}" style="color: var(--tenant-primary)">${branding.companyInfo.website}</a></p>` : ''}
            </div>

            <h3>Color Scheme</h3>
            <div style="display: flex; gap: 16px; margin-bottom: 20px;">
                <div style="text-align: center;">
                    <div style="width: 80px; height: 80px; background-color: var(--tenant-primary); border-radius: 8px; margin-bottom: 8px;"></div>
                    <small>Primary<br>${branding.primaryColor}</small>
                </div>
                <div style="text-align: center;">
                    <div style="width: 80px; height: 80px; background-color: var(--tenant-secondary); border-radius: 8px; margin-bottom: 8px;"></div>
                    <small>Secondary<br>${branding.secondaryColor}</small>
                </div>
            </div>

            <h3>Button Examples</h3>
            <button class="btn btn-primary">Primary Button</button>
            <button class="btn btn-secondary">Secondary Button</button>
        </div>

        <div class="footer">
            <p>&copy; 2025 ${branding.companyInfo.name}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Invalidate cache for tenant branding
   */
  private async invalidateCache(tenantId: string): Promise<void> {
    const keys = [
      `branding:${tenantId}`,
      `branding:${tenantId}:css`,
      `branding:${tenantId}:preview`
    ];

    await Promise.all(keys.map(key => this.cache.delete(key)));
    this.logger.debug('Cache invalidated', { tenantId, keys });
  }

  /**
   * Delete branding configuration (soft delete by setting to defaults)
   */
  async deleteBranding(tenantId: string): Promise<void> {
    this.logger.info('Deleting branding for tenant', { tenantId });

    try {
      // Set to default values instead of deleting
      await this.updateBranding(tenantId, {
        logoUrl: undefined,
        faviconUrl: undefined,
        primaryColor: DEFAULT_PRIMARY_COLOR,
        secondaryColor: DEFAULT_SECONDARY_COLOR,
        companyInfo: {
          name: 'Default Company Name'
        }
      });

      this.logger.info('Branding reset to defaults', { tenantId });

    } catch (error) {
      this.logger.error('Failed to delete branding', {
        tenantId,
        error: error.message
      });
      throw new Error(`Failed to delete branding: ${error.message}`);
    }
  }
}