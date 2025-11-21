import { tenantDatabasePool } from './tenant-pool';
import { createLogger } from 'winston';
import { nanoid } from 'nanoid';

const logger = createLogger({
  level: 'info',
  format: {
    combine: [
      require('winston').format.timestamp(),
      require('winston').format.errors({ stack: true }),
      require('winston').format.json(),
    ],
  },
  transports: [
    new require('winston').transports.Console({
      format: require('winston').format.combine(
        require('winston').format.colorize(),
        require('winston').format.simple()
      )
    })
  ]
});

export interface TenantCreationRequest {
  name: string;
  subdomain: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
}

export interface TenantCreationResult {
  tenantId: string;
  dbName: string;
  adminUserId: string;
  status: 'setup_required' | 'active';
  createdAt: Date;
}

export interface DatabaseSchema {
  name: string;
  version: string;
  tables: string[];
}

/**
 * Database provisioning service for creating and managing tenant databases
 */
export class DatabaseProvisioningService {
  private readonly centralDb: string = 'autolumiku_central';

  /**
   * Provision a new tenant database with all required schemas and initial data
   */
  async provisionTenantDatabase(request: TenantCreationRequest): Promise<TenantCreationResult> {
    const tenantId = nanoid();
    const dbName = `autolumiku_tenant_${tenantId.replace(/-/g, '_')}`;
    const adminUserId = nanoid();

    logger.info(`Starting database provisioning for tenant: ${request.name} (${tenantId})`);

    try {
      // Step 1: Create the physical database
      await tenantDatabasePool.createTenantDatabase(tenantId, dbName);

      // Step 2: Apply schema to tenant database
      await this.applyTenantSchema(tenantId, dbName);

      // Step 3: Create initial tenant configuration
      await this.createTenantConfiguration(tenantId, dbName, request);

      // Step 4: Create admin user in tenant database
      await this.createTenantAdmin(tenantId, dbName, {
        id: adminUserId,
        email: request.adminEmail,
        firstName: request.adminFirstName,
        lastName: request.adminLastName,
        role: 'admin'
      });

      // Step 5: Create audit log table
      await this.createAuditLogTable(tenantId, dbName);

      const result: TenantCreationResult = {
        tenantId,
        dbName,
        adminUserId,
        status: 'setup_required',
        createdAt: new Date(),
      };

      logger.info(`Successfully provisioned database for tenant: ${tenantId}`);

      return result;
    } catch (error) {
      logger.error(`Failed to provision database for tenant ${tenantId}:`, error);

      // Attempt cleanup on failure
      try {
        await this.cleanupFailedProvisioning(tenantId, dbName);
      } catch (cleanupError) {
        logger.error(`Failed to cleanup failed provisioning for tenant ${tenantId}:`, cleanupError);
      }

      throw error;
    }
  }

  /**
   * Apply the base tenant schema to a new database
   */
  private async applyTenantSchema(tenantId: string, dbName: string): Promise<void> {
    const schemaSql = `
      -- Tenant configurations table
      CREATE TABLE IF NOT EXISTS tenant_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Users table for this tenant
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'staff',
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Authentication sessions
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_tenant_configurations_key ON tenant_configurations(key);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

      -- Create updated_at trigger function
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Create triggers for updated_at
      CREATE TRIGGER update_tenant_configurations_updated_at
        BEFORE UPDATE ON tenant_configurations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    await tenantDatabasePool.query(tenantId, schemaSql);
    logger.info(`Applied base schema to tenant database: ${dbName}`);
  }

  /**
   * Create initial tenant configuration
   */
  private async createTenantConfiguration(
    tenantId: string,
    dbName: string,
    request: TenantCreationRequest
  ): Promise<void> {
    const configs = [
      ['tenant_name', request.name, 'Tenant display name'],
      ['tenant_subdomain', request.subdomain, 'Tenant subdomain for routing'],
      ['tenant_status', 'setup_required', 'Initial tenant status'],
      ['tenant_created_at', new Date().toISOString(), 'Tenant creation timestamp'],
      ['tenant_language', 'id-ID', 'Default language setting'],
      ['tenant_timezone', 'Asia/Jakarta', 'Default timezone'],
    ];

    for (const [key, value, description] of configs) {
      await tenantDatabasePool.query(
        tenantId,
        'INSERT INTO tenant_configurations (key, value, description) VALUES ($1, $2, $3)',
        [key, value, description]
      );
    }

    logger.info(`Created initial configuration for tenant: ${tenantId}`);
  }

  /**
   * Create tenant admin user
   */
  private async createTenantAdmin(
    tenantId: string,
    dbName: string,
    adminUser: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    }
  ): Promise<void> {
    await tenantDatabasePool.query(
      tenantId,
      'INSERT INTO users (id, email, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5)',
      [adminUser.id, adminUser.email, adminUser.firstName, adminUser.lastName, adminUser.role]
    );

    logger.info(`Created admin user for tenant: ${tenantId}`);
  }

  /**
   * Create audit log table for tenant
   */
  private async createAuditLogTable(tenantId: string, dbName: string): Promise<void> {
    const auditSql = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100),
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `;

    await tenantDatabasePool.query(tenantId, auditSql);
    logger.info(`Created audit log table for tenant: ${tenantId}`);
  }

  /**
   * Clean up a failed provisioning attempt
   */
  private async cleanupFailedProvisioning(tenantId: string, dbName: string): Promise<void> {
    logger.warn(`Cleaning up failed provisioning for tenant: ${tenantId}, database: ${dbName}`);

    // In a real implementation, this would try to drop the database
    // For now, we just log the cleanup attempt
    // await tenantDatabasePool.createTenantDatabase(tenantId, dbName, true); // Drop database
  }

  /**
   * Check if a tenant database exists
   */
  async tenantDatabaseExists(tenantId: string): Promise<boolean> {
    try {
      await tenantDatabasePool.query(tenantId, 'SELECT 1');
      return true;
    } catch (error) {
      logger.debug(`Tenant database check failed for ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Get tenant database health status
   */
  async getTenantDatabaseHealth(tenantId: string): Promise<{
    exists: boolean;
    tables: number;
    lastHealthCheck: Date;
  }> {
    try {
      const result = await tenantDatabasePool.query(
        tenantId,
        'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
        ['public']
      );

      return {
        exists: true,
        tables: result.rows.length,
        lastHealthCheck: new Date(),
      };
    } catch (error) {
      return {
        exists: false,
        tables: 0,
        lastHealthCheck: new Date(),
      };
    }
  }
}

export const databaseProvisioningService = new DatabaseProvisioningService();
export default DatabaseProvisioningService;