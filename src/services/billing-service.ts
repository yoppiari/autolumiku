/**
 * Billing Service
 * Epic 1: Story 1.8 - Subscription & Billing Management
 *
 * Handles subscriptions, invoices, payments, and billing operations
 * for the AutoLumiKu platform.
 */

import { prisma } from '@/lib/prisma';
import { Subscription, Invoice, Payment } from '@prisma/client';

/**
 * Subscription plan
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
  limits: {
    users: number;
    vehicles: number;
    storage: number; // in GB
  };
}

/**
 * Create subscription request
 */
export interface CreateSubscriptionRequest {
  tenantId: string;
  planId: string;
  billingInterval: 'monthly' | 'yearly';
  paymentMethodId?: string;
}

/**
 * Invoice with payment info
 */
export interface InvoiceWithPayments extends Invoice {
  payments: Payment[];
}

export class BillingService {
  /**
   * Available subscription plans
   */
  private readonly plans: SubscriptionPlan[] = [
    {
      id: 'trial',
      name: 'Trial',
      price: 0,
      interval: 'monthly',
      features: ['Basic features', 'Limited support'],
      limits: {
        users: 2,
        vehicles: 20,
        storage: 1,
      },
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 99000,
      interval: 'monthly',
      features: ['All basic features', 'Email support', 'Analytics'],
      limits: {
        users: 5,
        vehicles: 100,
        storage: 5,
      },
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 299000,
      interval: 'monthly',
      features: ['All starter features', 'Priority support', 'Advanced analytics', 'Custom branding'],
      limits: {
        users: 15,
        vehicles: 500,
        storage: 20,
      },
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 999000,
      interval: 'monthly',
      features: [
        'All professional features',
        '24/7 support',
        'Custom integrations',
        'Dedicated account manager',
      ],
      limits: {
        users: -1, // unlimited
        vehicles: -1, // unlimited
        storage: 100,
      },
    },
  ];

  /**
   * Get all available plans
   */
  getPlans(): SubscriptionPlan[] {
    return this.plans;
  }

  /**
   * Get plan by ID
   */
  getPlan(planId: string): SubscriptionPlan | undefined {
    return this.plans.find((p) => p.id === planId);
  }

