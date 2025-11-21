export interface DatabaseSchema {
  version: string;
  tables: TableDefinition[];
  indexes: IndexDefinition[];
  triggers: TriggerDefinition[];
  functions: FunctionDefinition[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: string;
  unique?: boolean;
  description?: string;
}

export interface ForeignKeyDefinition {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
}

export interface TriggerDefinition {
  name: string;
  table: string;
  function: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
}

export interface FunctionDefinition {
  name: string;
  language: 'sql' | 'plpgsql';
  returns?: string;
  parameters?: string;
  body: string;
}

/**
 * Complete tenant database schema template
 */
export const tenantDatabaseSchema: DatabaseSchema = {
  version: '1.0.0',
  tables: [
    {
      name: 'tenant_configurations',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, defaultValue: 'gen_random_uuid()' },
        { name: 'key', type: 'VARCHAR(255)', nullable: false },
        { name: 'value', type: 'TEXT', nullable: true },
        { name: 'description', type: 'TEXT', nullable: true },
        { name: 'updated_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      primaryKey: ['id'],
      foreignKeys: []
    },
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'UUID', nullable: false },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true },
        { name: 'first_name', type: 'VARCHAR(100)', nullable: false },
        { name: 'last_name', type: 'VARCHAR(100)', nullable: false },
        { name: 'role', type: 'VARCHAR(50)', nullable: false, defaultValue: "'staff'" },
        { name: 'is_active', type: 'BOOLEAN', nullable: false, defaultValue: 'true' },
        { name: 'email_verified', type: 'BOOLEAN', nullable: false, defaultValue: 'false' },
        { name: 'password_hash', type: 'VARCHAR(255)', nullable: true, description: 'Stored password hash for authentication' },
        { name: 'last_login_at', type: 'TIMESTAMP', nullable: true },
        { name: 'updated_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      primaryKey: ['id'],
      foreignKeys: []
    },
    {
      name: 'auth_sessions',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, defaultValue: 'gen_random_uuid()' },
        { name: 'user_id', type: 'UUID', nullable: false },
        { name: 'token_hash', type: 'VARCHAR(255)', nullable: false },
        { name: 'refresh_token_hash', type: 'VARCHAR(255)', nullable: true },
        { name: 'expires_at', type: 'TIMESTAMP', nullable: false },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      primaryKey: ['id'],
      foreignKeys: [
        {
          column: 'user_id',
          referencesTable: 'users',
          referencesColumn: 'id',
          onDelete: 'CASCADE'
        }
      ]
    },
    {
      name: 'audit_logs',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, defaultValue: 'gen_random_uuid()' },
        { name: 'user_id', type: 'UUID', nullable: false },
        { name: 'action', type: 'VARCHAR(255)', nullable: false },
        { name: 'entity_type', type: 'VARCHAR(100)', nullable: true },
        { name: 'entity_id', type: 'UUID', nullable: true },
        { name: 'old_values', type: 'JSONB', nullable: true },
        { name: 'new_values', type: 'JSONB', nullable: true },
        { name: 'ip_address', type: 'INET', nullable: true },
        { name: 'user_agent', type: 'TEXT', nullable: true },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      primaryKey: ['id'],
      foreignKeys: [
        {
          column: 'user_id',
          referencesTable: 'users',
          referencesColumn: 'id',
          onDelete: 'CASCADE'
        }
      ]
    }
  ],
  indexes: [
    { name: 'idx_tenant_configurations_key', table: 'tenant_configurations', columns: ['key'], unique: true },
    { name: 'idx_users_email', table: 'users', columns: ['email'], unique: true },
    { name: 'idx_users_role', table: 'users', columns: ['role'] },
    { name: 'idx_users_active', table: 'users', columns: ['is_active'] },
    { name: 'idx_users_email_verified', table: 'users', columns: ['email_verified'] },
    { name: 'idx_auth_sessions_user_id', table: 'auth_sessions', columns: ['user_id'] },
    { name: 'idx_auth_sessions_token_hash', table: 'auth_sessions', columns: ['token_hash'] },
    { name: 'idx_auth_sessions_expires_at', table: 'auth_sessions', columns: ['expires_at'] },
    { name: 'idx_audit_logs_user_id', table: 'audit_logs', columns: ['user_id'] },
    { name: 'idx_audit_logs_action', table: 'audit_logs', columns: ['action'] },
    { name: 'idx_audit_logs_entity', table: 'audit_logs', columns: ['entity_type', 'entity_id'] },
    { name: 'idx_audit_logs_created_at', table: 'audit_logs', columns: ['created_at'] }
  ],
  triggers: [
    {
      name: 'update_tenant_configurations_updated_at',
      table: 'tenant_configurations',
      function: 'update_updated_at_column',
      timing: 'BEFORE',
      operation: 'UPDATE'
    },
    {
      name: 'update_users_updated_at',
      table: 'users',
      function: 'update_updated_at_column',
      timing: 'BEFORE',
      operation: 'UPDATE'
    }
  ],
  functions: [
    {
      name: 'update_updated_at_column',
      language: 'plpgsql',
      returns: 'TRIGGER',
      body: `
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
      `
    }
  ]
};

