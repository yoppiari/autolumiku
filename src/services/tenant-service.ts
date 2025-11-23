/**
 * Tenant Management Service
 * Epic 1: Story 1.5 - Tenant CRUD & Management
 *
 * Handles tenant creation, configuration, subscription management,
 * and tenant lifecycle operations for the AutoLumiKu platform.
 */

import { prisma } from '@/lib/prisma';
import { Tenant, Subscription } from '@prisma/client';
import { authService } from './auth-service';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DEFAULT_TRIAL_DAYS = parseInt(process.env.DEFAULT_TRIAL_DAYS || '14');

/**
 * Tenant creation request
 */
export interface CreateTenantRequest {
  name: string;
  slug: string;
  domain?: string | null; // Custom domain
  industry?: string;
  adminUser: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
  subscription?: {
    planId: string;
    billingInterval: 'monthly' | 'yearly';
  };
}

/**
 * Tenant update request
 */
export interface UpdateTenantRequest {
  name?: string;
  slug?: string;
  domain?: string | null; // Custom domain
  industry?: string;
  logoUrl?: string;
  settings?: any;
  isActive?: boolean;
}

/**
 * Tenant with subscription info
 */
export interface TenantWithSubscription extends Tenant {
  subscriptions: Subscription[];
  _count: {
    users: number;
    vehicles: number;
  };
}

