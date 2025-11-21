/**
 * Feedback Analytics Service
 * Epic 7: Story 7.8 - Customer Satisfaction and Feedback Analytics
 *
 * Track and analyze customer feedback and satisfaction
 */

import { prisma } from '@/lib/prisma';
import { CustomerFeedback, FeedbackCategory, FeedbackStatus } from '@prisma/client';

export interface CreateFeedbackData {
  rating: number;
  category: FeedbackCategory;
  comment?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  vehicleId?: string;
  leadId?: string;
  source?: string;
}

export interface FeedbackAnalytics {
  overview: {
    totalFeedback: number;
    averageRating: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
  };
  byCategory: Record<string, {
    count: number;
    avgRating: number;
  }>;
  recentFeedback: CustomerFeedback[];
  trends: {
    improving: boolean;
    ratingChange: number;
  };
}

export class FeedbackAnalyticsService {
  /**
   * Submit feedback
   */
  async submitFeedback(
    tenantId: string,
    data: CreateFeedbackData
  ): Promise<CustomerFeedback> {
    // Determine sentiment
    const sentiment = this.determineSentiment(data.rating, data.comment);

    return prisma.customerFeedback.create({
      data: {
        tenantId,
        ...data,
        sentiment: sentiment.label,
        sentimentScore: sentiment.score,
      },
    });
  }

  /**
   * Get feedback
   */
  async getFeedback(
    feedbackId: string,
    tenantId: string
  ): Promise<CustomerFeedback | null> {
    return prisma.customerFeedback.findFirst({
      where: { id: feedbackId, tenantId },
    });
  }