  /**
   * Create new subscription
   */
  async createSubscription(data: CreateSubscriptionRequest): Promise<{
    success: boolean;
    subscription?: Subscription;
    message?: string;
  }> {
    try {
      const plan = this.getPlan(data.planId);
      if (!plan) {
        return {
          success: false,
          message: 'Invalid plan ID',
        };
      }

      // Calculate period dates
      const startDate = new Date();
      const endDate = new Date();
      if (data.billingInterval === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Create subscription
      const subscription = await prisma.subscription.create({
        data: {
          tenantId: data.tenantId,
          planId: data.planId,
          status: 'active',
          billingInterval: data.billingInterval,
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
        },
      });

      // Generate first invoice
      const amount = plan.price;
      await this.generateInvoice({
        tenantId: data.tenantId,
        subscriptionId: subscription.id,
        amount,
        dueDate: startDate,
      });

      // Log audit event
      await this.logAuditEvent(data.tenantId, 'subscription_created', {
        subscriptionId: subscription.id,
        planId: data.planId,
      });

      return {
        success: true,
        subscription,
        message: 'Subscription created successfully',
      };
    } catch (error) {
      console.error('Create subscription failed:', error);
      return {
        success: false,
        message: 'Failed to create subscription',
      };
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    planId: string
  ): Promise<{
    success: boolean;
    subscription?: Subscription;
    message?: string;
  }> {
    try {
      const plan = this.getPlan(planId);
      if (!plan) {
        return {
          success: false,
          message: 'Invalid plan ID',
        };
      }

      const subscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          planId,
        },
      });

      // Log audit event
      await this.logAuditEvent(subscription.tenantId, 'subscription_updated', {
        subscriptionId,
        newPlanId: planId,
      });

      return {
        success: true,
        subscription,
        message: 'Subscription updated successfully',
      };
    } catch (error) {
      console.error('Update subscription failed:', error);
      return {
        success: false,
        message: 'Failed to update subscription',
      };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const subscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'canceled',
          canceledAt: new Date(),
        },
      });

      // Log audit event
      await this.logAuditEvent(subscription.tenantId, 'subscription_canceled', {
        subscriptionId,
      });

      return {
        success: true,
        message: 'Subscription canceled',
      };
    } catch (error) {
      console.error('Cancel subscription failed:', error);
      return {
        success: false,
        message: 'Failed to cancel subscription',
      };
    }
  }

  /**
   * Generate invoice
   */
  async generateInvoice(data: {
    tenantId: string;
    subscriptionId: string;
    amount: number;
    dueDate: Date;
    items?: Array<{ description: string; amount: number }>;
  }): Promise<Invoice | null> {
    try {
      const invoice = await prisma.invoice.create({
        data: {
          tenantId: data.tenantId,
          subscriptionId: data.subscriptionId,
          invoiceNumber: this.generateInvoiceNumber(),
          amount: data.amount,
          status: 'pending',
          dueDate: data.dueDate,
          items: (data.items || []) as any,
        },
      });

      return invoice;
    } catch (error) {
      console.error('Generate invoice failed:', error);
      return null;
    }
  }

  /**
   * Generate unique invoice number
   */
  private generateInvoiceNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `INV-${timestamp}-${random}`;
  }

  /**
   * Get invoices for tenant
   */
  async getInvoices(tenantId: string, options?: {
    status?: 'pending' | 'paid' | 'overdue' | 'canceled';
    page?: number;
    limit?: number;
  }): Promise<{
    invoices: InvoiceWithPayments[];
    total: number;
    page: number;
    limit: number;
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
            payments: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      return {
        invoices,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('Get invoices failed:', error);
      return {
        invoices: [],
        total: 0,
        page: 1,
        limit: 20,
      };
    }
  }

  /**
   * Record payment
   */
  async recordPayment(data: {
    invoiceId: string;
    amount: number;
    paymentMethod: string;
    transactionId?: string;
  }): Promise<{
    success: boolean;
    payment?: Payment;
    message?: string;
  }> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: data.invoiceId },
      });

      if (!invoice) {
        return {
          success: false,
          message: 'Invoice not found',
        };
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          invoiceId: data.invoiceId,
          tenantId: invoice.tenantId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId || '',
          status: 'completed',
        },
      });

      // Update invoice status
      const totalPaid = await prisma.payment.aggregate({
        where: { invoiceId: data.invoiceId },
        _sum: { amount: true },
      });

      const paidAmount = totalPaid._sum.amount || 0;
      if (paidAmount >= invoice.amount) {
        await prisma.invoice.update({
          where: { id: data.invoiceId },
          data: {
            status: 'paid',
            paidAt: new Date(),
          },
        });
      }

      // Log audit event
      await this.logAuditEvent(invoice.tenantId, 'payment_recorded', {
        invoiceId: data.invoiceId,
        paymentId: payment.id,
        amount: data.amount,
      });

      return {
        success: true,
        payment,
        message: 'Payment recorded successfully',
      };
    } catch (error) {
      console.error('Record payment failed:', error);
      return {
        success: false,
        message: 'Failed to record payment',
      };
    }
  }

  /**
   * Check subscription status
   */
  async checkSubscriptionStatus(tenantId: string): Promise<{
    isActive: boolean;
    subscription?: Subscription;
    daysUntilExpiry?: number;
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
          currentPeriodEnd: 'desc',
        },
      });

      if (!subscription) {
        return { isActive: false };
      }

      const now = new Date();
      const daysUntilExpiry = Math.ceil(
        (subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        isActive: subscription.currentPeriodEnd > now,
        subscription,
        daysUntilExpiry,
      };
    } catch (error) {
      console.error('Check subscription status failed:', error);
      return { isActive: false };
    }
  }

  /**
   * Get subscription usage stats
   */
  async getUsageStats(tenantId: string): Promise<{
    users: { current: number; limit: number };
    vehicles: { current: number; limit: number };
    storage: { current: number; limit: number };
  }> {
    try {
      // Get current subscription
      const subscription = await prisma.subscription.findFirst({
        where: {
          tenantId,
          status: { in: ['active', 'trialing'] },
        },
      });

      const plan = subscription ? this.getPlan(subscription.planId) : undefined;
      const limits = plan?.limits || { users: 0, vehicles: 0, storage: 0 };

      // Get actual usage
      const [userCount, vehicleCount] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.vehicle.count({ where: { tenantId } }),
      ]);

      return {
        users: {
          current: userCount,
          limit: limits.users,
        },
        vehicles: {
          current: vehicleCount,
          limit: limits.vehicles,
        },
        storage: {
          current: 0, // TODO: Calculate actual storage usage
          limit: limits.storage,
        },
      };
    } catch (error) {
      console.error('Get usage stats failed:', error);
      return {
        users: { current: 0, limit: 0 },
        vehicles: { current: 0, limit: 0 },
        storage: { current: 0, limit: 0 },
      };
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
          userId: '',
          action,
          entityType: 'billing',
          entityId: metadata.subscriptionId || metadata.invoiceId || '',
          changes: metadata as any,
        },
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

export const billingService = new BillingService();
