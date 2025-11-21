/**
 * Billing Service
 * Handles subscription billing, invoices, and Indonesian payment processing
 * Part of Story 1.6: Subscription & Billing Access
 */

import { createLogger, format, transports } from 'winston';
import { z } from 'zod';

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'logs/billing-error.log', level: 'error' }),
    new transports.File({ filename: 'logs/billing-combined.log' })
  ]
});

export enum SubscriptionPlan {
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  EXPIRED = 'expired'
}

export enum PaymentMethod {
  BANK_TRANSFER_BCA = 'bank_transfer_bca',
  BANK_TRANSFER_MANDIRI = 'bank_transfer_mandiri',
  BANK_TRANSFER_BNI = 'bank_transfer_bni',
  BANK_TRANSFER_BRI = 'bank_transfer_bri',
  EWALLET_GOPAY = 'ewallet_gopay',
  EWALLET_OVO = 'ewallet_ovo',
  EWALLET_DANA = 'ewallet_dana',
  VIRTUAL_ACCOUNT = 'virtual_account',
  CREDIT_CARD = 'credit_card'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  EXPIRED = 'expired'
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  OVERDUE = 'overdue'
}

export interface SubscriptionPlanDetails {
  id: string;
  name: string;
  nameIndonesian: string;
  description: string;
  descriptionIndonesian: string;
  price: number; // in IDR
  currency: 'IDR' | 'USD';
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  limits: {
    maxVehicles: number;
    maxUsers: number;
    maxStorage: number; // in GB
    aiSuggestionsPerMonth: number;
  };
}

export interface Subscription {
  id: string;
  tenantId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  cancelAt?: Date;
  pricePerMonth: number;
  currency: string;
  paymentMethod?: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paidAt?: Date;
  failureReason?: string;
  gatewayTransactionId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  subscriptionId: string;
  status: InvoiceStatus;
  amount: number;
  subtotal: number;
  taxAmount: number; // PPN 11%
  currency: string;
  dueDate: Date;
  paidAt?: Date;
  periodStart: Date;
  periodEnd: Date;
  lineItems: InvoiceLineItem[];
  taxInformation: IndonesianTaxInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IndonesianTaxInfo {
  ppnRate: number; // 11%
  ppnAmount: number;
  npwp?: string; // Nomor Pokok Wajib Pajak
  companyName: string;
  companyAddress: string;
}

export interface UsageMetrics {
  tenantId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    vehiclesCount: number;
    usersCount: number;
    storageUsedGB: number;
    aiSuggestionsUsed: number;
    apiCallsCount: number;
  };
  limits: {
    maxVehicles: number;
    maxUsers: number;
    maxStorage: number;
    aiSuggestionsPerMonth: number;
  };
}

export class BillingService {
  private subscriptions: Map<string, Subscription> = new Map();
  private payments: Map<string, Payment> = new Map();
  private invoices: Map<string, Invoice> = new Map();

  // Subscription plans configuration
  private plans: Map<SubscriptionPlan, SubscriptionPlanDetails> = new Map([
    [SubscriptionPlan.BASIC, {
      id: 'basic',
      name: 'Basic Plan',
      nameIndonesian: 'Paket Dasar',
      description: 'Perfect for small showrooms starting out',
      descriptionIndonesian: 'Sempurna untuk showroom kecil yang baru memulai',
      price: 299000, // IDR per month
      currency: 'IDR',
      billingCycle: 'monthly',
      features: [
        'Up to 50 vehicles',
        'Up to 5 users',
        '10 GB storage',
        '100 AI suggestions/month',
        'Basic analytics',
        'Email support'
      ],
      limits: {
        maxVehicles: 50,
        maxUsers: 5,
        maxStorage: 10,
        aiSuggestionsPerMonth: 100
      }
    }],
    [SubscriptionPlan.PROFESSIONAL, {
      id: 'professional',
      name: 'Professional Plan',
      nameIndonesian: 'Paket Profesional',
      description: 'For growing showrooms with advanced needs',
      descriptionIndonesian: 'Untuk showroom berkembang dengan kebutuhan lanjutan',
      price: 799000, // IDR per month
      currency: 'IDR',
      billingCycle: 'monthly',
      features: [
        'Up to 200 vehicles',
        'Up to 20 users',
        '50 GB storage',
        '500 AI suggestions/month',
        'Advanced analytics',
        'Priority support',
        'Custom branding',
        'API access'
      ],
      limits: {
        maxVehicles: 200,
        maxUsers: 20,
        maxStorage: 50,
        aiSuggestionsPerMonth: 500
      }
    }],
    [SubscriptionPlan.ENTERPRISE, {
      id: 'enterprise',
      name: 'Enterprise Plan',
      nameIndonesian: 'Paket Enterprise',
      description: 'For large dealerships with custom requirements',
      descriptionIndonesian: 'Untuk dealer besar dengan kebutuhan khusus',
      price: 1999000, // IDR per month
      currency: 'IDR',
      billingCycle: 'monthly',
      features: [
        'Unlimited vehicles',
        'Unlimited users',
        '200 GB storage',
        'Unlimited AI suggestions',
        'Enterprise analytics',
        'Dedicated support',
        'Custom branding',
        'Full API access',
        'SLA guarantee',
        'Custom integrations'
      ],
      limits: {
        maxVehicles: -1, // Unlimited
        maxUsers: -1, // Unlimited
        maxStorage: 200,
        aiSuggestionsPerMonth: -1 // Unlimited
      }
    }]
  ]);

