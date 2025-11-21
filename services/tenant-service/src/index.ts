/**
 * Tenant Service Main Application
 *
 * Express.js application for tenant management and branding configuration.
 * Provides RESTful APIs for tenant operations including branding management.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { Pool } from 'pg';
import { config } from 'dotenv';

import { BrandingService } from './services/branding.service';
import { FileStorageService } from './services/file-storage.service';
import { CacheService } from './services/cache.service';
import { BrandingController } from './controllers/branding.controller';
import { logger } from './utils/logger';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3004;

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing tenant service...');

    // Database connection
    const db = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'autolumiku_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20, // Maximum number of connections in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
      connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
    });

    // Test database connection
    await db.query('SELECT NOW()');
    logger.info('Database connected successfully');

    // Cache service
    const cacheService = new CacheService({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: 'tenant-service:',
    });

    await cacheService.connect();
    logger.info('Cache service connected successfully');

    // File storage service
    const fileStorageService = new FileStorageService({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
      bucketName: process.env.AWS_S3_BUCKET || 'autolumiku-assets',
      endpoint: process.env.AWS_ENDPOINT, // For local development (MinIO)
    }, logger);

    // Branding service
    const brandingService = new BrandingService(db, fileStorageService, cacheService, logger);

    return {
      brandingService,
      db,
      cacheService,
    };
  } catch (error) {
    logger.error('Failed to initialize services', { error: error.message });
    throw error;
  }
}

// Configure middleware
function configureMiddleware() {
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'"],
      },
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', limiter);

  // Request logging
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.headers['x-request-id'] = requestId as string;

    logger.info('Request received', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      requestId,
    });

    // Add response logging
    const originalSend = res.send;
    res.send = function(body) {
      logger.info('Response sent', {
        requestId,
        statusCode: res.statusCode,
        contentLength: body ? body.length : 0,
      });
      return originalSend.call(this, body);
    };

    next();
  });
}

// File upload configuration
function configureFileUpload() {
  const storage = multer.memoryStorage(); // Store files in memory for processing

  const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Allowed file types
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon'];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
      files: 1, // Only one file at a time
    },
  });
}

// Configure routes
function configureRoutes(brandingController: BrandingController, upload: multer.Multer) {
  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      // Basic health check
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'tenant-service',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
      };

      res.status(200).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });

  // Branding routes
  app.get('/api/tenants/:tenantId/branding', (req, res) =>
    brandingController.getBranding(req, res)
  );

  app.put('/api/tenants/:tenantId/branding', (req, res) =>
    brandingController.updateBranding(req, res)
  );

  app.post('/api/tenants/:tenantId/branding', (req, res) =>
    brandingController.createBranding(req, res)
  );

  // File upload routes
  app.post('/api/tenants/:tenantId/branding/logo',
    upload.single('logo'),
    (req, res) => brandingController.uploadLogo(req, res)
  );

  app.post('/api/tenants/:tenantId/branding/favicon',
    upload.single('favicon'),
    (req, res) => brandingController.uploadFavicon(req, res)
  );

  // Preview route
  app.get('/api/tenants/:tenantId/branding/preview', (req, res) =>
    brandingController.generatePreview(req, res)
  );

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  });
}

// Error handling middleware
function configureErrorHandling() {
  // Multer error handling
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size exceeds the maximum allowed limit (5MB)',
          },
        });
      }

      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_FILES',
            message: 'Only one file can be uploaded at a time',
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: error.message,
        },
      });
    }

    next(error);
  });

  // Global error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  });
}

// Graceful shutdown
function configureGracefulShutdown(db: Pool, cacheService: CacheService) {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      // Close Express server
      server.close(async () => {
        logger.info('Express server closed');

        // Close database connections
        await db.end();
        logger.info('Database connections closed');

        // Close cache connection
        await cacheService.disconnect();
        logger.info('Cache connection closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, 30000);

    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
  });
}

// Start the application
async function startApplication() {
  try {
    logger.info('Starting Tenant Service...');

    // Initialize services
    const { brandingService, db, cacheService } = await initializeServices();

    // Create branding controller
    const brandingController = new BrandingController(brandingService, logger);

    // Configure Express app
    configureMiddleware();
    const upload = configureFileUpload();
    configureRoutes(brandingController, upload);
    configureErrorHandling();

    // Configure graceful shutdown
    configureGracefulShutdown(db, cacheService);

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Tenant Service started successfully`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
      });
    });

    // Export server for graceful shutdown
    (global as any).server = server;

  } catch (error) {
    logger.error('Failed to start application', { error: error.message });
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  startApplication();
}