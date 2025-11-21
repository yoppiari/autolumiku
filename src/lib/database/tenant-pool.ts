import { Pool, PoolClient } from 'pg';
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

interface TenantDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
}

interface TenantConnectionPool {
  tenantId: string;
  pool: Pool;
  config: TenantDatabaseConfig;
  createdAt: Date;
  lastUsed: Date;
}

class TenantDatabasePool {
  private pools: Map<string, TenantConnectionPool> = new Map();
  private readonly defaultConfig: Partial<TenantDatabaseConfig>;
  private readonly maxIdleTime: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.defaultConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.NODE_ENV === 'production',
      maxConnections: 20,
    };

    // Clean up idle pools every 5 minutes
    setInterval(() => this.cleanupIdlePools(), 5 * 60 * 1000);
  }

  /**
   * Create or get a connection pool for a specific tenant
   */
  async getTenantPool(tenantId: string): Promise<Pool> {
    const existingPool = this.pools.get(tenantId);

    if (existingPool) {
      existingPool.lastUsed = new Date();
      return existingPool.pool;
    }

    // Create new pool for tenant
    const tenantConfig = await this.getTenantDatabaseConfig(tenantId);
    const pool = new Pool({
      ...tenantConfig,
      max: tenantConfig.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    const connectionPool: TenantConnectionPool = {
      tenantId,
      pool,
      config: tenantConfig,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.pools.set(tenantId, connectionPool);

    logger.info(`Created new database pool for tenant: ${tenantId}`);

    return pool;
  }

  /**
   * Execute a query within a tenant database
   */
  async query<T = any>(tenantId: string, text: string, params?: any[]): Promise<T[]> {
    const pool = await this.getTenantPool(tenantId);
    const client = await pool.connect();

    try {
      const result = await client.query(text, params);
      return result.rows;
    } catch (error) {
      logger.error(`Database query error for tenant ${tenantId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from tenant pool for multiple queries
   */
  async getClient(tenantId: string): Promise<PoolClient> {
    const pool = await this.getTenantPool(tenantId);
    return pool.connect();
  }

  /**
   * Create a new tenant database
   */
  async createTenantDatabase(tenantId: string, dbName: string): Promise<void> {
    const adminPool = new Pool({
      ...this.defaultConfig,
      database: 'postgres', // Connect to default database for admin operations
      max: 1,
    });

    try {
      // Create the database
      await adminPool.query(`CREATE DATABASE "${dbName}"`);

      // Grant permissions
      await adminPool.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO ${this.defaultConfig.user}`);

      logger.info(`Created tenant database: ${dbName} for tenant: ${tenantId}`);
    } catch (error) {
      logger.error(`Failed to create tenant database ${dbName} for tenant ${tenantId}:`, error);
      throw error;
    } finally {
      await adminPool.end();
    }
  }

  /**
   * Get database configuration for a tenant
   */
  private async getTenantDatabaseConfig(tenantId: string): Promise<TenantDatabaseConfig> {
    // For now, construct database name from tenant ID
    // In production, this would fetch from tenant metadata storage
    const dbName = `autolumiku_tenant_${tenantId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return {
      ...this.defaultConfig as TenantDatabaseConfig,
      database: dbName,
    };
  }

  /**
   * Clean up idle connection pools
   */
  private async cleanupIdlePools(): Promise<void> {
    const now = new Date();
    const poolsToRemove: string[] = [];

    for (const [tenantId, connectionPool] of this.pools.entries()) {
      const idleTime = now.getTime() - connectionPool.lastUsed.getTime();

      if (idleTime > this.maxIdleTime) {
        poolsToRemove.push(tenantId);
      }
    }

    for (const tenantId of poolsToRemove) {
      const connectionPool = this.pools.get(tenantId)!;
      await connectionPool.pool.end();
      this.pools.delete(tenantId);

      logger.info(`Cleaned up idle database pool for tenant: ${tenantId}`);
    }
  }

  /**
   * Close all connection pools
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map(
      connectionPool => connectionPool.pool.end()
    );

    await Promise.all(closePromises);
    this.pools.clear();

    logger.info('All database pools closed');
  }

  /**
   * Get pool statistics for monitoring
   */
  getPoolStats(): { [tenantId: string]: any } {
    const stats: { [tenantId: string]: any } = {};

    for (const [tenantId, connectionPool] of this.pools.entries()) {
      stats[tenantId] = {
        totalCount: connectionPool.pool.totalCount,
        idleCount: connectionPool.pool.idleCount,
        waitingCount: connectionPool.pool.waitingCount,
        createdAt: connectionPool.createdAt,
        lastUsed: connectionPool.lastUsed,
      };
    }

    return stats;
  }
}

// Singleton instance
export const tenantDatabasePool = new TenantDatabasePool();

export default TenantDatabasePool;