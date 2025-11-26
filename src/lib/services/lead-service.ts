/**
 * Lead Service
 * Epic 6: Lead Management System
 */

import { PrismaClient, LeadStatus, LeadPriority } from '@prisma/client';

const prisma = new PrismaClient();

export interface LeadCreateInput {
  tenantId: string;
  vehicleId?: string;
  name: string;
  email?: string;
  phone: string;
  whatsappNumber?: string;
  message: string;
  source?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  interestedIn?: string;
  budgetRange?: string;
  timeframe?: string;
  assignedTo?: string;
}

export interface LeadUpdateInput {
  name?: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  message?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  interestedIn?: string;
  budgetRange?: string;
  timeframe?: string;
  followUpDate?: Date;
  notes?: string;
  assignedTo?: string;
}

export interface LeadFilters {
  status?: LeadStatus;
  priority?: LeadPriority;
  source?: string;
  assignedTo?: string;
  search?: string;
  vehicleId?: string;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  interested: number;
  notInterested: number;
  converted: number;
  conversionRate: number;
}

export class LeadService {
  /**
   * Create a new lead
   */
  static async createLead(data: LeadCreateInput) {
    try {
      const lead = await prisma.lead.create({
        data: {
          tenantId: data.tenantId,
          vehicleId: data.vehicleId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          whatsappNumber: data.whatsappNumber,
          message: data.message,
          source: data.source || 'website',
          status: data.status || 'NEW',
          priority: data.priority || 'MEDIUM',
          interestedIn: data.interestedIn,
          budgetRange: data.budgetRange,
          timeframe: data.timeframe,
          assignedTo: data.assignedTo,
        },
      });

      return lead;
    } catch (error) {
      console.error('Failed to create lead:', error);
      throw error;
    }
  }

  /**
   * Get lead by ID
   */
  static async getLeadById(id: string, tenantId: string) {
    try {
      const lead = await prisma.lead.findFirst({
        where: { id, tenantId },
        include: {
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          tasks: {
            orderBy: { dueDate: 'asc' },
          },
          scores: {
            orderBy: { calculatedAt: 'desc' },
            take: 1,
          },
        },
      });

      return lead;
    } catch (error) {
      console.error('Failed to get lead:', error);
      throw error;
    }
  }

  /**
   * List leads with filters and pagination
   */
  static async listLeads(
    tenantId: string,
    filters: LeadFilters = {},
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const where: any = { tenantId };

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.priority) {
        where.priority = filters.priority;
      }

      if (filters.source) {
        where.source = filters.source;
      }

      if (filters.assignedTo) {
        where.assignedTo = filters.assignedTo;
      }

      if (filters.vehicleId) {
        where.vehicleId = filters.vehicleId;
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search, mode: 'insensitive' } },
          { message: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          include: {
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            scores: {
              orderBy: { calculatedAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.lead.count({ where }),
      ]);

      return {
        leads,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Failed to list leads:', error);
      throw error;
    }
  }

  /**
   * Update lead
   */
  static async updateLead(id: string, tenantId: string, data: LeadUpdateInput) {
    try {
      const lead = await prisma.lead.updateMany({
        where: { id, tenantId },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          whatsappNumber: data.whatsappNumber,
          message: data.message,
          status: data.status,
          priority: data.priority,
          interestedIn: data.interestedIn,
          budgetRange: data.budgetRange,
          timeframe: data.timeframe,
          followUpDate: data.followUpDate,
          notes: data.notes,
          assignedTo: data.assignedTo,
        },
      });

      return lead;
    } catch (error) {
      console.error('Failed to update lead:', error);
      throw error;
    }
  }

  /**
   * Delete lead
   */
  static async deleteLead(id: string, tenantId: string) {
    try {
      await prisma.lead.deleteMany({
        where: { id, tenantId },
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to delete lead:', error);
      throw error;
    }
  }

  /**
   * Get lead statistics
   */
  static async getLeadStats(tenantId: string, dateRange?: { from: Date; to: Date }): Promise<LeadStats> {
    try {
      const where: any = { tenantId };

      if (dateRange) {
        where.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to,
        };
      }

      const [total, statusCounts] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
      ]);

      const statusMap: Record<string, number> = {};
      statusCounts.forEach((item) => {
        statusMap[item.status] = item._count;
      });

      const newCount = statusMap.NEW || 0;
      const contactedCount = statusMap.CONTACTED || 0;
      const interestedCount = statusMap.INTERESTED || 0;
      const notInterestedCount = statusMap.NOT_INTERESTED || 0;
      const convertedCount = statusMap.CONVERTED || 0;

      const conversionRate = total > 0 ? (convertedCount / total) * 100 : 0;

      return {
        total,
        new: newCount,
        contacted: contactedCount,
        interested: interestedCount,
        notInterested: notInterestedCount,
        converted: convertedCount,
        conversionRate: Math.round(conversionRate * 100) / 100,
      };
    } catch (error) {
      console.error('Failed to get lead stats:', error);
      throw error;
    }
  }

  /**
   * Track WhatsApp click
   */
  static async trackWhatsAppClick(data: {
    tenantId: string;
    vehicleId?: string;
    source: string;
    metadata?: any;
  }) {
    try {
      // Create a lead activity or log the event
      // For now, we'll just log it
      // In production, you might want to create a tracking event
      console.log('WhatsApp click tracked:', data);

      return { success: true, tracked: true };
    } catch (error) {
      console.error('Failed to track WhatsApp click:', error);
      throw error;
    }
  }
}