  /**
   * Get all feedback
   */
  async getAllFeedback(
    tenantId: string,
    filters: {
      rating?: number;
      category?: FeedbackCategory;
      status?: FeedbackStatus;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<CustomerFeedback[]> {
    const where: any = { tenantId };

    if (filters.rating) where.rating = filters.rating;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    return prisma.customerFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Respond to feedback
   */
  async respondToFeedback(
    feedbackId: string,
    tenantId: string,
    response: string,
    userId: string
  ): Promise<CustomerFeedback> {
    return prisma.customerFeedback.update({
      where: { id: feedbackId, tenantId },
      data: {
        response,
        respondedBy: userId,
        respondedAt: new Date(),
        status: 'RESPONDED',
      },
    });
  }

  /**
   * Update feedback status
   */
  async updateFeedbackStatus(
    feedbackId: string,
    tenantId: string,
    status: FeedbackStatus
  ): Promise<CustomerFeedback> {
    return prisma.customerFeedback.update({
      where: { id: feedbackId, tenantId },
      data: { status },
    });
  }

  /**
   * Get feedback analytics
   */
  async getFeedbackAnalytics(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<FeedbackAnalytics> {
    const feedback = await this.getAllFeedback(tenantId, { dateFrom, dateTo });

    // Overview
    const totalFeedback = feedback.length;
    const totalRating = feedback.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = totalFeedback > 0 ? totalRating / totalFeedback : 0;

    const positiveCount = feedback.filter((f) => f.rating >= 4).length;
    const neutralCount = feedback.filter((f) => f.rating === 3).length;
    const negativeCount = feedback.filter((f) => f.rating <= 2).length;

    // By category
    const byCategory: Record<string, { count: number; avgRating: number }> = {};

    feedback.forEach((f) => {
      if (!byCategory[f.category]) {
        byCategory[f.category] = { count: 0, avgRating: 0 };
      }
      byCategory[f.category].count += 1;
    });

    // Calculate average rating per category
    for (const category of Object.keys(byCategory)) {
      const categoryFeedback = feedback.filter((f) => f.category === category);
      const totalRating = categoryFeedback.reduce((sum, f) => sum + f.rating, 0);
      byCategory[category].avgRating =
        categoryFeedback.length > 0
          ? Math.round((totalRating / categoryFeedback.length) * 10) / 10
          : 0;
    }

    // Recent feedback
    const recentFeedback = feedback.slice(0, 10);

    // Trends
    const midpoint = new Date((dateFrom.getTime() + dateTo.getTime()) / 2);
    const firstHalf = feedback.filter((f) => f.createdAt < midpoint);
    const secondHalf = feedback.filter((f) => f.createdAt >= midpoint);

    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, f) => sum + f.rating, 0) / firstHalf.length
      : 0;

    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((sum, f) => sum + f.rating, 0) / secondHalf.length
      : 0;

    const ratingChange = secondHalfAvg - firstHalfAvg;
    const improving = ratingChange > 0;

    return {
      overview: {
        totalFeedback,
        averageRating: Math.round(averageRating * 10) / 10,
        positiveCount,
        neutralCount,
        negativeCount,
      },
      byCategory,
      recentFeedback,
      trends: {
        improving,
        ratingChange: Math.round(ratingChange * 10) / 10,
      },
    };
  }

  /**
   * Get vehicle feedback
   */
  async getVehicleFeedback(
    tenantId: string,
    vehicleId: string
  ): Promise<CustomerFeedback[]> {
    return prisma.customerFeedback.findMany({
      where: { tenantId, vehicleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get satisfaction score (NPS-like)
   */
  async getSatisfactionScore(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    nps: number;
    promoters: number;
    passives: number;
    detractors: number;
  }> {
    const feedback = await this.getAllFeedback(tenantId, { dateFrom, dateTo });

    const promoters = feedback.filter((f) => f.rating >= 5).length;
    const passives = feedback.filter((f) => f.rating === 4).length;
    const detractors = feedback.filter((f) => f.rating <= 3).length;

    const total = feedback.length;
    const nps = total > 0
      ? ((promoters - detractors) / total) * 100
      : 0;

    return {
      nps: Math.round(nps),
      promoters,
      passives,
      detractors,
    };
  }

  /**
   * Get common issues
   */
  async getCommonIssues(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    category: FeedbackCategory;
    count: number;
    avgRating: number;
    examples: string[];
  }[]> {
    const negativeFeedback = await prisma.customerFeedback.findMany({
      where: {
        tenantId,
        rating: { lte: 2 },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { createdAt: 'desc' },
    });

    const groupedByCategory: Record<string, CustomerFeedback[]> = {};

    negativeFeedback.forEach((f) => {
      if (!groupedByCategory[f.category]) {
        groupedByCategory[f.category] = [];
      }
      groupedByCategory[f.category].push(f);
    });

    const issues = Object.entries(groupedByCategory).map(([category, items]) => {
      const totalRating = items.reduce((sum, f) => sum + f.rating, 0);
      const avgRating = items.length > 0 ? totalRating / items.length : 0;

      const examples = items
        .filter((f) => f.comment)
        .slice(0, 3)
        .map((f) => f.comment!);

      return {
        category: category as FeedbackCategory,
        count: items.length,
        avgRating: Math.round(avgRating * 10) / 10,
        examples,
      };
    });

    return issues.sort((a, b) => b.count - a.count);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Determine sentiment from rating and comment
   */
  private determineSentiment(
    rating: number,
    comment?: string
  ): { label: string; score: number } {
    // Simple rule-based sentiment
    let score = 0;

    // Rating-based (0-5 stars -> -1 to 1 sentiment)
    score = (rating - 3) / 2;

    // Comment keywords (basic)
    if (comment) {
      const commentLower = comment.toLowerCase();

      const positiveKeywords = [
        'bagus',
        'baik',
        'memuaskan',
        'recommended',
        'excellent',
        'great',
        'amazing',
      ];

      const negativeKeywords = [
        'buruk',
        'jelek',
        'mengecewakan',
        'bad',
        'poor',
        'terrible',
        'horrible',
      ];

      const hasPositive = positiveKeywords.some((kw) => commentLower.includes(kw));
      const hasNegative = negativeKeywords.some((kw) => commentLower.includes(kw));

      if (hasPositive) score += 0.2;
      if (hasNegative) score -= 0.2;
    }

    // Clamp to [-1, 1]
    score = Math.max(-1, Math.min(1, score));

    let label = 'neutral';
    if (score > 0.2) label = 'positive';
    if (score < -0.2) label = 'negative';

    return { label, score };
  }
}

export const feedbackAnalyticsService = new FeedbackAnalyticsService();
