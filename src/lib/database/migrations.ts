import { tenantDatabasePool } from './tenant-pool';
import { generateTenantSchemaSQL, DatabaseSchema } from './schema-template';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

export interface Migration {
  version: string;
  name: string;
  up: string;
  down: string;
  appliedAt?: Date;
}

export interface MigrationHistory {
  version: string;
  name: string;
  appliedAt: Date;
  executionTime: number;
}

/**
 * Database migration service for managing tenant database schema changes
 */
export class DatabaseMigrationService {
  private readonly migrationTableName = 'schema_migrations';

  /**
   * Initialize migration system for a tenant
   */
  async initializeMigrations(tenantId: string): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.migrationTableName} (
        version VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time INTEGER NOT NULL
      );

      await tenantDatabasePool.query(tenantId, createTableSQL);
    }

  /**
   * Run migrations for a tenant database
   */
  async runMigrations(tenantId: string, migrations: Migration[]): Promise<void> {
    await this.initializeMigrations(tenantId);

    const migrationCount = migrations.length;
    logger.info(`Running ` + migrationCount + ` migrations for tenant: ` + tenantId);

    for (const migration of migrations) {
      const alreadyApplied = await this.isMigrationApplied(tenantId, migration.version);

      if (alreadyApplied) {
        logger.info(`Migration ${migration.version} already applied, skipping`);
        continue;
      }

      await this.runMigration(tenantId, migration);
    }

    logger.info(`All migrations completed for tenant: ${tenantId}`);
  }

  /**
   * Run a single migration
   */
  private async runMigration(tenantId: string, migration: Migration): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`Applying migration ${migration.version}: ${migration.name}`);

      // Begin transaction
      const client = await tenantDatabasePool.getClient(tenantId);
      await client.query('BEGIN');

      try {
        // Apply migration SQL
        await client.query(migration.up);

        // Record migration
        const executionTime = Date.now() - startTime;
        await client.query(
          `INSERT INTO ${this.migrationTableName} (version, name, applied_at, execution_time) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
          [migration.version, migration.name, executionTime]
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      logger.info(`Successfully applied migration ${migration.version} in ${executionTime}ms`);
    } catch (error) {
      logger.error(`Failed to apply migration ${migration.version}:`, error);
      throw error;
    }
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(tenantId: string, migration: Migration): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`Rolling back migration ${migration.version}: ${migration.name}`);

      const client = await tenantDatabasePool.getClient(tenantId);
      await client.query('BEGIN');

      try {
        // Apply rollback SQL
        await client.query(migration.down);

        // Remove migration record
        await client.query(
          `DELETE FROM ${this.migrationTableName} WHERE version = $1`,
          [migration.version]
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const executionTime = Date.now() - startTime;
      logger.info(`Successfully rolled back migration ${migration.version} in ${executionTime}ms`);
    } catch (error) {
      logger.error(`Failed to rollback migration ${migration.version}:`, error);
      throw error;
    }
  }

  /**
   * Check if a migration has been applied
   */
  private async isMigrationApplied(tenantId: string, version: string): Promise<boolean> {
    try {
      const result = await tenantDatabasePool.query(
        tenantId,
        `SELECT version FROM ${this.migrationTableName} WHERE version = $1`,
        [version]
      );

      return result.rows.length > 0;
    } catch (error) {
      // Table might not exist yet
      return false;
    }
  }

  /**
   * Get migration history for a tenant
   */
  async getMigrationHistory(tenantId: string): Promise<MigrationHistory[]> {
    try {
      const result = await tenantDatabasePool.query(
        tenantId,
        `SELECT version, name, applied_at, execution_time FROM ${this.migrationTableName} ORDER BY applied_at ASC`
      );

      return result.rows.map(row => ({
        version: row.version,
        name: row.name,
        appliedAt: new Date(row.applied_at),
        executionTime: row.execution_time
      }));
    } catch (error) {
      logger.error(`Failed to get migration history for tenant ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * Get current schema version for a tenant
   */
  async getCurrentVersion(tenantId: string): Promise<string | null> {
    try {
      const result = await tenantDatabasePool.query(
        tenantId,
        `SELECT version FROM ${this.migrationTableName} ORDER BY applied_at DESC LIMIT 1`
      );

      return result.rows[0]?.version || null;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Built-in migrations for tenant database
 */
export const tenantMigrations: Migration[] = [
  {
    version: '001_initial_schema',
    name: 'Initial tenant database schema',
    up: generateTenantSchemaSQL(),
    down: `
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS auth_sessions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS tenant_configurations CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
    `
  },
  {
    version: '002_add_user_preferences',
    name: 'Add user preferences table',
    up: `
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        theme VARCHAR(50) DEFAULT 'default',
        language VARCHAR(10) DEFAULT 'id-ID',
        timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
        notifications_email BOOLEAN DEFAULT true,
        notifications_push BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
      CREATE TRIGGER update_user_preferences_updated_at
        BEFORE UPDATE ON user_preferences
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `,
    down: `
      DROP TABLE IF EXISTS user_preferences CASCADE;
    `
  },
  {
    version: '003_add_api_keys',
    name: 'Add API keys for tenant integrations',
    up: `
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) NOT NULL UNIQUE,
        permissions JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
      CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
      CREATE TRIGGER update_api_keys_updated_at
        BEFORE UPDATE ON api_keys
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `,
    down: `
      DROP TABLE IF EXISTS api_keys CASCADE;
    `
  }
];

export const databaseMigrationService = new DatabaseMigrationService();
export default DatabaseMigrationService;