export class TenantService {
  /**
   * Create a new tenant with admin user
   */
  async createTenant(data: CreateTenantRequest): Promise<{
    success: boolean;
    tenant?: Tenant;
    adminUser?: any;
    adminPassword?: string; // Return generated password for display
    message?: string;
  }> {
    try {
      // Check if slug is available
      const existingTenant = await prisma.tenant.findUnique({
        where: { slug: data.slug },
      });

      if (existingTenant) {
        return {
          success: false,
          message: 'Subdomain already taken',
        };
      }

      // Create tenant in transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create tenant
        const tenant = await tx.tenant.create({
          data: {
            name: data.name,
            slug: data.slug,
            domain: data.domain, // Custom domain (optional)
            createdBy: 'system', // Will be updated to actual admin user ID after creation
          },
        });

        // 2. Get or create tenant_admin role
        // Use tenant-specific role name to avoid unique constraint issues
        const roleName = `${tenant.slug}_admin`;

        let adminRole = await tx.role.findFirst({
          where: {
            name: roleName,
          },
        });

        if (!adminRole) {
          adminRole = await tx.role.create({
            data: {
              tenantId: tenant.id,
              name: roleName,
              displayName: 'Tenant Administrator',
              displayNameId: 'Administrator Tenant',
              description: 'Tenant Administrator',
              isSystem: true,
            },
          });
        }

        // 3. Create admin user
        // Store plain password to return (will be hashed for DB)
        const plainPassword = data.adminUser.password;
        const hashedPassword = await bcrypt.hash(plainPassword, 12);

        const adminUser = await tx.user.create({
          data: {
            email: data.adminUser.email,
            passwordHash: hashedPassword,
            firstName: data.adminUser.firstName,
            lastName: data.adminUser.lastName,
            tenantId: tenant.id,
            role: adminRole.name,
            emailVerified: true, // Auto-verify admin user
            failedLoginAttempts: 0,
          },
        });

        // 4. Create subscription (trial by default)
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + DEFAULT_TRIAL_DAYS);

        const subscription = await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            plan: data.subscription?.planId || 'basic',
            status: 'trialing',
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndDate,
            trialEnd: trialEndDate,
            pricePerMonth: 0, // Free during trial
          },
        });

        return {
          tenant,
          adminUser,
          subscription,
          plainPassword, // Return for display to platform admin
        };
      });

      // Log tenant creation
      await this.logAuditEvent(result.tenant.id, 'tenant_created', {
        tenantName: result.tenant.name,
        slug: result.tenant.slug,
        adminEmail: data.adminUser.email,
      });

      return {
        success: true,
        tenant: result.tenant,
        adminUser: result.adminUser,
        adminPassword: result.plainPassword, // Return password for display
        message: 'Tenant created successfully',
      };
    } catch (error) {
      console.error('Tenant creation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Tenant creation failed',
      };
    }
  }

  /**
   * Get tenant by ID with subscription info
   */
  async getTenant(tenantId: string): Promise<TenantWithSubscription | null> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: true,
          _count: {
            select: {
              users: true,
              vehicles: true,
            },
          },
        },
      });

      return tenant;
    } catch (error) {
      console.error('Get tenant failed:', error);
      return null;
    }
  }

  /**
   * Get all tenants (admin only)
   */
  async getAllTenants(options?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'inactive';
  }): Promise<{
    tenants: TenantWithSubscription[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (options?.search) {
        where.OR = [
          { name: { contains: options.search, mode: 'insensitive' } },
          { slug: { contains: options.search, mode: 'insensitive' } },
        ];
      }

      if (options?.status === 'active') {
        where.isActive = true;
      } else if (options?.status === 'inactive') {
        where.isActive = false;
      }

      // Simplified query without problematic includes for now
      const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
          where,
          skip,
          take: limit,
          include: {
            subscription: true,
            _count: {
              select: {
                users: true,
                vehicles: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.tenant.count({ where }),
      ]);

      return {
        tenants: tenants as any,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('Get all tenants failed:', error);
      throw error; // Throw error instead of silently returning empty array
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(
    tenantId: string,
    data: UpdateTenantRequest
  ): Promise<{ success: boolean; tenant?: Tenant; message?: string }> {
    try {
      // Check slug availability if changing
      if (data.slug) {
        const existing = await prisma.tenant.findFirst({
          where: {
            slug: data.slug,
            id: { not: tenantId },
          },
        });

        if (existing) {
          return {
            success: false,
            message: 'Subdomain already taken',
          };
        }
      }

      const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data,
      });

      await this.logAuditEvent(tenantId, 'tenant_updated', {
        changes: data,
      });

      return {
        success: true,
        tenant,
        message: 'Tenant updated successfully',
      };
    } catch (error) {
      console.error('Update tenant failed:', error);
      return {
        success: false,
        message: 'Failed to update tenant',
      };
    }
  }

  /**
   * Deactivate tenant (soft delete)
   */
  async deactivateTenant(tenantId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          isActive: false,
        },
      });

      await this.logAuditEvent(tenantId, 'tenant_deactivated', {
        deactivatedAt: new Date(),
      });

      return {
        success: true,
        message: 'Tenant deactivated successfully',
      };
    } catch (error) {
      console.error('Deactivate tenant failed:', error);
      return {
        success: false,
        message: 'Failed to deactivate tenant',
      };
    }
  }

  /**
   * Reactivate tenant
   */
  async reactivateTenant(tenantId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          isActive: true,
        },
      });

      await this.logAuditEvent(tenantId, 'tenant_reactivated', {
        reactivatedAt: new Date(),
      });

      return {
        success: true,
        message: 'Tenant reactivated successfully',
      };
    } catch (error) {
      console.error('Reactivate tenant failed:', error);
      return {
        success: false,
        message: 'Failed to reactivate tenant',
      };
    }
  }

  /**
   * Delete tenant permanently (dangerous!)
   */
  async deleteTenant(tenantId: string): Promise<{ success: boolean; message?: string }> {
    try {
      // This should cascade delete all related records due to Prisma schema
      await prisma.tenant.delete({
        where: { id: tenantId },
      });

      return {
        success: true,
        message: 'Tenant deleted permanently',
      };
    } catch (error) {
      console.error('Delete tenant failed:', error);
      return {
        success: false,
        message: 'Failed to delete tenant',
      };
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId: string): Promise<{
    users: number;
    vehicles: number;
    activeListings: number;
    soldVehicles: number;
    revenue: number;
  }> {
    try {
      const [users, vehicles, activeListings, soldVehicles, revenueData] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.vehicle.count({ where: { tenantId } }),
        prisma.vehicle.count({
          where: { tenantId, status: 'AVAILABLE' },
        }),
        prisma.vehicle.count({
          where: { tenantId, status: 'SOLD' },
        }),
        prisma.vehicle.aggregate({
          where: { tenantId, status: 'SOLD' },
          _sum: { price: true },
        }),
      ]);

      return {
        users,
        vehicles,
        activeListings,
        soldVehicles,
        revenue: revenueData._sum.price || 0,
      };
    } catch (error) {
      console.error('Get tenant stats failed:', error);
      return {
        users: 0,
        vehicles: 0,
        activeListings: 0,
        soldVehicles: 0,
        revenue: 0,
      };
    }
  }

  /**
   * Check slug availability
   */
  async checkSlugAvailability(slug: string): Promise<boolean> {
    try {
      const existing = await prisma.tenant.findUnique({
        where: { slug },
      });

      return !existing;
    } catch (error) {
      console.error('Check slug availability failed:', error);
      return false;
    }
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
      });

      return tenant;
    } catch (error) {
      console.error('Get tenant by slug failed:', error);
      return null;
    }
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    tenantId: string,
    action: string,
    metadata: any
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: metadata.userId || '',
          action,
          entityType: 'tenant',
          entityId: tenantId,
          changes: metadata as any,
        },
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

export const tenantService = new TenantService();
