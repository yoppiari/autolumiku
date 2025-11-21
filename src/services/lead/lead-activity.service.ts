/**
 * Lead Activity Service
 * Epic 6: Story 6.4 - Customer Lead History and Conversation Tracking
 *
 * Track all customer interactions across channels
 */

import { prisma } from '@/lib/prisma';
import { LeadActivity, LeadActivityType, CommunicationChannel } from '@prisma/client';

export interface CreateActivityData {
  type: LeadActivityType;
  channel: CommunicationChannel;
  direction: 'inbound' | 'outbound';
  subject?: string;
  message?: string;
  metadata?: any;
  performedBy?: string;
  performedByName?: string;
}

export interface ActivityFilters {
  type?: LeadActivityType;
  channel?: CommunicationChannel;
  dateFrom?: Date;
  dateTo?: Date;
}

export class LeadActivityService {
  /**
   * Record a new activity
   */
  async recordActivity(
    leadId: string,
    tenantId: string,
    data: CreateActivityData
  ): Promise<LeadActivity> {
    const activity = await prisma.leadActivity.create({
      data: {
        leadId,
        tenantId,
        ...data,
      },
    });

    return activity;
  }

  /**
   * Get all activities for a lead
   */
  async getActivities(
    leadId: string,
    tenantId: string,
    filters: ActivityFilters = {}
  ): Promise<LeadActivity[]> {
    const where: any = { leadId, tenantId };

    if (filters.type) where.type = filters.type;
    if (filters.channel) where.channel = filters.channel;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    return prisma.leadActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get activity timeline (grouped by date)
   */
  async getActivityTimeline(
    leadId: string,
    tenantId: string
  ): Promise<Record<string, LeadActivity[]>> {
    const activities = await this.getActivities(leadId, tenantId);

    // Group by date
    const timeline: Record<string, LeadActivity[]> = {};

    activities.forEach((activity) => {
      const dateKey = activity.createdAt.toISOString().split('T')[0];
      if (!timeline[dateKey]) {
        timeline[dateKey] = [];
      }
      timeline[dateKey].push(activity);
    });

    return timeline;
  }

  /**
   * Get recent activities across all leads
   */
  async getRecentActivities(
    tenantId: string,
    limit: number = 50
  ): Promise<LeadActivity[]> {
    return prisma.leadActivity.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(
    leadId: string,
    tenantId: string
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    lastActivity: Date | null;
  }> {
    const [activities, byType, byChannel] = await Promise.all([
      prisma.leadActivity.findMany({
        where: { leadId, tenantId },
      }),
      prisma.leadActivity.groupBy({
        by: ['type'],
        where: { leadId, tenantId },
        _count: { id: true },
      }),
      prisma.leadActivity.groupBy({
        by: ['channel'],
        where: { leadId, tenantId },
        _count: { id: true },
      }),
    ]);

    const typeMap: Record<string, number> = {};
    byType.forEach((item) => {
      typeMap[item.type] = item._count.id;
    });

    const channelMap: Record<string, number> = {};
    byChannel.forEach((item) => {
      channelMap[item.channel] = item._count.id;
    });

    const lastActivity = activities.length > 0
      ? activities.reduce((latest, activity) =>
          activity.createdAt > latest ? activity.createdAt : latest
        , activities[0].createdAt)
      : null;

    return {
      total: activities.length,
      byType: typeMap,
      byChannel: channelMap,
      lastActivity,
    };
  }

  /**
   * Record inquiry activity
   */
  async recordInquiry(
    leadId: string,
    tenantId: string,
    message: string,
    channel: CommunicationChannel
  ): Promise<LeadActivity> {
    return this.recordActivity(leadId, tenantId, {
      type: 'INQUIRY',
      channel,
      direction: 'inbound',
      message,
    });
  }

  /**
   * Record WhatsApp message
   */
  async recordWhatsAppMessage(
    leadId: string,
    tenantId: string,
    message: string,
    direction: 'inbound' | 'outbound',
    performedBy?: string,
    performedByName?: string
  ): Promise<LeadActivity> {
    return this.recordActivity(leadId, tenantId, {
      type: 'WHATSAPP',
      channel: 'WHATSAPP',
      direction,
      message,
      performedBy,
      performedByName,
    });
  }

  /**
   * Record phone call
   */
  async recordPhoneCall(
    leadId: string,
    tenantId: string,
    direction: 'inbound' | 'outbound',
    notes: string,
    performedBy?: string,
    performedByName?: string
  ): Promise<LeadActivity> {
    return this.recordActivity(leadId, tenantId, {
      type: 'PHONE_CALL',
      channel: 'PHONE',
      direction,
      message: notes,
      performedBy,
      performedByName,
    });
  }

  /**
   * Record email
   */
  async recordEmail(
    leadId: string,
    tenantId: string,
    subject: string,
    message: string,
    direction: 'inbound' | 'outbound',
    performedBy?: string,
    performedByName?: string
  ): Promise<LeadActivity> {
    return this.recordActivity(leadId, tenantId, {
      type: 'EMAIL',
      channel: 'EMAIL',
      direction,
      subject,
      message,
      performedBy,
      performedByName,
    });
  }

  /**
   * Record internal note
   */
  async recordNote(
    leadId: string,
    tenantId: string,
    note: string,
    performedBy: string,
    performedByName?: string
  ): Promise<LeadActivity> {
    return this.recordActivity(leadId, tenantId, {
      type: 'NOTE',
      channel: 'IN_PERSON',
      direction: 'outbound',
      message: note,
      performedBy,
      performedByName,
    });
  }

  /**
   * Record status change
   */
  async recordStatusChange(
    leadId: string,
    tenantId: string,
    fromStatus: string,
    toStatus: string,
    performedBy: string,
    performedByName?: string
  ): Promise<LeadActivity> {
    return this.recordActivity(leadId, tenantId, {
      type: 'STATUS_CHANGE',
      channel: 'IN_PERSON',
      direction: 'outbound',
      message: `Status changed from ${fromStatus} to ${toStatus}`,
      metadata: { fromStatus, toStatus },
      performedBy,
      performedByName,
    });
  }

  /**
   * Record lead assignment
   */
  async recordAssignment(
    leadId: string,
    tenantId: string,
    fromUser: string | null,
    toUser: string,
    toUserName: string,
    performedBy: string,
    performedByName?: string
  ): Promise<LeadActivity> {
    return this.recordActivity(leadId, tenantId, {
      type: 'ASSIGNMENT',
      channel: 'IN_PERSON',
      direction: 'outbound',
      message: `Lead assigned to ${toUserName}`,
      metadata: { fromUser, toUser, toUserName },
      performedBy,
      performedByName,
    });
  }
}

export const leadActivityService = new LeadActivityService();
