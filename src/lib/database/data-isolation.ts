import { NextRequest, NextResponse } from 'next/server';
import { tenantDatabasePool } from './tenant-pool';
import { Tenant } from '@/types/tenant';

/**
 * Data isolation middleware for multi-tenant database access
 */
export interface TenantDatabaseContext {
  tenantId: string;
  tenant: Tenant;
  connection: any; // Database connection
}

/**
 * Ensure tenant database connection for current request
 */
export async function withTenantDatabase(
  request: NextRequest,
  handler: (req: NextRequest, context: TenantDatabaseContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Get tenant information from request headers
    const tenantId = request.headers.get('x-tenant-id');
    const tenantSubdomain = request.headers.get('x-tenant-subdomain');
    const tenantStatus = request.headers.get('x-tenant-status');

    // Validate tenant context
    if (!tenantId || !tenantSubdomain) {
      return NextResponse.json(
        { error: 'Tenant context required' },
        { status: 400 }
      );
    }

    // Check tenant status
    if (tenantStatus !== 'active') {
      return NextResponse.json(
        { error: 'Tenant database is not available' },
        { status: 503 }
      );
    }

    // Get tenant database connection
    const connection = await tenantDatabasePool.getTenantConnection(tenantId);

    // Create tenant context (in production, get full tenant details)
    const tenant: Tenant = {
      id: tenantId,
      subdomain: tenantSubdomain,
      dbName: `autolumiku_tenant_${tenantId.replace(/-/g, '_')}`,
      status: tenantStatus as any,
      name: 'Tenant Name', // Would fetch from database
      adminUserId: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const context: TenantDatabaseContext = {
      tenantId,
      tenant,
      connection
    };

    // Execute handler with tenant database context
    return handler(request, context);

  } catch (error) {
    console.error('Error in tenant database isolation:', error);
    return NextResponse.json(
      {
        error: 'Database access failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Database access validator for tenant operations
 */
export class TenantDataAccessValidator {
  /**
   * Validate that user has access to tenant data
   */
  static validateTenantAccess(
    userTenantId: string | null,
    requestedTenantId: string,
    userRole: string
  ): { valid: boolean; reason?: string } {
    // Super admins can access any tenant
    if (userRole === 'super_admin') {
      return { valid: true };
    }

    // Platform admins can access any tenant for administrative purposes
    if (userRole === 'admin') {
      return { valid: true };
    }

    // Tenant admins can only access their own tenant
    if (userRole === 'tenant_admin') {
      if (userTenantId === requestedTenantId) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: 'Tenant admin can only access their own tenant data'
      };
    }

    // Regular users can only access their own tenant
    if (userRole === 'user') {
      if (userTenantId === requestedTenantId) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: 'User can only access their own tenant data'
      };
    }

    return {
      valid: false,
      reason: 'Unknown user role'
    };
  }

  /**
   * Validate cross-tenant operation prevention
   */
  static validateCrossTenantOperation(
    sourceTenantId: string,
    targetTenantId: string,
    operation: string
  ): { valid: boolean; reason?: string } {
    // Operations within the same tenant are always allowed
    if (sourceTenantId === targetTenantId) {
      return { valid: true };
    }

    // Cross-tenant operations are generally not allowed
    // Specific operations might be allowed for super admins in production
    return {
      valid: false,
      reason: `Cross-tenant ${operation} operation is not allowed`
    };
  }

  /**
   * Validate data ownership for tenant operations
   */
  static validateDataOwnership(
    resourceTenantId: string,
    userTenantId: string | null,
    userRole: string
  ): { valid: boolean; reason?: string } {
    return this.validateTenantAccess(userTenantId, resourceTenantId, userRole);
  }
}

/**
 * Tenant-specific query builder for safe database operations
 */
export class TenantQueryBuilder {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Create tenant-scoped query
   */
  query(table: string, alias?: string): TenantQuery {
    return new TenantQuery(this.tenantId, table, alias);
  }

  /**
   * Validate that table name is safe for tenant access
   */
  private validateTableName(tableName: string): boolean {
    // Only allow specific tables that are tenant-scoped
    const allowedTables = [
      'users',
      'customers',
      'vehicles',
      'sales',
      'inventory',
      'services',
      'appointments',
      'transactions',
      'settings',
      'audit_logs'
    ];

    return allowedTables.includes(tableName.toLowerCase());
  }
}

/**
 * Tenant-scoped query builder with parameterized queries
 */
export class TenantQuery {
  private tenantId: string;
  private table: string;
  private alias?: string;
  private whereClauses: Array<{ clause: string; params: any[] }> = [];
  private joinClauses: Array<{ clause: string; params: any[] }> = [];
  private queryParams: any[] = [];
  private paramCounter: number = 1;
  private orderByClause?: string;
  private limitClause?: string;
  private offsetClause?: string;

  constructor(tenantId: string, table: string, alias?: string) {
    // Validate tenantId is a valid UUID to prevent SQL injection
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }

    // Validate table name (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new Error('Invalid table name');
    }

    this.tenantId = tenantId;
    this.table = table;
    this.alias = alias;

    // Automatically add tenant filter using parameterized query
    this.whereParam('tenant_id', '=', this.tenantId);
  }

  /**
   * Add parameterized WHERE clause (SAFE - prevents SQL injection)
   */
  whereParam(column: string, operator: string, value: any): this {
    // Validate column name (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(column)) {
      throw new Error('Invalid column name');
    }

    // Validate operator
    const allowedOperators = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'ILIKE', 'IN', 'NOT IN', 'IS', 'IS NOT'];
    if (!allowedOperators.includes(operator.toUpperCase())) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    const paramPlaceholder = `$${this.paramCounter++}`;
    this.whereClauses.push({
      clause: `${column} ${operator} ${paramPlaceholder}`,
      params: [value]
    });
    this.queryParams.push(value);
    return this;
  }

  /**
   * Add raw WHERE clause (USE WITH CAUTION - for complex conditions only)
   * @deprecated Use whereParam() instead for safety
   */
  where(condition: string): this {
    console.warn('Using raw WHERE clause - ensure condition is safe from SQL injection');
    this.whereClauses.push({ clause: condition, params: [] });
    return this;
  }

  /**
   * Add parameterized JOIN clause (SAFE)
   */
  joinParam(table: string, leftColumn: string, operator: string, rightColumn: string): this {
    // Validate table and column names
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new Error('Invalid table name');
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(leftColumn) || !/^[a-zA-Z0-9_.]+$/.test(rightColumn)) {
      throw new Error('Invalid column name');
    }

    const allowedOperators = ['=', '!=', '<', '>', '<=', '>='];
    if (!allowedOperators.includes(operator)) {
      throw new Error(`Invalid join operator: ${operator}`);
    }

    this.joinClauses.push({
      clause: `JOIN ${table} ON ${leftColumn} ${operator} ${rightColumn}`,
      params: []
    });
    return this;
  }

  /**
   * Add raw JOIN clause (USE WITH CAUTION)
   * @deprecated Use joinParam() instead for safety
   */
  join(table: string, onCondition: string): this {
    console.warn('Using raw JOIN clause - ensure condition is safe from SQL injection');
    // Validate table name at minimum
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new Error('Invalid table name');
    }
    this.joinClauses.push({ clause: `JOIN ${table} ON ${onCondition}`, params: [] });
    return this;
  }

  /**
   * Add ORDER BY clause with column validation
   */
  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    // Validate column name (alphanumeric, underscore, and dot for table.column)
    if (!/^[a-zA-Z0-9_.]+$/.test(column)) {
      throw new Error('Invalid column name for ORDER BY');
    }

    // Validate direction
    if (direction !== 'ASC' && direction !== 'DESC') {
      throw new Error('Invalid ORDER BY direction');
    }

    this.orderByClause = `ORDER BY ${column} ${direction}`;
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): this {
    this.limitClause = `LIMIT ${count}`;
    return this;
  }

  /**
   * Add OFFSET clause
   */
  offset(count: number): this {
    this.offsetClause = `OFFSET ${count}`;
    return this;
  }

  /**
   * Build SELECT query with parameterized values
   */
  buildSelect(columns: string = '*'): { query: string; params: any[] } {
    // Validate columns string (basic validation - should be comma-separated column names)
    if (columns !== '*' && !/^[a-zA-Z0-9_., ]+$/.test(columns)) {
      throw new Error('Invalid column specification');
    }

    const tableName = this.alias ? `${this.table} AS ${this.alias}` : this.table;
    let query = `SELECT ${columns} FROM ${tableName}`;

    // Add joins
    if (this.joinClauses.length > 0) {
      query += ' ' + this.joinClauses.map(j => j.clause).join(' ');
    }

    // Add where clauses
    if (this.whereClauses.length > 0) {
      query += ' WHERE ' + this.whereClauses.map(w => w.clause).join(' AND ');
    }

    // Add order by
    if (this.orderByClause) {
      query += ' ' + this.orderByClause;
    }

    // Add limit and offset
    if (this.limitClause) {
      query += ' ' + this.limitClause;
      if (this.offsetClause) {
        query += ' ' + this.offsetClause;
      }
    }

    return { query, params: this.queryParams };
  }

  /**
   * Build INSERT query
   */
  buildInsert(data: Record<string, any>): { query: string; values: any[] } {
    const tableName = this.alias ? `${this.table} AS ${this.alias}` : this.table;
    const columns = Object.keys(data);
    const values = Object.values(data);

    // Automatically add tenant_id if not present
    if (!data.tenant_id) {
      columns.push('tenant_id');
      values.push(this.tenantId);
    }

    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;

    return { query, values };
  }

  /**
   * Build UPDATE query with parameterized values
   */
  buildUpdate(data: Record<string, any>): { query: string; values: any[] } {
    const tableName = this.alias ? `${this.table} AS ${this.alias}` : this.table;
    const columns = Object.keys(data);
    const values = Object.values(data);

    // Validate column names
    columns.forEach(col => {
      if (!/^[a-zA-Z0-9_]+$/.test(col)) {
        throw new Error(`Invalid column name: ${col}`);
      }
    });

    // Adjust parameter placeholders to account for existing query params
    const startIndex = this.queryParams.length + 1;
    const setClause = columns.map((col, index) => `${col} = $${startIndex + index}`).join(', ');

    // Add values to query params
    const allValues = [...this.queryParams, ...values];

    // Ensure tenant_id filter is present (already added in constructor via whereParam)
    const hasTenantFilter = this.whereClauses.some(w => w.clause.includes('tenant_id'));
    if (!hasTenantFilter) {
      throw new Error('UPDATE query must include tenant_id filter for data isolation');
    }

    let query = `UPDATE ${tableName} SET ${setClause}`;

    // Add where clauses
    if (this.whereClauses.length > 0) {
      query += ' WHERE ' + this.whereClauses.map(w => w.clause).join(' AND ');
    }

    return { query, values: allValues };
  }

  /**
   * Build DELETE query with parameterized values
   */
  buildDelete(): { query: string; params: any[] } {
    const tableName = this.alias ? `${this.table} AS ${this.alias}` : this.table;

    // Ensure tenant_id filter is present (added in constructor)
    const hasTenantFilter = this.whereClauses.some(w => w.clause.includes('tenant_id'));
    if (!hasTenantFilter) {
      throw new Error('DELETE query must include tenant_id filter for data isolation');
    }

    let query = `DELETE FROM ${tableName}`;

    // Add where clauses
    if (this.whereClauses.length > 0) {
      query += ' WHERE ' + this.whereClauses.map(w => w.clause).join(' AND ');
    } else {
      throw new Error('DELETE query must include WHERE clause with tenant_id filter');
    }

    return { query, params: this.queryParams };
  }
}

/**
 * Tenant database audit logger
 */
export class TenantAuditLogger {
  /**
   * Log tenant database operation
   */
  static async logOperation(
    tenantId: string,
    userId: string,
    operation: string,
    table: string,
    recordId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<void> {
    try {
      const auditRecord = {
        tenant_id: tenantId,
        user_id: userId,
        operation,
        table_name: table,
        record_id: recordId,
        old_values: oldValues ? JSON.stringify(oldValues) : null,
        new_values: newValues ? JSON.stringify(newValues) : null,
        created_at: new Date(),
        ip_address: null, // Would extract from request
        user_agent: null // Would extract from request
      };

      // In production, this would insert into tenant audit table
      console.log('Audit log:', auditRecord);

    } catch (error) {
      console.error('Failed to log audit record:', error);
      // Audit logging failures should not break the main operation
    }
  }
}

/**
 * Create tenant query builder
 */
export function createTenantQueryBuilder(tenantId: string): TenantQueryBuilder {
  return new TenantQueryBuilder(tenantId);
}