  constructor() {
    logger.info('Billing Service initialized');
  }

  /**
   * Get all available subscription plans
   */
  async getAvailablePlans(): Promise<SubscriptionPlanDetails[]> {
    return Array.from(this.plans.values());
  }

  /**
   * Get subscription plan details
   */
  async getPlanDetails(plan: SubscriptionPlan): Promise<SubscriptionPlanDetails | null> {
    return this.plans.get(plan) || null;
  }

  /**
   * Create new subscription for tenant
   */
  async createSubscription(
    tenantId: string,
    plan: SubscriptionPlan,
    paymentMethod?: PaymentMethod
  ): Promise<Subscription> {
    try {
      const planDetails = this.plans.get(plan);
      if (!planDetails) {
        throw new Error('Invalid subscription plan');
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 day trial
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const subscription: Subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        plan,
        status: SubscriptionStatus.TRIALING,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEnd,
        pricePerMonth: planDetails.price,
        currency: planDetails.currency,
        paymentMethod,
        createdAt: now,
        updatedAt: now
      };

      this.subscriptions.set(subscription.id, subscription);

      logger.info(`Subscription created for tenant ${tenantId}: ${plan}`);

      return subscription;
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription for tenant
   */
  async getSubscription(tenantId: string): Promise<Subscription | null> {
    const subscription = Array.from(this.subscriptions.values())
      .find(sub => sub.tenantId === tenantId);

    return subscription || null;
  }

  /**
   * Upgrade/downgrade subscription
   */
  async changeSubscriptionPlan(
    subscriptionId: string,
    newPlan: SubscriptionPlan
  ): Promise<{ subscription: Subscription; prorationAmount: number }> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const oldPlanDetails = this.plans.get(subscription.plan);
      const newPlanDetails = this.plans.get(newPlan);

      if (!oldPlanDetails || !newPlanDetails) {
        throw new Error('Invalid plan');
      }

      // Calculate proration
      const now = new Date();
      const remainingDays = Math.ceil(
        (subscription.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      const totalDays = 30;
      const unusedAmount = (oldPlanDetails.price / totalDays) * remainingDays;
      const newPlanProrated = (newPlanDetails.price / totalDays) * remainingDays;
      const prorationAmount = newPlanProrated - unusedAmount;

      // Update subscription
      subscription.plan = newPlan;
      subscription.pricePerMonth = newPlanDetails.price;
      subscription.updatedAt = now;

      logger.info(`Subscription ${subscriptionId} changed from ${oldPlanDetails.name} to ${newPlanDetails.name}`);

      return {
        subscription,
        prorationAmount: Math.round(prorationAmount)
      };
    } catch (error) {
      logger.error('Error changing subscription plan:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately: boolean = false
  ): Promise<Subscription> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const now = new Date();

      if (cancelImmediately) {
        subscription.status = SubscriptionStatus.CANCELED;
        subscription.canceledAt = now;
      } else {
        // Cancel at period end
        subscription.cancelAt = subscription.currentPeriodEnd;
        subscription.canceledAt = now;
      }

      subscription.updatedAt = now;

      logger.info(`Subscription ${subscriptionId} canceled`);

      return subscription;
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Create invoice for subscription
   */
  async createInvoice(
    subscriptionId: string,
    taxInformation: IndonesianTaxInfo
  ): Promise<Invoice> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const planDetails = this.plans.get(subscription.plan);
      if (!planDetails) {
        throw new Error('Plan not found');
      }

      const subtotal = subscription.pricePerMonth;
      const taxAmount = Math.round(subtotal * (taxInformation.ppnRate / 100));
      const total = subtotal + taxAmount;

      const invoice: Invoice = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        invoiceNumber: `INV-${Date.now()}`,
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        status: InvoiceStatus.OPEN,
        amount: total,
        subtotal,
        taxAmount,
        currency: subscription.currency,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        lineItems: [
          {
            description: `${planDetails.nameIndonesian} - ${planDetails.billingCycle}`,
            quantity: 1,
            unitPrice: subtotal,
            amount: subtotal
          }
        ],
        taxInformation: {
          ...taxInformation,
          ppnAmount: taxAmount
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.invoices.set(invoice.id, invoice);

      logger.info(`Invoice created: ${invoice.invoiceNumber} for subscription ${subscriptionId}`);

      return invoice;
    } catch (error) {
      logger.error('Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoices for tenant
   */
  async getInvoicesForTenant(tenantId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values())
      .filter(inv => inv.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Process payment for invoice
   */
  async processPayment(
    invoiceId: string,
    paymentMethod: PaymentMethod,
    gatewayTransactionId?: string
  ): Promise<Payment> {
    try {
      const invoice = this.invoices.get(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const payment: Payment = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId: invoice.tenantId,
        subscriptionId: invoice.subscriptionId,
        invoiceId: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        paymentMethod,
        status: PaymentStatus.PENDING,
        gatewayTransactionId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.payments.set(payment.id, payment);

      logger.info(`Payment initiated: ${payment.id} for invoice ${invoiceId}`);

      return payment;
    } catch (error) {
      logger.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Mark payment as paid
   */
  async markPaymentPaid(paymentId: string): Promise<Payment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    payment.updatedAt = new Date();

    // Mark invoice as paid
    const invoice = this.invoices.get(payment.invoiceId);
    if (invoice) {
      invoice.status = InvoiceStatus.PAID;
      invoice.paidAt = new Date();
      invoice.updatedAt = new Date();
    }

    logger.info(`Payment marked as paid: ${paymentId}`);

    return payment;
  }

  /**
   * Get payment history for tenant
   */
  async getPaymentHistory(tenantId: string): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter(pay => pay.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get usage metrics for tenant
   */
  async getUsageMetrics(tenantId: string): Promise<UsageMetrics> {
    const subscription = await this.getSubscription(tenantId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const planDetails = this.plans.get(subscription.plan);
    if (!planDetails) {
      throw new Error('Plan details not found');
    }

    // Mock usage data (in production, this would come from actual usage tracking)
    return {
      tenantId,
      period: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd
      },
      metrics: {
        vehiclesCount: 25,
        usersCount: 3,
        storageUsedGB: 5.2,
        aiSuggestionsUsed: 45,
        apiCallsCount: 1250
      },
      limits: planDetails.limits
    };
  }

  /**
   * Check if tenant has exceeded usage limits
   */
  async checkUsageLimits(tenantId: string): Promise<{
    withinLimits: boolean;
    exceeded: string[];
  }> {
    const usage = await this.getUsageMetrics(tenantId);
    const exceeded: string[] = [];

    if (usage.limits.maxVehicles !== -1 && usage.metrics.vehiclesCount > usage.limits.maxVehicles) {
      exceeded.push('vehicles');
    }

    if (usage.limits.maxUsers !== -1 && usage.metrics.usersCount > usage.limits.maxUsers) {
      exceeded.push('users');
    }

    if (usage.metrics.storageUsedGB > usage.limits.maxStorage) {
      exceeded.push('storage');
    }

    if (usage.limits.aiSuggestionsPerMonth !== -1 &&
        usage.metrics.aiSuggestionsUsed > usage.limits.aiSuggestionsPerMonth) {
      exceeded.push('ai_suggestions');
    }

    return {
      withinLimits: exceeded.length === 0,
      exceeded
    };
  }
}

// Singleton instance
export const billingService = new BillingService();
