/**
 * Lead Scoring Service
 * Epic 6: Story 6.3 - Lead Scoring and Prioritization System
 *
 * Automated lead scoring based on multiple factors
 */

import { prisma } from '@/lib/prisma';
import { Lead, LeadScore, LeadTier } from '@prisma/client';

export interface ScoreFactors {
  budget: { score: number; reason: string };
  urgency: { score: number; reason: string };
  match: { score: number; reason: string };
  engagement: { score: number; reason: string };
}

export class LeadScoringService {
  /**
   * Calculate and save lead score
   */
  async calculateLeadScore(leadId: string, tenantId: string): Promise<LeadScore> {
    // Get lead data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead || lead.tenantId !== tenantId) {
      throw new Error('Lead not found');
    }

    // Calculate score components
    const budgetScore = this.calculateBudgetScore(lead.budgetRange);
    const urgencyScore = this.calculateUrgencyScore(lead.timeframe, lead.priority);
    const matchScore = this.calculateMatchScore(lead.interestedIn, lead.vehicleId);
    const engagementScore = this.calculateEngagementScore(lead.activities.length);

    // Total score
    const totalScore = budgetScore.score + urgencyScore.score + matchScore.score + engagementScore.score;

    // Determine tier
    const tier = this.determineTier(totalScore);

    // Save score
    const score = await prisma.leadScore.create({
      data: {
        leadId,
        tenantId,
        totalScore,
        budgetScore: budgetScore.score,
        urgencyScore: urgencyScore.score,
        matchScore: matchScore.score,
        engagementScore: engagementScore.score,
        tier,
        factors: {
          budget: budgetScore,
          urgency: urgencyScore,
          match: matchScore,
          engagement: engagementScore,
        },
      },
    });

    return score;
  }

  /**
   * Get latest score for lead
   */
  async getLatestScore(leadId: string, tenantId: string): Promise<LeadScore | null> {
    return prisma.leadScore.findFirst({
      where: { leadId, tenantId },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  /**
   * Get score history for lead
   */
  async getScoreHistory(leadId: string, tenantId: string): Promise<LeadScore[]> {
    return prisma.leadScore.findMany({
      where: { leadId, tenantId },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  /**
   * Get leads by tier
   */
  async getLeadsByTier(tenantId: string, tier: LeadTier): Promise<Lead[]> {
    // Get latest scores for each lead
    const scores = await prisma.leadScore.findMany({
      where: { tenantId, tier },
      orderBy: { calculatedAt: 'desc' },
      distinct: ['leadId'],
    });

    const leadIds = scores.map((s) => s.leadId);

    return prisma.lead.findMany({
      where: {
        tenantId,
        id: { in: leadIds },
      },
      include: {
        scores: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Recalculate score on lead update
   */
  async recalculateScore(leadId: string, tenantId: string): Promise<LeadScore> {
    return this.calculateLeadScore(leadId, tenantId);
  }

  // ============================================================================
  // Private Scoring Methods
  // ============================================================================

  /**
   * Calculate budget score (0-25)
   */
  private calculateBudgetScore(budgetRange?: string | null): { score: number; reason: string } {
    if (!budgetRange) {
      return { score: 10, reason: 'No budget specified' };
    }

    // Parse budget range (e.g., "100-200 juta")
    const match = budgetRange.match(/(\d+)-(\d+)/);
    if (!match) {
      return { score: 10, reason: 'Invalid budget format' };
    }

    const minBudget = parseInt(match[1]);
    const maxBudget = parseInt(match[2]);

    // Higher budget = higher score
    if (maxBudget >= 300) {
      return { score: 25, reason: 'High budget (300M+)' };
    } else if (maxBudget >= 200) {
      return { score: 20, reason: 'Good budget (200-300M)' };
    } else if (maxBudget >= 100) {
      return { score: 15, reason: 'Moderate budget (100-200M)' };
    } else {
      return { score: 10, reason: 'Lower budget (<100M)' };
    }
  }

  /**
   * Calculate urgency score (0-25)
   */
  private calculateUrgencyScore(
    timeframe?: string | null,
    priority?: string
  ): { score: number; reason: string } {
    // Priority from lead classification
    if (priority === 'URGENT') {
      return { score: 25, reason: 'Urgent priority' };
    } else if (priority === 'HIGH') {
      return { score: 20, reason: 'High priority' };
    }

    // Timeframe analysis
    if (!timeframe) {
      return { score: 10, reason: 'No timeframe specified' };
    }

    const timeframeLower = timeframe.toLowerCase();

    if (timeframeLower.includes('hari ini') || timeframeLower.includes('today')) {
      return { score: 25, reason: 'Needs today' };
    } else if (timeframeLower.includes('minggu') || timeframeLower.includes('week')) {
      return { score: 20, reason: 'Within this week' };
    } else if (timeframeLower.includes('bulan') || timeframeLower.includes('month')) {
      return { score: 15, reason: 'Within this month' };
    } else if (timeframeLower.includes('survey') || timeframeLower.includes('browsing')) {
      return { score: 5, reason: 'Just browsing' };
    }

    return { score: 10, reason: 'Unspecified timeframe' };
  }

  /**
   * Calculate match score (0-25)
   */
  private calculateMatchScore(
    interestedIn?: string | null,
    vehicleId?: string | null
  ): { score: number; reason: string } {
    // Specific vehicle interest = higher score
    if (vehicleId) {
      return { score: 25, reason: 'Specific vehicle interest' };
    }

    // Make/model interest
    if (interestedIn) {
      return { score: 20, reason: 'Specific make/model interest' };
    }

    return { score: 10, reason: 'General inquiry' };
  }

  /**
   * Calculate engagement score (0-25)
   */
  private calculateEngagementScore(activityCount: number): { score: number; reason: string } {
    if (activityCount >= 10) {
      return { score: 25, reason: 'Very high engagement (10+ interactions)' };
    } else if (activityCount >= 5) {
      return { score: 20, reason: 'High engagement (5-9 interactions)' };
    } else if (activityCount >= 3) {
      return { score: 15, reason: 'Moderate engagement (3-4 interactions)' };
    } else if (activityCount >= 1) {
      return { score: 10, reason: 'Some engagement (1-2 interactions)' };
    } else {
      return { score: 5, reason: 'New lead (no interactions yet)' };
    }
  }

  /**
   * Determine tier based on total score
   */
  private determineTier(totalScore: number): LeadTier {
    if (totalScore >= 75) {
      return 'HOT';
    } else if (totalScore >= 50) {
      return 'WARM';
    } else {
      return 'COLD';
    }
  }
}

export const leadScoringService = new LeadScoringService();
