/**
 * Role Management Service
 * Advanced role management with permission matrix and custom role creation
 * Supports Indonesian automotive dealership roles with hierarchical permissions
 */

import { DatabaseClient } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { Cache } from '@/lib/cache';

export interface RolePermission {
  permissionId: string;
  permissionCode: string;
  permissionName: string;
  category: string;
  description: string;
  granted: boolean;
  isInherited?: boolean;
}

export interface CustomRoleRequest {
  name: string;
  displayName: string;
  indonesianTitle: string;
  description: string;
  department: string;
  roleLevel: number;
  permissions: string[];
  inheritsFrom?: string[];
}

export interface RoleMatrix {
  roleId: string;
  roleName: string;
  displayName: string;
  indonesianTitle: string;
  department: string;
  roleLevel: number;
  permissions: RolePermission[];
  memberCount: number;
  isSystem: boolean;
  isActive: boolean;
}

export interface PermissionCategory {
  category: string;
  permissions: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
  }>;
}

export class RoleManagementService {
  private readonly logger: Logger;
  private readonly cache: Cache;

  constructor(
    private readonly db: DatabaseClient,
    private readonly tenantId: string
  ) {
    this.logger = new Logger('RoleManagementService');
    this.cache = new Cache('role_management', 600); // 10 minute cache
  }