/**
 * Generate SQL for creating tables from schema definition
 */
export function generateCreateTableSQL(table: TableDefinition): string {
  const columnsSQL = table.columns.map(column => {
    let columnSQL = `${column.name} ${column.type}`;

    if (!column.nullable) {
      columnSQL += ' NOT NULL';
    }

    if (column.defaultValue) {
      columnSQL += ` DEFAULT ${column.defaultValue}`;
    }

    if (column.unique) {
      columnSQL += ' UNIQUE';
    }

    if (column.description) {
      columnSQL += ` -- ${column.description}`;
    }

    return columnSQL;
  }).join(',\n    ');

  const primaryKeys = table.primaryKey ? `PRIMARY KEY (${table.primaryKey.join(', ')})` : '';
  const foreignKeys = table.foreignKeys?.map(fk =>
    `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencesTable}(${fk.referencesColumn}) ON DELETE ${fk.onDelete || 'RESTRICT'}`
  ).join(',\n  ') || '';

  let sql = `CREATE TABLE IF NOT EXISTS ${table.name} (\n    ${columnsSQL}`;

  if (primaryKeys) {
    sql += `,\n    ${primaryKeys}`;
  }

  if (foreignKeys) {
    sql += `,\n    ${foreignKeys}`;
  }

  sql += '\n);';

  return sql;
}

/**
 * Generate SQL for creating indexes
 */
export function generateCreateIndexSQL(index: IndexDefinition): string {
  const uniqueClause = index.unique ? 'UNIQUE' : '';
  return `CREATE ${uniqueClause} INDEX IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns.join(', ')});`;
}

/**
 * Generate SQL for creating triggers
 */
export function generateCreateTriggerSQL(trigger: TriggerDefinition): string {
  return `CREATE TRIGGER ${trigger.name} ${trigger.timing} ${trigger.operation} ON ${trigger.table} FOR EACH ROW EXECUTE FUNCTION ${trigger.function}();`;
}

/**
 * Generate SQL for creating functions
 */
export function generateCreateFunctionSQL(func: FunctionDefinition): string {
  let sql = `CREATE OR REPLACE FUNCTION ${func.name}(${func.parameters || ''}) RETURNS ${func.returns || 'TRIGGER'} AS $$\n`;
  sql += `BEGIN\n`;
  sql += func.body;
  sql += `\nEND;\n`;
  sql += `$$ LANGUAGE ${func.language};`;

  return sql;
}

/**
 * Generate complete SQL schema for tenant database
 */
export function generateTenantSchemaSQL(): string {
  let sql = '-- Tenant Database Schema v1.0.0\n\n';

  // Create functions first (since triggers may depend on them)
  sql += '-- Functions\n';
  sql += tenantDatabaseSchema.functions.map(func => generateCreateFunctionSQL(func)).join('\n\n');
  sql += '\n\n';

  // Create tables
  sql += '-- Tables\n';
  sql += tenantDatabaseSchema.tables.map(table => generateCreateTableSQL(table)).join('\n\n');
  sql += '\n\n';

  // Create indexes
  sql += '-- Indexes\n';
  sql += tenantDatabaseSchema.indexes.map(index => generateCreateIndexSQL(index)).join('\n');
  sql += '\n\n';

  // Create triggers
  sql += '-- Triggers\n';
  sql += tenantDatabaseSchema.triggers.map(trigger => generateCreateTriggerSQL(trigger)).join('\n');

  return sql;
}