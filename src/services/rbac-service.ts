/**
 * Role-Based Access Control (RBAC) Service
 * Epic 1: Story 1.2 - Multi-Tenancy & RBAC Implementation
 *
 * Manages roles, permissions, and access control for the AutoLumiKu platform.
 * Provides fine-grained permission checking and role management.
 */

import { prisma } from '@/lib/prisma';
import { Role, Permission, RolePermission } from '@prisma/client';

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  hasPermission: boolean;
  reason?: string;
  missingPermissions?: string[];
}

/**
 * Role with permissions
 */
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

/**
 * Default system roles
 */
export const SystemRoles = {
  SUPER_ADMIN: 'super_admin',
  PLATFORM_ADMIN: 'platform_admin',
  TENANT_ADMIN: 'tenant_admin',
  SHOWROOM_OWNER: 'showroom_owner',
  SHOWROOM_STAFF: 'showroom_staff',
  SALES_PERSON: 'sales_person',
  USER: 'user',
} as const;

/**
 * Permission categories
 */
export const PermissionCategories = {
  TENANT: 'tenant',
  USER: 'user',
  VEHICLE: 'vehicle',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings',
  BILLING: 'billing',
  AUDIT: 'audit',
} as const;

/**
 * Permission actions
 */
export const PermissionActions = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
} as const;

