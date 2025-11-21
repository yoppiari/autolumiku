/**
 * Billing & Subscription Service
 * Epic 1: Story 1.6 - Billing Management
 *
 * Handles subscription plans, invoices, and usage tracking
 */

import { prisma } from '@/lib/prisma';
import { Subscription, Invoice } from '@prisma/client';

/**
 * Subscription plan definition
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in IDR
  interval: string;
  features: string[];
  limits: {
    users: number; // -1 for unlimited
    vehicles: number; // -1 for unlimited
    storage: number; // in GB
  };
}

/**
 * Usage statistics
 */
export interface UsageStats {
  users: {
    current: number;
    limit: number; // -1 for unlimited
  };
  vehicles: {
    current: number;
    limit: number; // -1 for unlimited
  };
  storage: {
    current: number; // in GB
    limit: number; // in GB
  };
}

/**
 * Invoice with details
 */
export interface InvoiceWithDetails extends Invoice {
  lineItems?: any[];
}

export class BillingService {
  // Define subscription plans
  private plans: SubscriptionPlan[] = [
    {
      id: 'trial',
      name: 'Trial',
      price: 0,
      interval: 'month',
      features: [
        'Up to 5 users',
        'Up to 50 vehicles',
        '10 GB storage',
        'Basic analytics',
        'Email support',
      ],
      limits: {
        users: 5,
        vehicles: 50,
        storage: 10,
      },
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 299000,
      interval: 'month',
      features: [
        'Up to 10 users',
        'Up to 200 vehicles',
        '50 GB storage',
        'Advanced analytics',
        'Priority email support',
        'Custom branding',
      ],
      limits: {
        users: 10,
        vehicles: 200,
        storage: 50,
      },
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 599000,
      interval: 'month',
      features: [
        'Up to 50 users',
        'Up to 1,000 vehicles',
        '250 GB storage',
        'Advanced analytics & reports',
        'Priority support (24/7)',
        'Custom branding',
        'API access',
        'Multi-location support',
      ],
      limits: {
        users: 50,
        vehicles: 1000,
        storage: 250,
      },
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 1999000,
      interval: 'month',
      features: [
        'Unlimited users',
        'Unlimited vehicles',
        '1 TB storage',
        'Enterprise analytics',
        'Dedicated support manager',
        'Custom branding & white-label',
        'Full API access',
        'Multi-location support',
        'Custom integrations',
        'SLA guarantee',
      ],
      limits: {
        users: -1, // unlimited
        vehicles: -1, // unlimited
        storage: 1000,
      },
    },
  ];

  /**
   * Get all available plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    return this.plans;
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    const plan = this.plans.find((p) => p.id === planId);
    return plan || null;
  }

  /**
   * Get current subscription for tenant
   */
  async getCurrentSubscription(tenantId: string): Promise<{
    success: boolean;
    data?: SubscriptionPlan;
    message?: string;
  }> {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          tenantId,
          status: {
            in: ['active', 'trialing'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        return {
          success: false,
          message: 'No active subscription found',
        };
      }

      // Get plan details
      const plan = await this.getPlanById(subscription.plan);

      if (!plan) {
        return {
          success: false,
          message: 'Plan not found',
        };
      }

      return {
        success: true,
        data: plan,
      };
    } catch (error) {
      console.error('Get current subscription failed:', error);
      return {
        success: false,
        message: 'Failed to retrieve subscription',
      };
    }
  }

  /**
   * Get invoices for tenant
   */
  async getInvoices(tenantId: string, options?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    success: boolean;
    data?: {
      invoices: InvoiceWithDetails[];
      total: number;
    };
    message?: string;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = { tenantId };

      if (options?.status) {
        where.status = options.status;
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          include: {
            lineItems: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      return {
        success: true,
        data: {
          invoices,
          total,
        },
      };
    } catch (error) {
      console.error('Get invoices failed:', error);
      return {
        success: false,
        message: 'Failed to retrieve invoices',
      };
    }
  }

  /**
   * Get usage statistics for tenant
   */
  async getUsageStats(tenantId: string): Promise<{
    success: boolean;
    data?: UsageStats;
    message?: string;
  }> {
    try {
      // Get current subscription plan
      const subscriptionResult = await this.getCurrentSubscription(tenantId);

      if (!subscriptionResult.success || !subscriptionResult.data) {
        return {
          success: false,
          message: 'No active subscription found',
        };
      }

      const plan = subscriptionResult.data;

      // Get current usage
      const [userCount, vehicleCount] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.vehicle.count({ where: { tenantId } }),
      ]);

      // Calculate storage (placeholder - implement actual storage calculation)
      const storageUsed = 0; // TODO: Implement actual storage calculation

      return {
        success: true,
        data: {
          users: {
            current: userCount,
            limit: plan.limits.users,
          },
          vehicles: {
            current: vehicleCount,
            limit: plan.limits.vehicles,
          },
          storage: {
            current: storageUsed,
            limit: plan.limits.storage,
          },
        },
      };
    } catch (error) {
      console.error('Get usage stats failed:', error);
      return {
        success: false,
        message: 'Failed to retrieve usage statistics',
      };
    }
  }

  /**
   * Create invoice for tenant
   */
  async createInvoice(
    tenantId: string,
    data: {
      amount: number;
      dueDate: Date;
      items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>;
    }
  ): Promise<{
    success: boolean;
    invoice?: Invoice;
    message?: string;
  }> {
    try {
      // Get tenant info
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        return {
          success: false,
          message: 'Tenant not found',
        };
      }

      // Calculate amounts
      const subtotal = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const taxRate = 11.0; // PPN 11%
      const taxAmount = Math.round((subtotal * taxRate) / 100);
      const total = subtotal + taxAmount;

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          tenantId,
          status: 'open',
          amount: total,
          subtotal,
          taxAmount,
          ppnRate: taxRate,
          ppnAmount: taxAmount,
          currency: 'IDR',
          dueDate: data.dueDate,
          periodStart: new Date(),
          periodEnd: new Date(),
          companyName: tenant.name,
          companyAddress: '',
          lineItems: {
            create: data.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
            })),
          },
        },
      });

      return {
        success: true,
        invoice,
        message: 'Invoice created successfully',
      };
    } catch (error) {
      console.error('Create invoice failed:', error);
      return {
        success: false,
        message: 'Failed to create invoice',
      };
    }
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Get count of invoices this month
    const count = await prisma.invoice.count({
      where: {
        createdAt: {
          gte: new Date(year, now.getMonth(), 1),
          lt: new Date(year, now.getMonth() + 1, 1),
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');

    return `INV-${year}${month}-${sequence}`;
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    tenantId: string,
    userId: string,
    action: string,
    metadata: any
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action,
          entityType: 'billing',
          entityId: metadata.entityId || '',
          changes: metadata as any,
        },
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

export const billingService = new BillingService();