  /**
   * Get complete role matrix with permissions for all tenant roles
   */
  async getRoleMatrix(): Promise<RoleMatrix[]> {
    const cacheKey = `role_matrix:${this.tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      // Get all roles for tenant
      const rolesQuery = `
        SELECT
          dr.*,
          COUNT(tmr.id) as member_count,
          dr.tenant_id IS NULL as is_system
        FROM dealership_roles dr
        LEFT JOIN team_member_roles tmr ON dr.id = tmr.role_id
          AND tmr.effective_from <= CURRENT_TIMESTAMP
          AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        WHERE dr.tenant_id = $1 OR dr.tenant_id IS NULL
        GROUP BY dr.id
        ORDER BY dr.role_level ASC, dr.name ASC
      `;

      const rolesResult = await this.db.query(rolesQuery, [this.tenantId]);
      const roles = rolesResult.rows;

      // Get all permissions
      const permissionsQuery = `
        SELECT * FROM permissions
        ORDER BY category, name
      `;
      const permissionsResult = await this.db.query(permissionsQuery);
      const allPermissions = permissionsResult.rows;

      // Get role permissions
      const rolePermissionsQuery = `
        SELECT
          rp.role_id,
          p.*,
          TRUE as granted
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        JOIN dealership_roles dr ON rp.role_id = dr.id
        WHERE dr.tenant_id = $1 OR dr.tenant_id IS NULL
      `;
      const rolePermissionsResult = await this.db.query(rolePermissionsQuery, [this.tenantId]);
      const rolePermissions = rolePermissionsResult.rows;

      // Build matrix
      const matrix: RoleMatrix[] = roles.map(role => {
        const rolePerms = rolePermissions.filter(rp => rp.role_id === role.id);
        const permissions: RolePermission[] = allPermissions.map(permission => ({
          permissionId: permission.id,
          permissionCode: permission.code,
          permissionName: permission.name,
          category: permission.category,
          description: permission.description,
          granted: rolePerms.some(rp => rp.id === permission.id),
          isInherited: false
        }));

        return {
          roleId: role.id,
          roleName: role.name,
          displayName: role.display_name,
          indonesianTitle: role.indonesian_title,
          department: role.department,
          roleLevel: role.role_level,
          permissions,
          memberCount: parseInt(role.member_count) || 0,
          isSystem: role.is_system,
          isActive: role.is_active
        };
      });

      await this.cache.set(cacheKey, JSON.stringify(matrix));
      return matrix;
    } catch (error) {
      this.logger.error('Failed to get role matrix', { error, tenantId: this.tenantId });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get permissions grouped by category for role editing
   */
  async getPermissionCategories(): Promise<PermissionCategory[]> {
    const cacheKey = `permission_categories:${this.tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      const query = `
        SELECT
          category,
          json_agg(
            json_build_object(
              'id', id,
              'code', code,
              'name', name,
              'description', description
            ) ORDER BY name
          ) as permissions
        FROM permissions
        GROUP BY category
        ORDER BY category
      `;

      const result = await this.db.query(query);
      const categories = result.rows.map(row => ({
        category: row.category,
        permissions: row.permissions || []
      }));

      await this.cache.set(cacheKey, JSON.stringify(categories));
      return categories;
    } catch (error) {
      this.logger.error('Failed to get permission categories', { error, tenantId: this.tenantId });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Create custom role with specific permissions
   */
  async createCustomRole(
    createdBy: string,
    roleData: CustomRoleRequest
  ): Promise<any> {
    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      // Start transaction
      await this.db.query('BEGIN');

      // Validate role name uniqueness
      const existingRoleQuery = `
        SELECT id FROM dealership_roles
        WHERE name = $1 AND tenant_id = $2
      `;
      const existingResult = await this.db.query(existingRoleQuery, [roleData.name, this.tenantId]);
      if (existingResult.rows.length > 0) {
        throw new Error(`Role with name "${roleData.name}" already exists`);
      }

      // Validate role level
      if (roleData.roleLevel < 1 || roleData.roleLevel > 100) {
        throw new Error('Role level must be between 1 and 100');
      }

      // Insert new role
      const insertRoleQuery = `
        INSERT INTO dealership_roles (
          tenant_id, name, display_name, indonesian_title,
          description, department, role_level, is_active,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
        RETURNING *
      `;

      const roleResult = await this.db.query(insertRoleQuery, [
        this.tenantId,
        roleData.name,
        roleData.displayName,
        roleData.indonesianTitle,
        roleData.description,
        roleData.department,
        roleData.roleLevel
      ]);

      const newRole = roleResult.rows[0];

      // Insert permissions
      if (roleData.permissions.length > 0) {
        const permissionValues = roleData.permissions.map((permissionId, index) =>
          `($1, $${index + 2}, NOW())`
        ).join(', ');

        const insertPermissionsQuery = `
          INSERT INTO role_permissions (role_id, permission_id, granted_at)
          VALUES ${permissionValues}
        `;

        await this.db.query(insertPermissionsQuery, [newRole.id, ...roleData.permissions]);
      }

      // Handle role inheritance if specified
      if (roleData.inheritsFrom && roleData.inheritsFrom.length > 0) {
        for (const parentRoleId of roleData.inheritsFrom) {
          // Copy permissions from parent role
          const inheritPermissionsQuery = `
            INSERT INTO role_permissions (role_id, permission_id, granted_at)
            SELECT $1, permission_id, NOW()
            FROM role_permissions
            WHERE role_id = $2
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `;
          await this.db.query(inheritPermissionsQuery, [newRole.id, parentRoleId]);
        }
      }

      // Log the action
      await this.logRoleAction(
        'CREATE_CUSTOM_ROLE',
        createdBy,
        newRole.id,
        { roleData }
      );

      await this.db.query('COMMIT');

      // Clear cache
      await this.clearRoleCache();

      this.logger.info('Custom role created successfully', {
        roleId: newRole.id,
        roleName: roleData.name,
        createdBy,
        tenantId: this.tenantId
      });

      return newRole;
    } catch (error) {
      await this.db.query('ROLLBACK');
      this.logger.error('Failed to create custom role', {
        error,
        roleData,
        createdBy,
        tenantId: this.tenantId
      });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Update existing role with new permissions
   */
  async updateRolePermissions(
    roleId: string,
    updatedBy: string,
    permissionIds: string[]
  ): Promise<void> {
    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      // Start transaction
      await this.db.query('BEGIN');

      // Validate role exists and belongs to tenant
      const roleQuery = `
        SELECT id, name, is_system
        FROM dealership_roles
        WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
      `;
      const roleResult = await this.db.query(roleQuery, [roleId, this.tenantId]);
      if (roleResult.rows.length === 0) {
        throw new Error('Role not found');
      }

      const role = roleResult.rows[0];
      if (role.is_system) {
        throw new Error('Cannot modify system role permissions');
      }

      // Get current permissions for audit
      const currentPermissionsQuery = `
        SELECT permission_id FROM role_permissions WHERE role_id = $1
      `;
      const currentResult = await this.db.query(currentPermissionsQuery, [roleId]);
      const currentPermissions = currentResult.rows.map(row => row.permission_id);

      // Delete existing permissions
      await this.db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      // Insert new permissions
      if (permissionIds.length > 0) {
        const permissionValues = permissionIds.map((id, index) =>
          `($1, $${index + 2}, NOW())`
        ).join(', ');

        const insertPermissionsQuery = `
          INSERT INTO role_permissions (role_id, permission_id, granted_at)
          VALUES ${permissionValues}
        `;
        await this.db.query(insertPermissionsQuery, [roleId, ...permissionIds]);
      }

      // Update role timestamp
      await this.db.query(
        'UPDATE dealership_roles SET updated_at = NOW() WHERE id = $1',
        [roleId]
      );

      // Log the action
      await this.logRoleAction(
        'UPDATE_ROLE_PERMISSIONS',
        updatedBy,
        roleId,
        {
          oldPermissions: currentPermissions,
          newPermissions: permissionIds,
          roleName: role.name
        }
      );

      await this.db.query('COMMIT');

      // Clear cache
      await this.clearRoleCache();
      await this.clearPermissionCacheForRole(roleId);

      this.logger.info('Role permissions updated successfully', {
        roleId,
        roleName: role.name,
        updatedBy,
        permissionCount: permissionIds.length,
        tenantId: this.tenantId
      });
    } catch (error) {
      await this.db.query('ROLLBACK');
      this.logger.error('Failed to update role permissions', {
        error,
        roleId,
        updatedBy,
        tenantId: this.tenantId
      });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Clone existing role with modifications
   */
  async cloneRole(
    sourceRoleId: string,
    clonedBy: string,
    newRoleData: Partial<CustomRoleRequest>
  ): Promise<any> {
    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      // Start transaction
      await this.db.query('BEGIN');

      // Get source role details
      const sourceRoleQuery = `
        SELECT * FROM dealership_roles
        WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
      `;
      const sourceResult = await this.db.query(sourceRoleQuery, [sourceRoleId, this.tenantId]);
      if (sourceResult.rows.length === 0) {
        throw new Error('Source role not found');
      }

      const sourceRole = sourceResult.rows[0];

      // Get source role permissions
      const sourcePermissionsQuery = `
        SELECT permission_id FROM role_permissions WHERE role_id = $1
      `;
      const sourcePermissionsResult = await this.db.query(sourcePermissionsQuery, [sourceRoleId]);
      const sourcePermissions = sourcePermissionsResult.rows.map(row => row.permission_id);

      // Create cloned role
      const cloneRoleData: CustomRoleRequest = {
        name: newRoleData.name || `${sourceRole.name}_copy`,
        displayName: newRoleData.displayName || `${sourceRole.display_name} (Copy)`,
        indonesianTitle: newRoleData.indonesianTitle || `${sourceRole.indonesian_title} (Salinan)`,
        description: newRoleData.description || `Copy of ${sourceRole.description}`,
        department: newRoleData.department || sourceRole.department,
        roleLevel: newRoleData.roleLevel || sourceRole.role_level,
        permissions: newRoleData.permissions || sourcePermissions
      };

      const clonedRole = await this.createCustomRole(clonedBy, cloneRoleData);

      await this.db.query('COMMIT');

      this.logger.info('Role cloned successfully', {
        sourceRoleId,
        clonedRoleId: clonedRole.id,
        clonedBy,
        tenantId: this.tenantId
      });

      return clonedRole;
    } catch (error) {
      await this.db.query('ROLLBACK');
      this.logger.error('Failed to clone role', {
        error,
        sourceRoleId,
        clonedBy,
        tenantId: this.tenantId
      });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Delete custom role (only if not in use)
   */
  async deleteCustomRole(roleId: string, deletedBy: string): Promise<void> {
    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      // Start transaction
      await this.db.query('BEGIN');

      // Validate role exists and is not a system role
      const roleQuery = `
        SELECT name, is_system FROM dealership_roles
        WHERE id = $1 AND tenant_id = $2
      `;
      const roleResult = await this.db.query(roleQuery, [roleId, this.tenantId]);
      if (roleResult.rows.length === 0) {
        throw new Error('Role not found');
      }

      const role = roleResult.rows[0];
      if (role.is_system) {
        throw new Error('Cannot delete system role');
      }

      // Check if role is in use
      const usageQuery = `
        SELECT COUNT(*) as usage_count FROM team_member_roles
        WHERE role_id = $1
          AND effective_from <= CURRENT_TIMESTAMP
          AND (effective_until IS NULL OR effective_until > CURRENT_TIMESTAMP)
      `;
      const usageResult = await this.db.query(usageQuery, [roleId]);
      const usageCount = parseInt(usageResult.rows[0].usage_count);

      if (usageCount > 0) {
        throw new Error(`Cannot delete role that is assigned to ${usageCount} team member(s)`);
      }

      // Delete role permissions
      await this.db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      // Delete role
      await this.db.query('DELETE FROM dealership_roles WHERE id = $1', [roleId]);

      // Log the action
      await this.logRoleAction(
        'DELETE_CUSTOM_ROLE',
        deletedBy,
        roleId,
        { roleName: role.name }
      );

      await this.db.query('COMMIT');

      // Clear cache
      await this.clearRoleCache();

      this.logger.info('Custom role deleted successfully', {
        roleId,
        roleName: role.name,
        deletedBy,
        tenantId: this.tenantId
      });
    } catch (error) {
      await this.db.query('ROLLBACK');
      this.logger.error('Failed to delete custom role', {
        error,
        roleId,
        deletedBy,
        tenantId: this.tenantId
      });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get role usage statistics
   */
  async getRoleUsageStatistics(): Promise<any[]> {
    const cacheKey = `role_usage_stats:${this.tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      const query = `
        SELECT
          dr.id,
          dr.name,
          dr.display_name,
          dr.indonesian_title,
          dr.department,
          dr.role_level,
          dr.is_system,
          COUNT(tmr.id) as current_members,
          COUNT(CASE WHEN tmr.is_primary THEN 1 END) as primary_assignments,
          MAX(tmr.assigned_at) as last_assignment,
          COUNT(CASE WHEN tm.is_active = true THEN 1 END) as active_members
        FROM dealership_roles dr
        LEFT JOIN team_member_roles tmr ON dr.id = tmr.role_id
          AND tmr.effective_from <= CURRENT_TIMESTAMP
          AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        LEFT JOIN team_members tm ON tmr.team_member_id = tm.id
        WHERE dr.tenant_id = $1 OR dr.tenant_id IS NULL
        GROUP BY dr.id
        ORDER BY dr.role_level ASC, current_members DESC
      `;

      const result = await this.db.query(query, [this.tenantId]);
      const statistics = result.rows;

      await this.cache.set(cacheKey, JSON.stringify(statistics));
      return statistics;
    } catch (error) {
      this.logger.error('Failed to get role usage statistics', { error, tenantId: this.tenantId });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Export role configuration for backup or sharing
   */
  async exportRoleConfiguration(roleId?: string): Promise<any> {
    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      let whereClause = '';
      let queryParams: any[] = [this.tenantId];

      if (roleId) {
        whereClause = 'AND dr.id = $2';
        queryParams.push(roleId);
      }

      const query = `
        SELECT
          json_build_object(
            'roles', (
              SELECT json_agg(
                json_build_object(
                  'name', dr.name,
                  'displayName', dr.display_name,
                  'indonesianTitle', dr.indonesian_title,
                  'description', dr.description,
                  'department', dr.department,
                  'roleLevel', dr.role_level,
                  'permissions', (
                    SELECT json_agg(p.code ORDER BY p.code)
                    FROM role_permissions rp
                    JOIN permissions p ON rp.permission_id = p.id
                    WHERE rp.role_id = dr.id
                  )
                )
              )
              FROM dealership_roles dr
              WHERE (dr.tenant_id = $1 OR dr.tenant_id IS NULL) ${whereClause}
              ORDER BY dr.role_level
            ),
            'exportedAt', NOW(),
            'exportedBy', current_setting('app.current_user_id', true),
            'tenantId', $1
          ) as configuration
      `;

      const result = await this.db.query(query, queryParams);
      return result.rows[0].configuration;
    } catch (error) {
      this.logger.error('Failed to export role configuration', { error, tenantId: this.tenantId });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Import role configuration from exported data
   */
  async importRoleConfiguration(
    configuration: any,
    importedBy: string,
    options: {
      overwriteExisting?: boolean;
      preserveSystemRoles?: boolean;
    } = {}
  ): Promise<any> {
    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);
      await this.db.query('SET app.current_user_id = $1', [importedBy]);

      // Start transaction
      await this.db.query('BEGIN');

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as string[]
      };

      for (const roleData of configuration.roles || []) {
        try {
          // Check if role exists
          const existingRoleQuery = `
            SELECT id, is_system FROM dealership_roles
            WHERE name = $1 AND tenant_id = $2
          `;
          const existingResult = await this.db.query(existingRoleQuery, [
            roleData.name,
            this.tenantId
          ]);

          if (existingResult.rows.length > 0) {
            const existingRole = existingResult.rows[0];

            if (existingRole.is_system && options.preserveSystemRoles !== false) {
              results.skipped++;
              continue;
            }

            if (!options.overwriteExisting) {
              results.skipped++;
              continue;
            }

            // Update existing role
            await this.updateRoleFromImport(
              existingRole.id,
              roleData,
              importedBy
            );
            results.imported++;
          } else {
            // Create new role
            await this.createRoleFromImport(roleData, importedBy);
            results.imported++;
          }
        } catch (error) {
          results.errors.push(`Failed to import role "${roleData.name}": ${error.message}`);
        }
      }

      await this.db.query('COMMIT');

      // Clear cache
      await this.clearRoleCache();

      this.logger.info('Role configuration imported successfully', {
        results,
        importedBy,
        tenantId: this.tenantId
      });

      return results;
    } catch (error) {
      await this.db.query('ROLLBACK');
      this.logger.error('Failed to import role configuration', {
        error,
        importedBy,
        tenantId: this.tenantId
      });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
      await this.db.query('RESET app.current_user_id');
    }
  }

  /**
   * Log role management actions
   */
  private async logRoleAction(
    action: string,
    userId: string,
    roleId: string,
    details: any = {}
  ): Promise<void> {
    try {
      const logQuery = `
        INSERT INTO team_activity_logs (
          tenant_id, team_member_id, action_type,
          entity_type, entity_id, details,
          ip_address, user_agent, created_at
        ) VALUES ($1,
          (SELECT id FROM team_members WHERE user_id = $2 AND tenant_id = $1 LIMIT 1),
          $2, $3, $4, $5, $6, $7, NOW()
        )
      `;

      await this.db.query(logQuery, [
        this.tenantId,
        userId,
        action,
        'role',
        roleId,
        JSON.stringify(details),
        null, // IP address would be set from request context
        null  // User agent would be set from request context
      ]);
    } catch (error) {
      this.logger.error('Failed to log role action', {
        error,
        action,
        userId,
        roleId,
        details
      });
    }
  }

  /**
   * Create role from import data
   */
  private async createRoleFromImport(
    roleData: any,
    importedBy: string
  ): Promise<any> {
    // Get permission IDs from permission codes
    const permissionIds = await this.getPermissionIdsFromCodes(roleData.permissions || []);

    const insertRoleQuery = `
      INSERT INTO dealership_roles (
        tenant_id, name, display_name, indonesian_title,
        description, department, role_level, is_active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
      RETURNING *
    `;

    const result = await this.db.query(insertRoleQuery, [
      this.tenantId,
      roleData.name,
      roleData.displayName,
      roleData.indonesianTitle,
      roleData.description,
      roleData.department,
      roleData.roleLevel
    ]);

    const newRole = result.rows[0];

    // Insert permissions
    if (permissionIds.length > 0) {
      const permissionValues = permissionIds.map((id, index) =>
        `($1, $${index + 2}, NOW())`
      ).join(', ');

      const insertPermissionsQuery = `
        INSERT INTO role_permissions (role_id, permission_id, granted_at)
        VALUES ${permissionValues}
      `;

      await this.db.query(insertPermissionsQuery, [newRole.id, ...permissionIds]);
    }

    return newRole;
  }

  /**
   * Update role from import data
   */
  private async updateRoleFromImport(
    roleId: string,
    roleData: any,
    updatedBy: string
  ): Promise<void> {
    // Get permission IDs from permission codes
    const permissionIds = await this.getPermissionIdsFromCodes(roleData.permissions || []);

    // Update role details
    const updateRoleQuery = `
      UPDATE dealership_roles SET
        display_name = $1,
        indonesian_title = $2,
        description = $3,
        department = $4,
        role_level = $5,
        updated_at = NOW()
      WHERE id = $6
    `;

    await this.db.query(updateRoleQuery, [
      roleData.displayName,
      roleData.indonesianTitle,
      roleData.description,
      roleData.department,
      roleData.roleLevel,
      roleId
    ]);

    // Update permissions
    await this.db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    if (permissionIds.length > 0) {
      const permissionValues = permissionIds.map((id, index) =>
        `($1, $${index + 2}, NOW())`
      ).join(', ');

      const insertPermissionsQuery = `
        INSERT INTO role_permissions (role_id, permission_id, granted_at)
        VALUES ${permissionValues}
      `;

      await this.db.query(insertPermissionsQuery, [roleId, ...permissionIds]);
    }
  }

  /**
   * Get permission IDs from permission codes
   */
  private async getPermissionIdsFromCodes(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];

    const placeholders = codes.map((_, index) => `$${index + 1}`).join(', ');
    const query = `
      SELECT id FROM permissions WHERE code IN (${placeholders})
    `;

    const result = await this.db.query(query, codes);
    return result.rows.map(row => row.id);
  }

  /**
   * Clear role-related cache
   */
  private async clearRoleCache(): Promise<void> {
    const patterns = [
      `role_matrix:${this.tenantId}`,
      `permission_categories:${this.tenantId}`,
      `role_usage_stats:${this.tenantId}`,
      `user_roles:${this.tenantId}:*`,
      `primary_role:${this.tenantId}:*`,
      `has_role:${this.tenantId}:*`,
      `user_level:${this.tenantId}:*`
    ];

    for (const pattern of patterns) {
      await this.cache.deletePattern(pattern);
    }
  }

  /**
   * Clear permission cache for specific role
   */
  private async clearPermissionCacheForRole(roleId: string): Promise<void> {
    // Get all users with this role and clear their permission cache
    const usersQuery = `
      SELECT DISTINCT tm.user_id
      FROM team_member_roles tmr
      JOIN team_members tm ON tmr.team_member_id = tm.id
      WHERE tmr.role_id = $1 AND tm.tenant_id = $2
    `;

    const result = await this.db.query(usersQuery, [roleId, this.tenantId]);
    const userIds = result.rows.map(row => row.user_id);

    for (const userId of userIds) {
      const patterns = [
        `permission:${this.tenantId}:${userId}:*`,
        `user_permissions:${this.tenantId}:${userId}`,
        `any_permission:${this.tenantId}:${userId}:*`
      ];

      for (const pattern of patterns) {
        await this.cache.deletePattern(pattern);
      }
    }
  }
}