/**
 * Lead Management Service
 * Epic 5: Story 5.5 - Contact Forms & Lead Capture
 *
 * Manages customer inquiries and lead generation
 */

import { prisma } from '@/lib/prisma';
import { Lead, LeadStatus, LeadPriority } from '@prisma/client';

export interface CreateLeadData {
  name: string;
  email?: string;
  phone: string;
  whatsappNumber?: string;
  message: string;
  vehicleId?: string;
  source?: string;
  interestedIn?: string;
  budgetRange?: string;
  timeframe?: string;
}

export interface UpdateLeadData {
  status?: LeadStatus;
  priority?: LeadPriority;
  notes?: string;
  assignedTo?: string;
  followUpDate?: Date;
}

export interface LeadFilters {
  status?: LeadStatus;
  priority?: LeadPriority;
  assignedTo?: string;
  vehicleId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export class LeadService {
  /**
   * Create new lead from customer inquiry
   */
  async createLead(tenantId: string, data: CreateLeadData): Promise<Lead> {
    // Auto-classify priority based on message content and timeframe
    const priority = this.classifyPriority(data.message, data.timeframe);

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        ...data,
        priority,
        source: data.source || 'website',
        status: 'NEW',
      },
    });

    // TODO: Send notification to assigned salesperson
    // TODO: Send auto-reply to customer

    return lead;
  }

  /**
   * Get lead by ID
   */
  async getLead(leadId: string, tenantId: string): Promise<Lead | null> {
    return prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId,
      },
    });
  }

  /**
   * Get all leads for tenant
   */
  async getLeads(
    tenantId: string,
    filters: LeadFilters = {},
    options: { page?: number; limit?: number } = {}
  ): Promise<{ leads: Lead[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.lead.count({ where }),
    ]);

    return { leads, total };
  }

  /**
   * Update lead
   */
  async updateLead(leadId: string, tenantId: string, data: UpdateLeadData): Promise<Lead> {
    return prisma.lead.update({
      where: {
        id: leadId,
        tenantId,
      },
      data,
    });
  }

  /**
   * Assign lead to user
   */
  async assignLead(leadId: string, tenantId: string, userId: string): Promise<Lead> {
    return this.updateLead(leadId, tenantId, {
      assignedTo: userId,
      status: 'CONTACTED',
    });
  }

  /**
   * Mark lead as contacted
   */
  async markContacted(leadId: string, tenantId: string, notes?: string): Promise<Lead> {
    return this.updateLead(leadId, tenantId, {
      status: 'CONTACTED',
      notes,
    });
  }

  /**
   * Mark lead as qualified
   */
  async markQualified(leadId: string, tenantId: string, notes?: string): Promise<Lead> {
    return this.updateLead(leadId, tenantId, {
      status: 'QUALIFIED',
      notes,
    });
  }

  /**
   * Mark lead as won (converted to sale)
   */
  async markWon(leadId: string, tenantId: string, notes?: string): Promise<Lead> {
    return this.updateLead(leadId, tenantId, {
      status: 'WON',
      notes,
    });
  }

  /**
   * Mark lead as lost
   */
  async markLost(leadId: string, tenantId: string, reason?: string): Promise<Lead> {
    return this.updateLead(leadId, tenantId, {
      status: 'LOST',
      notes: reason,
    });
  }

  /**
   * Get lead statistics
   */
  async getLeadStats(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    conversionRate: number;
  }> {
    const [byStatus, byPriority] = await Promise.all([
      prisma.lead.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ['priority'],
        where: { tenantId },
        _count: { id: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    let total = 0;
    let won = 0;

    byStatus.forEach((item) => {
      statusMap[item.status] = item._count.id;
      total += item._count.id;
      if (item.status === 'WON') won = item._count.id;
    });

    const priorityMap: Record<string, number> = {};
    byPriority.forEach((item) => {
      priorityMap[item.priority] = item._count.id;
    });

    const conversionRate = total > 0 ? (won / total) * 100 : 0;

    return {
      total,
      byStatus: statusMap,
      byPriority: priorityMap,
      conversionRate,
    };
  }

  /**
   * Get hot leads (urgent + high priority + new/contacted)
   */
  async getHotLeads(tenantId: string, limit: number = 10): Promise<Lead[]> {
    return prisma.lead.findMany({
      where: {
        tenantId,
        priority: {
          in: ['URGENT', 'HIGH'],
        },
        status: {
          in: ['NEW', 'CONTACTED', 'QUALIFIED'],
        },
      },
      take: limit,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Generate WhatsApp message for inquiry
   */
  generateWhatsAppMessage(vehicleInfo: { make: string; model: string; year: number; price: number }): string {
    const priceFormatted = `Rp ${(vehicleInfo.price / 100).toLocaleString('id-ID')}`;
    return `Halo, saya tertarik dengan ${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.year} (${priceFormatted}). Apakah masih tersedia?`;
  }

  /**
   * Generate WhatsApp URL
   */
  generateWhatsAppURL(phoneNumber: string, message: string): string {
    // Remove non-digits and ensure it starts with country code
    let cleanNumber = phoneNumber.replace(/\D/g, '');

    // Add Indonesia country code if not present
    if (!cleanNumber.startsWith('62')) {
      if (cleanNumber.startsWith('0')) {
        cleanNumber = '62' + cleanNumber.slice(1);
      } else {
        cleanNumber = '62' + cleanNumber;
      }
    }

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Classify lead priority based on message and timeframe
   */
  private classifyPriority(message: string, timeframe?: string): LeadPriority {
    const messageLower = message.toLowerCase();

    // Urgent keywords
    const urgentKeywords = ['segera', 'urgent', 'hari ini', 'sekarang', 'cash', 'langsung beli'];
    if (urgentKeywords.some((kw) => messageLower.includes(kw)) || timeframe === 'Hari ini') {
      return 'URGENT';
    }

    // High priority keywords
    const highKeywords = ['minggu ini', 'besok', 'minat', 'serius', 'survey langsung'];
    if (highKeywords.some((kw) => messageLower.includes(kw)) || timeframe === 'Minggu ini') {
      return 'HIGH';
    }

    // Medium for general inquiries
    if (timeframe === 'Bulan ini') {
      return 'MEDIUM';
    }

    // Low for browsing/surveying
    return 'LOW';
  }
}

export const leadService = new LeadService();