export class RBACService {
  /**
   * Check if user has specific permission
   */
  async checkPermission(
    userId: string,
    permissionName: string
  ): Promise<PermissionCheckResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return {
          hasPermission: false,
          reason: 'User not found',
        };
      }

      if (!user.role) {
        return {
          hasPermission: false,
          reason: 'User has no role assigned',
        };
      }

      // Super admins have all permissions
      if (user.role.name === SystemRoles.SUPER_ADMIN) {
        return { hasPermission: true };
      }

      // Check if role has the permission
      const hasPermission = user.role.rolePermissions.some(
        (rp) => rp.permission.name === permissionName
      );

      return {
        hasPermission,
        reason: hasPermission ? undefined : 'Permission not granted to role',
      };
    } catch (error) {
      console.error('Permission check failed:', error);
      return {
        hasPermission: false,
        reason: 'Permission check failed',
      };
    }
  }

  /**
   * Check if user has any of the specified permissions (OR logic)
   */
  async checkAnyPermission(
    userId: string,
    permissionNames: string[]
  ): Promise<PermissionCheckResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (!user || !user.role) {
        return {
          hasPermission: false,
          reason: 'User or role not found',
        };
      }

      // Super admins have all permissions
      if (user.role.name === SystemRoles.SUPER_ADMIN) {
        return { hasPermission: true };
      }

      // Check if role has any of the permissions
      const hasAnyPermission = permissionNames.some((permName) =>
        user.role!.rolePermissions.some((rp) => rp.permission.name === permName)
      );

      return {
        hasPermission: hasAnyPermission,
        reason: hasAnyPermission ? undefined : 'None of the required permissions granted',
      };
    } catch (error) {
      console.error('Permission check failed:', error);
      return {
        hasPermission: false,
        reason: 'Permission check failed',
      };
    }
  }

  /**
   * Check if user has all specified permissions (AND logic)
   */
  async checkAllPermissions(
    userId: string,
    permissionNames: string[]
  ): Promise<PermissionCheckResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (!user || !user.role) {
        return {
          hasPermission: false,
          reason: 'User or role not found',
        };
      }

      // Super admins have all permissions
      if (user.role.name === SystemRoles.SUPER_ADMIN) {
        return { hasPermission: true };
      }

      // Get user's permission names
      const userPermissions = user.role.rolePermissions.map((rp) => rp.permission.name);

      // Check which permissions are missing
      const missingPermissions = permissionNames.filter(
        (permName) => !userPermissions.includes(permName)
      );

      return {
        hasPermission: missingPermissions.length === 0,
        reason: missingPermissions.length > 0 ? 'Missing required permissions' : undefined,
        missingPermissions,
      };
    } catch (error) {
      console.error('Permission check failed:', error);
      return {
        hasPermission: false,
        reason: 'Permission check failed',
      };
    }
  }

  /**
   * Get user's role with all permissions
   */
  async getUserRole(userId: string): Promise<RoleWithPermissions | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (!user || !user.role) {
        return null;
      }

      return {
        ...user.role,
        permissions: user.role.rolePermissions.map((rp) => rp.permission),
      };
    } catch (error) {
      console.error('Get user role failed:', error);
      return null;
    }
  }

  /**
   * Get all permissions for a role
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    try {
      const rolePermissions = await prisma.rolePermission.findMany({
        where: { roleId },
        include: { permission: true },
      });

      return rolePermissions.map((rp) => rp.permission);
    } catch (error) {
      console.error('Get role permissions failed:', error);
      return [];
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { roleId },
      });

      return true;
    } catch (error) {
      console.error('Assign role failed:', error);
      return false;
    }
  }

  /**
   * Create a new role
   */
  async createRole(
    tenantId: string,
    name: string,
    description: string,
    level: number
  ): Promise<Role | null> {
    try {
      const role = await prisma.role.create({
        data: {
          tenantId,
          name,
          description,
          level,
        },
      });

      return role;
    } catch (error) {
      console.error('Create role failed:', error);
      return null;
    }
  }

  /**
   * Update role
   */
  async updateRole(
    roleId: string,
    data: {
      name?: string;
      description?: string;
      level?: number;
    }
  ): Promise<Role | null> {
    try {
      const role = await prisma.role.update({
        where: { id: roleId },
        data,
      });

      return role;
    } catch (error) {
      console.error('Update role failed:', error);
      return null;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<boolean> {
    try {
      // Check if role is being used
      const usersWithRole = await prisma.user.count({
        where: { roleId },
      });

      if (usersWithRole > 0) {
        console.error('Cannot delete role: role is assigned to users');
        return false;
      }

      await prisma.role.delete({
        where: { id: roleId },
      });

      return true;
    } catch (error) {
      console.error('Delete role failed:', error);
      return false;
    }
  }

  /**
   * Grant permission to role
   */
  async grantPermission(roleId: string, permissionId: string): Promise<boolean> {
    try {
      await prisma.rolePermission.create({
        data: {
          roleId,
          permissionId,
        },
      });

      return true;
    } catch (error) {
      console.error('Grant permission failed:', error);
      return false;
    }
  }

  /**
   * Revoke permission from role
   */
  async revokePermission(roleId: string, permissionId: string): Promise<boolean> {
    try {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId,
          permissionId,
        },
      });

      return true;
    } catch (error) {
      console.error('Revoke permission failed:', error);
      return false;
    }
  }

  /**
   * Get all roles for a tenant
   */
  async getTenantRoles(tenantId: string): Promise<Role[]> {
    try {
      const roles = await prisma.role.findMany({
        where: { tenantId },
        orderBy: { level: 'desc' },
      });

      return roles;
    } catch (error) {
      console.error('Get tenant roles failed:', error);
      return [];
    }
  }

  /**
   * Get all available permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    try {
      const permissions = await prisma.permission.findMany({
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });

      return permissions;
    } catch (error) {
      console.error('Get all permissions failed:', error);
      return [];
    }
  }

  /**
   * Create a new permission
   */
  async createPermission(
    name: string,
    description: string,
    category: string
  ): Promise<Permission | null> {
    try {
      const permission = await prisma.permission.create({
        data: {
          name,
          description,
          category,
        },
      });

      return permission;
    } catch (error) {
      console.error('Create permission failed:', error);
      return null;
    }
  }

  /**
   * Check if user has access to specific tenant
   */
  async checkTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });

      if (!user) {
        return false;
      }

      // Super admins and platform admins have access to all tenants
      if (
        user.role?.name === SystemRoles.SUPER_ADMIN ||
        user.role?.name === SystemRoles.PLATFORM_ADMIN
      ) {
        return true;
      }

      // Regular users can only access their own tenant
      return user.tenantId === tenantId;
    } catch (error) {
      console.error('Check tenant access failed:', error);
      return false;
    }
  }

  /**
   * Generate permission name from category and action
   * e.g., generatePermissionName('vehicle', 'create') => 'vehicle:create'
   */
  static generatePermissionName(category: string, action: string): string {
    return `${category}:${action}`;
  }

  /**
   * Parse permission name into category and action
   * e.g., parsePermissionName('vehicle:create') => { category: 'vehicle', action: 'create' }
   */
  static parsePermissionName(permission: string): { category: string; action: string } | null {
    const parts = permission.split(':');
    if (parts.length !== 2) {
      return null;
    }

    return {
      category: parts[0],
      action: parts[1],
    };
  }
}

export const rbacService = new RBACService();
