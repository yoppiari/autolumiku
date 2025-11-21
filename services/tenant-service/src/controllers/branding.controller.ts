/**
 * Tenant Branding Controller
 *
 * Handles HTTP requests for tenant branding configuration.
 * Provides RESTful API endpoints for branding management.
 */

import { Request, Response } from 'express';
import { BrandingService } from '../services/branding.service';
import { CreateBrandingRequest, UpdateBrandingRequest } from '../models/tenant-branding.model';
import { Logger } from '../utils/logger';

export class BrandingController {
  constructor(
    private readonly brandingService: BrandingService,
    private readonly logger: Logger
  ) {}

  /**
   * GET /api/tenants/:tenantId/branding
   * Get branding configuration for a tenant
   */
  async getBranding(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    this.logger.info('Get branding request received', { tenantId, requestId });

    try {
      // Validate tenantId parameter
      if (!tenantId || typeof tenantId !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TENANT_ID',
            message: 'Valid tenant ID is required',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const branding = await this.brandingService.getBrandingByTenantId(tenantId);

      if (!branding) {
        res.status(404).json({
          success: false,
          error: {
            code: 'BRANDING_NOT_FOUND',
            message: 'Branding configuration not found for this tenant',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: branding,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      this.logger.error('Failed to get branding', { tenantId, requestId, error: error.message });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred while retrieving branding configuration',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * PUT /api/tenants/:tenantId/branding
   * Update branding configuration for a tenant
   */
  async updateBranding(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.params;
    const requestId = req.headers['x-request-id'] as string;
    const updateData: UpdateBrandingRequest = req.body;

    this.logger.info('Update branding request received', { tenantId, requestId });

    try {
      // Validate tenantId parameter
      if (!tenantId || typeof tenantId !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TENANT_ID',
            message: 'Valid tenant ID is required',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Validate request body
      if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'Request body cannot be empty',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const branding = await this.brandingService.updateBranding(tenantId, updateData);

      res.status(200).json({
        success: true,
        data: branding,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      this.logger.error('Failed to update branding', { tenantId, requestId, error: error.message });

      if (error.message.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.message,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'BRANDING_NOT_FOUND',
            message: 'Branding configuration not found for this tenant',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred while updating branding configuration',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * POST /api/tenants/:tenantId/branding
   * Create branding configuration for a tenant
   */
  async createBranding(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.params;
    const requestId = req.headers['x-request-id'] as string;
    const createData: CreateBrandingRequest = { ...req.body, tenantId };

    this.logger.info('Create branding request received', { tenantId, requestId });

    try {
      // Validate tenantId parameter
      if (!tenantId || typeof tenantId !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TENANT_ID',
            message: 'Valid tenant ID is required',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Validate request body
      if (!createData.companyInfo || !createData.companyInfo.name) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'Company information with name is required',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const branding = await this.brandingService.createBranding(createData);

      res.status(201).json({
        success: true,
        data: branding,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      this.logger.error('Failed to create branding', { tenantId, requestId, error: error.message });

      if (error.message.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.message,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: {
            code: 'BRANDING_EXISTS',
            message: 'Branding configuration already exists for this tenant',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred while creating branding configuration',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * POST /api/tenants/:tenantId/branding/logo
   * Upload logo for tenant
   */
  async uploadLogo(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    this.logger.info('Upload logo request received', { tenantId, requestId });

    try {
      // Check if file is uploaded
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'No file uploaded',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const file = req.file;
      const logoUrl = await this.brandingService.uploadLogo(
        tenantId,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      res.status(200).json({
        success: true,
        data: {
          logoUrl,
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      this.logger.error('Failed to upload logo', { tenantId, requestId, error: error.message });

      if (error.message.includes('Invalid file type') || error.message.includes('File size too large')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE',
            message: error.message,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred while uploading logo',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * POST /api/tenants/:tenantId/branding/favicon
   * Upload favicon for tenant
   */
  async uploadFavicon(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    this.logger.info('Upload favicon request received', { tenantId, requestId });

    try {
      // Check if file is uploaded
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'No file uploaded',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const file = req.file;
      const faviconUrl = await this.brandingService.uploadFavicon(
        tenantId,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      res.status(200).json({
        success: true,
        data: {
          faviconUrl,
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      this.logger.error('Failed to upload favicon', { tenantId, requestId, error: error.message });

      if (error.message.includes('Invalid file type') || error.message.includes('File size too large')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE',
            message: error.message,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred while uploading favicon',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * GET /api/tenants/:tenantId/branding/preview
   * Generate branding preview
   */
  async generatePreview(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.params;
    const requestId = req.headers['x-request-id'] as string;
    const previewData: UpdateBrandingRequest = req.body;

    this.logger.info('Generate preview request received', { tenantId, requestId });

    try {
      // Validate tenantId parameter
      if (!tenantId || typeof tenantId !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TENANT_ID',
            message: 'Valid tenant ID is required',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const preview = await this.brandingService.generateBrandingPreview(tenantId, previewData);

      // If HTML preview is requested, return HTML content
      if (req.query.format === 'html') {
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(preview.previewHtml);
        return;
      }

      res.status(200).json({
        success: true,
        data: preview,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      this.logger.error('Failed to generate preview', { tenantId, requestId, error: error.message });

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'BRANDING_NOT_FOUND',
            message: 'Branding configuration not found for this tenant',
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred while generating preview',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}