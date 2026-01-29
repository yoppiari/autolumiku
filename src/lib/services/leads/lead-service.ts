/**
 * Lead Service
 * Epic 6: Lead Management System
 */

import { LeadStatus, LeadPriority } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
      // 1. STAFF CHECK (Safety Layer)
      // Get all staff phone numbers to prevent accidental lead creation
      const staffUsers = await prisma.user.findMany({
        where: {
          OR: [
            { tenantId: data.tenantId },
            { tenantId: null }
          ],
          phone: { not: null },
        },
        select: { phone: true }
      });

      const normalizePhone = (phone: string) => phone?.replace(/\D/g, '') || '';
      const cleanInputPhone = normalizePhone(data.phone);

      const isStaffPhone = staffUsers.some(user => {
        const userPhone = normalizePhone(user.phone || '');
        return userPhone === cleanInputPhone ||
          (userPhone.startsWith('62') && '0' + userPhone.slice(2) === cleanInputPhone) ||
          (cleanInputPhone.startsWith('62') && '0' + cleanInputPhone.slice(2) === userPhone);
      });

      if (isStaffPhone) {
        console.log(`[LeadService] ⚠️ BLOCKED: Phone ${data.phone} belongs to staff member. Skipping createLead.`);
        return null;
      }

      // 2. QUALITY CHECK (Junk Prevention)
      const phonePattern = /^(62|08|\+62|0)\d{8,13}$/;
      const isPhoneNumberAsName = data.name ? phonePattern.test(data.name.replace(/[\s\-]/g, '')) : false;

      const isNameValid = data.name &&
        data.name !== data.phone &&
        data.name !== 'Unknown' &&
        data.name !== 'Customer Baru' &&
        data.name !== 'Customer' &&
        !isPhoneNumberAsName &&
        data.name.trim().length > 2;

      const hasInterest = !!data.vehicleId || !!data.interestedIn;

      // STRICT: Both name and interest are required for auto-leads
      if (data.source === 'whatsapp' || data.source === 'whatsapp_auto') {
        if (!isNameValid || !hasInterest) {
          console.log(`[LeadService] ⏭️ Skipping low-quality lead: ${data.phone} (Name: "${data.name}", Interest: "${data.interestedIn || data.vehicleId}")`);
          return null;
        }
      }

      const lead = await prisma.lead.create({
        data: {
          tenantId: data.tenantId,
          vehicleId: data.vehicleId,
          name: data.name,
          email: data.email,
          phone: cleanInputPhone,
          whatsappNumber: data.whatsappNumber || data.phone,
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
   * Get lead by phone (check for existing lead)
   */
  static async getLeadByPhone(tenantId: string, phone: string) {
    try {
      // Normalize phone: remove non-digits
      const cleanPhone = phone.replace(/\D/g, '');

      // Possible formats: 628..., 08..., 8...
      // We'll try to match broad patterns
      const searchPhones = [
        cleanPhone,
        cleanPhone.startsWith('62') ? '0' + cleanPhone.slice(2) : '62' + cleanPhone.slice(1),
        cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : '0' + cleanPhone
      ];

      // Remove duplicates
      const uniquePhones = [...new Set(searchPhones)];

      const lead = await prisma.lead.findFirst({
        where: {
          tenantId,
          OR: uniquePhones.map(p => ({ phone: p }))
        },
        orderBy: { createdAt: 'desc' }, // Get latest
        include: {
          whatsappConversations: {
            orderBy: { lastMessageAt: 'desc' },
            take: 1
          }
        }
      });

      return lead;
    } catch (error) {
      console.error('Failed to get lead by phone:', error);
      // Don't throw, just return null if fail
      return null;
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

      const stats = await this.getLeadStats(tenantId, filters.status ? undefined : (filters as any).dateRange);

      return {
        leads,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats, // Unified stats included in list call
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
      const qualifiedCount = statusMap.QUALIFIED || 0;
      const wonCount = statusMap.WON || 0;
      const lostCount = statusMap.LOST || 0;
      const negotiatingCount = statusMap.NEGOTIATING || 0;

      const conversionRate = total > 0 ? (wonCount / total) * 100 : 0;

      return {
        total,
        new: newCount,
        contacted: contactedCount,
        interested: qualifiedCount, // alias for qualified
        converted: wonCount, // alias for won
        notInterested: lostCount, // alias for lost
        negotiating: negotiatingCount,
        conversionRate: Math.round(conversionRate * 100) / 100,
        byStatus: {
          NEW: newCount,
          CONTACTED: contactedCount,
          QUALIFIED: qualifiedCount,
          WON: wonCount,
          LOST: lostCount,
          NEGOTIATING: negotiatingCount
        }
      };
    } catch (error) {
      console.error('Failed to get lead stats:', error);
      throw error;
    }
  }

  /**
   * Create or update lead from WhatsApp interaction
   * This is the core method for "Smart Leads" auto-capture
   */
  static async createOrUpdateFromWhatsApp({
    tenantId,
    customerPhone,
    customerName,
    message,
    vehicleId,
    intent,
    isStaff = false
  }: {
    tenantId: string;
    customerPhone: string;
    customerName?: string;
    message: string;
    vehicleId?: string;
    intent?: string;
    isStaff?: boolean;
  }) {
    try {
      // CRITICAL: Double-check staff status by phone lookup
      // This prevents leads from being created even if isStaff flag is wrong
      if (isStaff) {
        console.log('[LeadService] Skipping lead creation - isStaff flag is true');
        return null;
      }

      // 1. Normalize phone for lookup
      const cleanPhone = customerPhone.replace(/\D/g, '');

      // 2. ADDITIONAL SAFETY CHECK: Verify phone is not a staff member
      // This catches cases where isStaff might be incorrectly set to false
      const staffUsers = await prisma.user.findMany({
        where: {
          OR: [
            { tenantId },
            { tenantId: null }
          ],
          phone: { not: null },
          AND: [
            {
              OR: [
                { roleLevel: { gte: 30 } },
                { role: { in: ['STAFF', 'SALES', 'ADMIN', 'OWNER', 'SUPER_ADMIN'] } }
              ]
            }
          ]
        },
        select: { phone: true, role: true, firstName: true }
      });

      // Normalize and compare phone numbers
      const normalizePhone = (phone: string) => phone?.replace(/\D/g, '') || '';
      const isStaffPhone = staffUsers?.some(user => {
        const userPhone = normalizePhone(user.phone || '');
        const customerPhoneNorm = normalizePhone(customerPhone);

        // Match exact or with country code conversion (62xxx <-> 0xxx)
        return userPhone === customerPhoneNorm ||
          (userPhone.startsWith('62') && '0' + userPhone.slice(2) === customerPhoneNorm) ||
          (customerPhoneNorm.startsWith('62') && '0' + customerPhoneNorm.slice(2) === userPhone);
      });

      if (isStaffPhone) {
        console.log(`[LeadService] ⚠️ BLOCKED: Phone ${customerPhone} belongs to staff member. Not creating lead.`);
        return null;
      }

      // 3. Try to find existing lead
      let lead = await this.getLeadByPhone(tenantId, cleanPhone);

      // Calculate basic score impact based on intent
      let scoreIncrement = 0;
      let statusUpdate = undefined;
      let interestUpdate = undefined;

      if (intent) {
        // Simple heuristic rules for immediate updates
        if (intent.includes('price') || intent.includes('harga')) {
          scoreIncrement = 10;
          statusUpdate = 'QUALIFIED';
        }
        if (intent.includes('location') || intent.includes('lokasi')) {
          scoreIncrement = 15;
          statusUpdate = 'QUALIFIED';
        }
        if (intent.includes('consultation') || intent.includes('credit')) {
          scoreIncrement = 20;
          statusUpdate = 'QUALIFIED';
        }
      }

      if (lead) {
        // --- UDPATE EXISTING LEAD ---
        const updateData: any = {
          lastContactAt: new Date(), // Always update last contact
          // If we have a name now and didn't before, update it
          ...(customerName && (!lead.name || lead.name === cleanPhone || lead.name === 'Unknown') ? { name: customerName } : {}),
          // If customer asks about a specific vehicle, update interest
          ...(vehicleId ? { vehicleId, interestedIn: vehicleId } : {}),
        };

        // Only update status if it's an "upgrade" (e.g. dont set CONTACTED back to NEW)
        if (statusUpdate && lead.status === 'NEW' && statusUpdate === 'QUALIFIED') {
          updateData.status = 'QUALIFIED';
        }

        lead = await prisma.lead.update({
          where: { id: lead.id },
          data: updateData
        });

        // Update score if needed
        if (scoreIncrement > 0) {
          // We'll implement specific score tracking later, for now just log/metadata could be used
          // or we can add a 'score' column to Lead table if it exists, or stored in metadata
        }

      } else {
        // --- CREATE NEW LEAD ---

        // QUALITY CHECK: Don't create "junk" leads with no name and no vehicle interest
        // STRICT VALIDATION - Both name AND interest must be present!

        // Check if name is a phone number pattern (starts with 62, 08, or is all digits)
        const phonePattern = /^(62|08|\+62|0)\d{8,13}$/;
        const isPhoneNumber = customerName ? phonePattern.test(customerName.replace(/[\s\-]/g, '')) : false;

        const isNameValid = customerName &&
          customerName !== cleanPhone &&
          customerName !== 'Unknown' &&
          customerName !== 'Customer Baru' &&
          customerName !== 'Customer' &&
          customerName !== '' &&
          !isPhoneNumber && // NEW: Reject if name is actually a phone number
          customerName.trim().length > 2; // At least 3 characters

        const hasInterest = !!vehicleId || (intent && (intent.includes('price') || intent.includes('stock') || intent.includes('credit')));

        // STRICT: BOTH name AND interest required (changed from OR to AND)
        if (!isNameValid || !hasInterest) {
          console.log(`[Smart Leads] ⏭️ Skipping low-quality lead: ${cleanPhone}`);
          console.log(`[Smart Leads]   - Name valid: ${isNameValid} (value: "${customerName}")`);
          console.log(`[Smart Leads]   - Has interest: ${hasInterest} (vehicleId: ${vehicleId})`);
          console.log(`[Smart Leads]   - Is phone number: ${isPhoneNumber}`);
          return null;
        }

        // Auto-determine source based on context
        const source = 'whatsapp_auto';

        lead = await prisma.lead.create({
          data: {
            tenantId,
            phone: cleanPhone,
            whatsappNumber: customerPhone,
            name: customerName || cleanPhone, // Fallback to phone if name unknown
            message: message, // First message
            source,
            status: 'NEW',
            priority: 'MEDIUM',
            vehicleId,
            interestedIn: vehicleId,
            lastContactAt: new Date(),
          }
        });

        console.log(`[Smart Leads] New lead captured from WhatsApp: ${cleanPhone}`);
      }

      // Create activity log (if Activity table exists/is linked, otherwise just log to console)
      // For now we assume we just updated the Lead record itself.

      return lead;

    } catch (error) {
      console.error('[Smart Leads] Failed to process WhatsApp lead:', error);
      // Fail silently to not disrupt the chat flow
      return null;
    }
  }

  /**
   * Update Lead Score and Status based on Analysis
   * To be called by LeadAnalyzer service
   */
  static async updateLeadAnalysis(leadId: string, analysis: {
    score: number;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    buyingStage: string;
    urgency: 'HIGH' | 'MEDIUM' | 'LOW';
    summary?: string;
  }) {
    try {
      // Map buying stage/score to LeadStatus
      let newStatus: any = undefined;

      if (analysis.sentiment === 'NEGATIVE') {
        newStatus = 'LOST';
      } else if (analysis.score >= 80 || analysis.buyingStage === 'ACTION') {
        newStatus = 'WON'; // Or 'HOT' if available
      } else if (analysis.score >= 50 || analysis.buyingStage === 'DESIRE') {
        newStatus = 'QUALIFIED';
      } else if (analysis.buyingStage === 'INTEREST') {
        newStatus = 'CONTACTED';
      }

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          urgency: analysis.urgency, // Assuming urgency field exists
          // We might store the score/summary in a notes field or separate score field
          notes: analysis.summary ? `[AI Analysis] ${analysis.summary}` : undefined,
          ...(newStatus ? { status: newStatus } : {})
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to update lead analysis:', error);
      return false;
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
