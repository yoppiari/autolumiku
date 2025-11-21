import { Pool } from 'pg';
import { createLogger } from 'winston';

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

// Test database configuration
const testDbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'autolumiku_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'password',
  max: 5, // Maximum number of connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

let testPool: Pool | null = null;

/**
 * Setup test database with required tables and data
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    logger.info('Setting up test database');

    testPool = new Pool(testDbConfig);

    // Create test schema if it doesn't exist
    await testPool.query(`
      CREATE SCHEMA IF NOT EXISTS test_schema;
    `);

    // Create tenant branding table
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS test_schema.tenant_branding (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255) NOT NULL UNIQUE,
        primary_color VARCHAR(7) NOT NULL CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
        secondary_color VARCHAR(7) CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$' OR secondary_color IS NULL),
        accent_color VARCHAR(7) CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$' OR accent_color IS NULL),
        background_color VARCHAR(7) CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$' OR background_color IS NULL),
        text_color VARCHAR(7) CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$' OR text_color IS NULL),
        company_name VARCHAR(255) NOT NULL,
        company_description TEXT,
        website VARCHAR(500) CHECK (website ~ '^https?://.*' OR website IS NULL),
        email VARCHAR(255) CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL),
        phone VARCHAR(20) CHECK (phone ~ '^\\+628[0-9]{8,12}$' OR phone IS NULL),
        address TEXT,
        logo_url VARCHAR(500),
        favicon_url VARCHAR(500),
        social_links JSONB DEFAULT '{}',
        custom_css TEXT,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );
    `);

    // Create indexes
    await testPool.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant_id
      ON test_schema.tenant_branding(tenant_id);
    `);

    await testPool.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_branding_updated_at
      ON test_schema.tenant_branding(updated_at DESC);
    `);

    // Create trigger for updated_at
    await testPool.query(`
      DROP TRIGGER IF EXISTS update_tenant_branding_updated_at
      ON test_schema.tenant_branding;

      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_tenant_branding_updated_at
        BEFORE UPDATE ON test_schema.tenant_branding
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    logger.info('Test database setup completed');
  } catch (error) {
    logger.error('Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Clean up test database and close connections
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    logger.info('Cleaning up test database');

    if (testPool) {
      // Clean up test data
      await testPool.query(`
        DROP TABLE IF EXISTS test_schema.tenant_branding CASCADE;
      `);

      await testPool.query(`
        DROP SCHEMA IF EXISTS test_schema CASCADE;
      `);

      // Close connection pool
      await testPool.end();
      testPool = null;
    }

    logger.info('Test database cleanup completed');
  } catch (error) {
    logger.error('Failed to cleanup test database:', error);
    throw error;
  }
}

/**
 * Get test database connection pool
 */
export function getTestPool(): Pool {
  if (!testPool) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testPool;
}

/**
 * Execute test query with automatic cleanup
 */
export async function executeTestQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const pool = getTestPool();
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Clean up specific test data
 */
export async function cleanupTestData(tenantId?: string): Promise<void> {
  try {
    const pool = getTestPool();

    if (tenantId) {
      await pool.query(
        'DELETE FROM test_schema.tenant_branding WHERE tenant_id = $1',
        [tenantId]
      );
    } else {
      await pool.query('DELETE FROM test_schema.tenant_branding');
    }
  } catch (error) {
    logger.error('Failed to cleanup test data:', error);
    throw error;
  }
}

/**
 * Insert test branding data
 */
export async function insertTestBranding(
  tenantId: string,
  brandingData: Partial<any> = {}
): Promise<any> {
  try {
    const pool = getTestPool();

    const defaultBranding = {
      primary_color: '#2563eb',
      company_name: 'Test Showroom',
      email: 'test@example.com',
      website: 'https://example.com',
      phone: '+62812345678',
      ...brandingData
    };

    const columns = Object.keys(defaultBranding);
    const values = Object.values(defaultBranding);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO test_schema.tenant_branding (tenant_id, ${columns.join(', ')})
      VALUES ($1, ${placeholders})
      RETURNING *;
    `;

    const result = await pool.query(query, [tenantId, ...values]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to insert test branding data:', error);
    throw error;
  }
}