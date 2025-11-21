/**
 * Communication Service
 * Epic 6: Story 6.6 - Customer Communication Preferences Management
 *
 * Multi-channel communication with preference management
 */

import { prisma } from '@/lib/prisma';
import { CustomerPreference, CommunicationChannel } from '@prisma/client';
import { whatsappIntegrationService } from './whatsapp-integration.service';
import { leadActivityService } from './lead-activity.service';

export interface PreferenceData {
  preferredChannel?: CommunicationChannel;
  alternateChannels?: CommunicationChannel[];
  preferredContactTimes?: string[];
  timezone?: string;
  maxContactsPerWeek?: number;
  preferredLanguage?: string;
}

export interface PauseData {
  pausedUntil: Date;
  pauseReason: string;
}

export class CommunicationService {
  /**
   * Get or create customer preference
   */
  async getOrCreatePreference(
    leadId: string,
    tenantId: string
  ): Promise<CustomerPreference> {
    let preference = await prisma.customerPreference.findUnique({
      where: { leadId },
    });

    if (!preference) {
      preference = await prisma.customerPreference.create({
        data: {
          leadId,
          tenantId,
        },
      });
    }

    return preference;
  }

  /**
   * Update communication preferences
   */
  async updatePreferences(
    leadId: string,
    tenantId: string,
    data: PreferenceData
  ): Promise<CustomerPreference> {
    // Ensure preference exists
    await this.getOrCreatePreference(leadId, tenantId);

    return prisma.customerPreference.update({
      where: { leadId },
      data,
    });
  }

  /**
   * Pause communications
   */
  async pauseCommunications(
    leadId: string,
    tenantId: string,
    data: PauseData
  ): Promise<CustomerPreference> {
    await this.getOrCreatePreference(leadId, tenantId);

    return prisma.customerPreference.update({
      where: { leadId },
      data: {
        isPaused: true,
        pausedUntil: data.pausedUntil,
        pauseReason: data.pauseReason,
      },
    });
  }

  /**
   * Resume communications
   */
  async resumeCommunications(
    leadId: string,
    tenantId: string
  ): Promise<CustomerPreference> {
    await this.getOrCreatePreference(leadId, tenantId);

    return prisma.customerPreference.update({
      where: { leadId },
      data: {
        isPaused: false,
        pausedUntil: null,
        pauseReason: null,
      },
    });
  }

  /**
   * Mark as do not contact
   */
  async markDoNotContact(
    leadId: string,
    tenantId: string,
    reason: string
  ): Promise<CustomerPreference> {
    await this.getOrCreatePreference(leadId, tenantId);

    return prisma.customerPreference.update({
      where: { leadId },
      data: {
        doNotContact: true,
        doNotContactReason: reason,
        isPaused: true,
      },
    });
  }

  /**
   * Remove do not contact
   */
  async removeDoNotContact(
    leadId: string,
    tenantId: string
  ): Promise<CustomerPreference> {
    await this.getOrCreatePreference(leadId, tenantId);

    return prisma.customerPreference.update({
      where: { leadId },
      data: {
        doNotContact: false,
        doNotContactReason: null,
      },
    });
  }

  /**
   * Check if communication is allowed
   */
  async isCommuncationAllowed(leadId: string): Promise<boolean> {
    const preference = await prisma.customerPreference.findUnique({
      where: { leadId },
    });

    if (!preference) return true; // No restrictions

    // Check do not contact
    if (preference.doNotContact) return false;

    // Check if paused
    if (preference.isPaused) {
      if (preference.pausedUntil) {
        // Check if pause period has ended
        if (new Date() < preference.pausedUntil) {
          return false;
        }
        // Auto-resume if pause period ended
        await this.resumeCommunications(leadId, preference.tenantId);
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * Send message through preferred channel
   */
  async sendMessage(
    leadId: string,
    tenantId: string,
    message: string,
    userId: string,
    userName?: string,
    overrideChannel?: CommunicationChannel
  ): Promise<{ success: boolean; channel?: CommunicationChannel; error?: string }> {
    // Check if communication is allowed
    const isAllowed = await this.isCommuncationAllowed(leadId);
    if (!isAllowed) {
      return {
        success: false,
        error: 'Communication is not allowed for this customer',
      };
    }

    // Get lead and preference
    const [lead, preference] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      this.getOrCreatePreference(leadId, tenantId),
    ]);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Determine channel
    const channel = overrideChannel || preference.preferredChannel;

    // Send through appropriate channel
    switch (channel) {
      case 'WHATSAPP':
        if (!lead.whatsappNumber) {
          return { success: false, error: 'WhatsApp number not available' };
        }
        const result = await whatsappIntegrationService.sendMessage(
          leadId,
          tenantId,
          lead.whatsappNumber,
          message,
          userId,
          userName
        );
        return { ...result, channel };

      case 'EMAIL':
        if (!lead.email) {
          return { success: false, error: 'Email not available' };
        }
        // TODO: Implement email sending
        await leadActivityService.recordEmail(
          leadId,
          tenantId,
          'Message from dealership',
          message,
          'outbound',
          userId,
          userName
        );
        return { success: true, channel };

      case 'SMS':
        if (!lead.phone) {
          return { success: false, error: 'Phone number not available' };
        }
        // TODO: Implement SMS sending
        await leadActivityService.recordActivity(leadId, tenantId, {
          type: 'SMS',
          channel: 'SMS',
          direction: 'outbound',
          message,
          performedBy: userId,
          performedByName: userName,
        });
        return { success: true, channel };

      default:
        return { success: false, error: 'Unsupported channel' };
    }
  }

  /**
   * Get communication statistics
   */
  async getCommunicationStats(
    leadId: string,
    tenantId: string
  ): Promise<{
    totalCommunications: number;
    thisWeek: number;
    isAllowed: boolean;
    preferences: CustomerPreference;
  }> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [activities, thisWeekActivities, preference, isAllowed] = await Promise.all([
      prisma.leadActivity.count({
        where: { leadId, tenantId, direction: 'outbound' },
      }),
      prisma.leadActivity.count({
        where: {
          leadId,
          tenantId,
          direction: 'outbound',
          createdAt: { gte: weekAgo },
        },
      }),
      this.getOrCreatePreference(leadId, tenantId),
      this.isCommuncationAllowed(leadId),
    ]);

    return {
      totalCommunications: activities,
      thisWeek: thisWeekActivities,
      isAllowed,
      preferences: preference,
    };
  }

  /**
   * Check if contact frequency limit reached
   */
  async isFrequencyLimitReached(leadId: string): Promise<boolean> {
    const preference = await prisma.customerPreference.findUnique({
      where: { leadId },
    });

    if (!preference) return false;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const thisWeekCount = await prisma.leadActivity.count({
      where: {
        leadId,
        direction: 'outbound',
        createdAt: { gte: weekAgo },
      },
    });

    return thisWeekCount >= preference.maxContactsPerWeek;
  }
}

export const communicationService = new CommunicationService();
