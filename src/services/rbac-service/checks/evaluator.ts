/**
 * Permission Service
 * Role-Based Access Control (RBAC) evaluator for team management
 * Checks user permissions against assigned roles and permissions
 */

import { DatabaseClient } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { Cache } from '@/lib/cache';

export class PermissionService {
  private readonly logger: Logger;
  private readonly cache: Cache;

  constructor(
    private readonly db: DatabaseClient,
    private readonly tenantId: string
  ) {
    this.logger = new Logger('PermissionService');
    this.cache = new Cache('permissions', 300); // 5 minute cache
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: string,
    permissionCode: string
  ): Promise<boolean> {
    const cacheKey = `permission:${this.tenantId}:${userId}:${permissionCode}`;

    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      const query = `
        SELECT EXISTS (
          SELECT 1 FROM team_members tm
          JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
          JOIN role_permissions rp ON tmr.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE tm.user_id = $1 AND tm.tenant_id = $2
            AND tm.is_active = true
            AND p.code = $3
            AND tmr.effective_from <= CURRENT_TIMESTAMP
            AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        ) as has_permission
      `;

      const result = await this.db.query(query, [userId, this.tenantId, permissionCode]);
      const hasPermission = result.rows[0].has_permission;

      // Cache the result
      await this.cache.set(cacheKey, hasPermission.toString());

      this.logger.debug('Permission checked', {
        userId,
        permissionCode,
        hasPermission,
        tenantId: this.tenantId
      });

      return hasPermission;
    } catch (error) {
      this.logger.error('Failed to check permission', {
        error,
        userId,
        permissionCode,
        tenantId: this.tenantId
      });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Require user to have permission, throw error if not
   */
  async requirePermission(
    userId: string,
    permissionCode: string,
    customMessage?: string
  ): Promise<void> {
    const hasPermission = await this.hasPermission(userId, permissionCode);

    if (!hasPermission) {
      const message = customMessage || `User does not have required permission: ${permissionCode}`;
      this.logger.warn('Permission denied', {
        userId,
        permissionCode,
        tenantId: this.tenantId,
        message
      });
      throw new Error(message);
    }
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(
    userId: string,
    permissionCodes: string[]
  ): Promise<boolean> {
    if (permissionCodes.length === 0) {
      return false;
    }

    // Check cache first for batch
    const cacheKey = `any_permission:${this.tenantId}:${userId}:${permissionCodes.sort().join(',')}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      const placeholders = permissionCodes.map((_, index) => `$${index + 3}`).join(', ');
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM team_members tm
          JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
          JOIN role_permissions rp ON tmr.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE tm.user_id = $1 AND tm.tenant_id = $2
            AND tm.is_active = true
            AND p.code IN (${placeholders})
            AND tmr.effective_from <= CURRENT_TIMESTAMP
            AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        ) as has_any_permission
      `;

      const result = await this.db.query(query, [userId, this.tenantId, ...permissionCodes]);
      const hasAnyPermission = result.rows[0].has_any_permission;

      await this.cache.set(cacheKey, hasAnyPermission.toString());
      return hasAnyPermission;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(
    userId: string,
    permissionCodes: string[]
  ): Promise<boolean> {
    if (permissionCodes.length === 0) {
      return true;
    }

    // Check each permission individually (could be optimized with a single query)
    for (const permissionCode of permissionCodes) {
      const hasPermission = await this.hasPermission(userId, permissionCode);
      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `user_permissions:${this.tenantId}:${userId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      const query = `
        SELECT DISTINCT p.code
        FROM team_members tm
        JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        JOIN role_permissions rp ON tmr.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE tm.user_id = $1 AND tm.tenant_id = $2
          AND tm.is_active = true
          AND tmr.effective_from <= CURRENT_TIMESTAMP
          AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        ORDER BY p.category, p.code
      `;

      const result = await this.db.query(query, [userId, this.tenantId]);
      const permissions = result.rows.map(row => row.code);

      await this.cache.set(cacheKey, JSON.stringify(permissions));
      return permissions;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(userId: string): Promise<any[]> {
    const cacheKey = `user_roles:${this.tenantId}:${userId}`;
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
          tmr.is_primary,
          tmr.assigned_at
        FROM team_members tm
        JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        JOIN dealership_roles dr ON tmr.role_id = dr.id
        WHERE tm.user_id = $1 AND tm.tenant_id = $2
          AND tm.is_active = true
          AND dr.is_active = true
          AND tmr.effective_from <= CURRENT_TIMESTAMP
          AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        ORDER BY dr.role_level ASC, tmr.assigned_at DESC
      `;

      const result = await this.db.query(query, [userId, this.tenantId]);
      const roles = result.rows;

      await this.cache.set(cacheKey, JSON.stringify(roles));
      return roles;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get primary role for a user
   */
  async getPrimaryRole(userId: string): Promise<any | null> {
    const cacheKey = `primary_role:${this.tenantId}:${userId}`;
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
          dr.role_level
        FROM team_members tm
        JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        JOIN dealership_roles dr ON tmr.role_id = dr.id
        WHERE tm.user_id = $1 AND tm.tenant_id = $2
          AND tm.is_active = true
          AND dr.is_active = true
          AND tmr.is_primary = true
          AND tmr.effective_from <= CURRENT_TIMESTAMP
          AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        LIMIT 1
      `;

      const result = await this.db.query(query, [userId, this.tenantId]);
      const role = result.rows.length > 0 ? result.rows[0] : null;

      await this.cache.set(cacheKey, JSON.stringify(role));
      return role;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Check if user has a specific role
   */
  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const cacheKey = `has_role:${this.tenantId}:${userId}:${roleName}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      const query = `
        SELECT EXISTS (
          SELECT 1 FROM team_members tm
          JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
          JOIN dealership_roles dr ON tmr.role_id = dr.id
          WHERE tm.user_id = $1 AND tm.tenant_id = $2
            AND tm.is_active = true
            AND dr.name = $3
            AND dr.is_active = true
            AND tmr.effective_from <= CURRENT_TIMESTAMP
            AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
        ) as has_role
      `;

      const result = await this.db.query(query, [userId, this.tenantId, roleName]);
      const hasRole = result.rows[0].has_role;

      await this.cache.set(cacheKey, hasRole.toString());
      return hasRole;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get permission level for user (highest role level)
   */
  async getUserPermissionLevel(userId: string): Promise<number> {
    const cacheKey = `user_level:${this.tenantId}:${userId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return parseInt(cached);
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      const query = `
        SELECT MIN(dr.role_level) as highest_level
        FROM team_members tm
        JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        JOIN dealership_roles dr ON tmr.role_id = dr.id
        WHERE tm.user_id = $1 AND tm.tenant_id = $2
          AND tm.is_active = true
          AND dr.is_active = true
          AND tmr.effective_from <= CURRENT_TIMESTAMP
          AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      `;

      const result = await this.db.query(query, [userId, this.tenantId]);
      const level = result.rows[0]?.highest_level || 999; // High number for no roles

      await this.cache.set(cacheKey, level.toString());
      return level;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Check if user can perform action on another user
   * (e.g., manager can manage team members at lower or same level)
   */
  async canManageUser(
    managerUserId: string,
    targetUserId: string
  ): Promise<boolean> {
    // Users can always manage themselves
    if (managerUserId === targetUserId) {
      return true;
    }

    const managerLevel = await this.getUserPermissionLevel(managerUserId);
    const targetLevel = await this.getUserPermissionLevel(targetUserId);

    // Manager must have equal or lower level number (higher permission)
    return managerLevel <= targetLevel && managerLevel < 999;
  }

  /**
   * Clear permission cache for a user
   */
  async clearUserPermissionCache(userId: string): Promise<void> {
    const patterns = [
      `permission:${this.tenantId}:${userId}:*`,
      `user_permissions:${this.tenantId}:${userId}`,
      `user_roles:${this.tenantId}:${userId}`,
      `primary_role:${this.tenantId}:${userId}`,
      `has_role:${this.tenantId}:${userId}:*`,
      `user_level:${this.tenantId}:${userId}`,
      `any_permission:${this.tenantId}:${userId}:*`
    ];

    for (const pattern of patterns) {
      await this.cache.deletePattern(pattern);
    }

    this.logger.info('Cleared permission cache for user', {
      userId,
      tenantId: this.tenantId
    });
  }

  /**
   * Get all available permissions for the tenant
   */
  async getAvailablePermissions(): Promise<any[]> {
    const cacheKey = `available_permissions:${this.tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      const query = `
        SELECT p.*,
          EXISTS (
            SELECT 1 FROM role_permissions rp
            JOIN dealership_roles dr ON rp.role_id = dr.id
            WHERE rp.permission_id = p.id AND dr.tenant_id = $1
          ) as in_use
        FROM permissions p
        ORDER BY p.category, p.name
      `;

      const result = await this.db.query(query, [this.tenantId]);
      const permissions = result.rows;

      await this.cache.set(cacheKey, JSON.stringify(permissions));
      return permissions;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get permissions by category
   */
  async getPermissionsByCategory(category: string): Promise<any[]> {
    const cacheKey = `permissions_category:${this.tenantId}:${category}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    try {
      await this.db.query('SET app.current_tenant_id = $1', [this.tenantId]);

      const query = `
        SELECT *
        FROM permissions
        WHERE category = $1
        ORDER BY name
      `;

      const result = await this.db.query(query, [category]);
      const permissions = result.rows;

      await this.cache.set(cacheKey, JSON.stringify(permissions));
      return permissions;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }
}