/**
 * Team Analytics Service
 * Comprehensive team performance analytics and reporting
 * Supports Indonesian automotive dealership metrics and KPIs
 */

import { DatabaseClient } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { Cache } from '@/lib/cache';

export interface TeamMetrics {
  totalMembers: number;
  activeMembers: number;
  onlineMembers: number;
  newMembersThisMonth: number;
  membersByRole: Array<{
    roleName: string;
    displayName: string;
    count: number;
    percentage: number;
  }>;
  membersByDepartment: Array<{
    department: string;
    count: number;
    percentage: number;
  }>;
}

export interface PerformanceMetrics {
  memberId: string;
  memberName: string;
  role: string;
  department: string;
  leadResponseTime: {
    average: number;
    median: number;
    best: number;
    worst: number;
  };
  inventoryUpdates: number;
  customerInteractions: number;
  appointmentsBooked: number;
  salesClosed: number;
  revenueGenerated: number;
  activityScore: number;
  lastActiveTime: Date | null;
}

export interface ActivityHeatmapData {
  date: string;
  hour: number;
  activityCount: number;
  memberIds: string[];
}

export interface ComparativeAnalytics {
  period: string;
  metrics: {
    totalActivities: number;
    averageResponseTime: number;
    customerSatisfaction: number;
    salesPerformance: number;
    teamCollaboration: number;
  };
  comparison: {
    previousPeriod: number;
    changePercentage: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export interface TeamAnalyticsReport {
  period: {
    startDate: Date;
    endDate: Date;
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  };
  teamMetrics: TeamMetrics;
  performanceMetrics: PerformanceMetrics[];
  activityHeatmap: ActivityHeatmapData[];
  comparativeAnalytics: ComparativeAnalytics[];
  insights: Array<{
    type: 'positive' | 'warning' | 'info';
    title: string;
    description: string;
    metric: string;
    recommendation?: string;
  }>;
}

export class TeamAnalyticsService {
  private readonly logger: Logger;
  private readonly cache: Cache;

  constructor(
    private readonly db: DatabaseClient,
    private readonly tenantId: string
  ) {
    this.logger = new Logger('TeamAnalyticsService');
    this.cache = new Cache('team_analytics', 1800); // 30 minute cache
  }

  /**
   * Get comprehensive team analytics
   */
  async getTeamAnalytics(
    period: {
      startDate: Date;
      endDate: Date;
      type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    }
  ): Promise<TeamAnalyticsReport> {
    const cacheKey = `team_analytics:${this.tenantId}:${JSON.stringify(period)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);

      const [
        teamMetrics,
        performanceMetrics,
        activityHeatmap,
        comparativeAnalytics,
        insights
      ] = await Promise.all([
        this.getTeamMetrics(period),
        this.getPerformanceMetrics(period),
        this.getActivityHeatmap(period),
        this.getComparativeAnalytics(period),
        this.generateInsights(period)
      ]);

      const report: TeamAnalyticsReport = {
        period,
        teamMetrics,
        performanceMetrics,
        activityHeatmap,
        comparativeAnalytics,
        insights
      };

      await this.cache.set(cacheKey, JSON.stringify(report));
      return report;
    } catch (error) {
      this.logger.error('Failed to get team analytics', { error, period });
      throw error;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get team overview metrics
   */
  private async getTeamMetrics(period: any): Promise<TeamMetrics> {
    const cacheKey = `team_metrics:${this.tenantId}:${JSON.stringify(period)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    // Total members
    const totalMembersQuery = `
      SELECT COUNT(*) as count
      FROM team_members
      WHERE tenant_id = $1
    `;
    const totalResult = await this.db.query(totalMembersQuery, [this.tenantId]);
    const totalMembers = parseInt(totalResult.rows[0].count);

    // Active members (logged in within last 30 days)
    const activeMembersQuery = `
      SELECT COUNT(*) as count
      FROM team_members tm
      WHERE tm.tenant_id = $1
        AND tm.is_active = true
        AND tm.last_login_at >= NOW() - INTERVAL '30 days'
    `;
    const activeResult = await this.db.query(activeMembersQuery, [this.tenantId]);
    const activeMembers = parseInt(activeResult.rows[0].count);

    // Online members (active in last 5 minutes)
    const onlineMembersQuery = `
      SELECT COUNT(*) as count
      FROM team_members tm
      WHERE tm.tenant_id = $1
        AND tm.is_active = true
        AND tm.last_activity_at >= NOW() - INTERVAL '5 minutes'
    `;
    const onlineResult = await this.db.query(onlineMembersQuery, [this.tenantId]);
    const onlineMembers = parseInt(onlineResult.rows[0].count);

    // New members this month
    const newMembersQuery = `
      SELECT COUNT(*) as count
      FROM team_members tm
      WHERE tm.tenant_id = $1
        AND tm.created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `;
    const newResult = await this.db.query(newMembersQuery, [this.tenantId]);
    const newMembersThisMonth = parseInt(newResult.rows[0].count);

    // Members by role
    const byRoleQuery = `
      SELECT
        dr.name,
        dr.display_name,
        COUNT(tmr.id) as count,
        ROUND(COUNT(tmr.id) * 100.0 / $2, 2) as percentage
      FROM dealership_roles dr
      LEFT JOIN team_member_roles tmr ON dr.id = tmr.role_id
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      WHERE (dr.tenant_id = $1 OR dr.tenant_id IS NULL)
        AND dr.is_active = true
      GROUP BY dr.id, dr.name, dr.display_name
      HAVING COUNT(tmr.id) > 0
      ORDER BY count DESC
    `;
    const byRoleResult = await this.db.query(byRoleQuery, [this.tenantId, totalMembers]);
    const membersByRole = byRoleResult.rows;

    // Members by department
    const byDepartmentQuery = `
      SELECT
        dr.department,
        COUNT(tmr.id) as count,
        ROUND(COUNT(tmr.id) * 100.0 / $2, 2) as percentage
      FROM dealership_roles dr
      LEFT JOIN team_member_roles tmr ON dr.id = tmr.role_id
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      WHERE (dr.tenant_id = $1 OR dr.tenant_id IS NULL)
        AND dr.is_active = true
        AND dr.department IS NOT NULL
      GROUP BY dr.department
      ORDER BY count DESC
    `;
    const byDepartmentResult = await this.db.query(byDepartmentQuery, [this.tenantId, totalMembers]);
    const membersByDepartment = byDepartmentResult.rows;

    const metrics: TeamMetrics = {
      totalMembers,
      activeMembers,
      onlineMembers,
      newMembersThisMonth,
      membersByRole,
      membersByDepartment
    };

    await this.cache.set(cacheKey, JSON.stringify(metrics));
    return metrics;
  }

  /**
   * Get individual performance metrics
   */
  private async getPerformanceMetrics(period: any): Promise<PerformanceMetrics[]> {
    const cacheKey = `performance_metrics:${this.tenantId}:${JSON.stringify(period)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT
        tm.id as member_id,
        u.first_name || ' ' || u.last_name as member_name,
        dr.display_name as role,
        dr.department,
        -- Lead response time metrics
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (lr.responded_at - lr.created_at))
        ), 0) as avg_response_time,
        COALESCE(
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (lr.responded_at - lr.created_at))
          ), 0
        ) as median_response_time,
        COALESCE(
          MIN(EXTRACT(EPOCH FROM (lr.responded_at - lr.created_at))), 0
        ) as best_response_time,
        COALESCE(
          MAX(EXTRACT(EPOCH FROM (lr.responded_at - lr.created_at))), 0
        ) as worst_response_time,
        -- Activity metrics
        COALESCE(COUNT(DISTINCT ia.id), 0) as inventory_updates,
        COALESCE(COUNT(DISTINCT ci.id), 0) as customer_interactions,
        COALESCE(COUNT(DISTINCT a.id), 0) as appointments_booked,
        COALESCE(COUNT(DISTINCT s.id), 0) as sales_closed,
        COALESCE(SUM(s.amount), 0) as revenue_generated,
        -- Activity score (composite metric)
        COALESCE(
          (
            COUNT(DISTINCT ia.id) * 1 +
            COUNT(DISTINCT ci.id) * 2 +
            COUNT(DISTINCT a.id) * 3 +
            COUNT(DISTINCT s.id) * 5
          ), 0
        ) as activity_score,
        tm.last_activity_at
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
      JOIN dealership_roles dr ON tmr.role_id = dr.id
      LEFT JOIN lead_responses lr ON tm.id = lr.team_member_id
        AND lr.created_at BETWEEN $2 AND $3
      LEFT JOIN inventory_activities ia ON tm.id = ia.team_member_id
        AND ia.created_at BETWEEN $2 AND $3
      LEFT JOIN customer_interactions ci ON tm.id = ci.team_member_id
        AND ci.created_at BETWEEN $2 AND $3
      LEFT JOIN appointments a ON tm.id = a.created_by_team_member_id
        AND a.created_at BETWEEN $2 AND $3
      LEFT JOIN sales s ON tm.id = s.team_member_id
        AND s.created_at BETWEEN $2 AND $3
      WHERE tm.tenant_id = $1
        AND tm.is_active = true
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      GROUP BY tm.id, u.first_name, u.last_name, dr.display_name, dr.department
      ORDER BY activity_score DESC
    `;

    const result = await this.db.query(query, [
      this.tenantId,
      period.startDate,
      period.endDate
    ]);

    const metrics: PerformanceMetrics[] = result.rows.map(row => ({
      memberId: row.member_id,
      memberName: row.member_name,
      role: row.role,
      department: row.department,
      leadResponseTime: {
        average: parseFloat(row.avg_response_time) || 0,
        median: parseFloat(row.median_response_time) || 0,
        best: parseFloat(row.best_response_time) || 0,
        worst: parseFloat(row.worst_response_time) || 0
      },
      inventoryUpdates: parseInt(row.inventory_updates) || 0,
      customerInteractions: parseInt(row.customer_interactions) || 0,
      appointmentsBooked: parseInt(row.appointments_booked) || 0,
      salesClosed: parseInt(row.sales_closed) || 0,
      revenueGenerated: parseFloat(row.revenue_generated) || 0,
      activityScore: parseInt(row.activity_score) || 0,
      lastActiveTime: row.last_activity_at
    }));

    await this.cache.set(cacheKey, JSON.stringify(metrics));
    return metrics;
  }

  /**
   * Get activity heatmap data
   */
  private async getActivityHeatmap(period: any): Promise<ActivityHeatmapData[]> {
    const cacheKey = `activity_heatmap:${this.tenantId}:${JSON.stringify(period)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT
        DATE(tal.created_at) as date,
        EXTRACT(HOUR FROM tal.created_at) as hour,
        COUNT(*) as activity_count,
        array_agg(DISTINCT tal.team_member_id) as member_ids
      FROM team_activity_logs tal
      WHERE tal.tenant_id = $1
        AND tal.created_at BETWEEN $2 AND $3
      GROUP BY DATE(tal.created_at), EXTRACT(HOUR FROM tal.created_at)
      ORDER BY date, hour
    `;

    const result = await this.db.query(query, [
      this.tenantId,
      period.startDate,
      period.endDate
    ]);

    const heatmap: ActivityHeatmapData[] = result.rows.map(row => ({
      date: row.date,
      hour: parseInt(row.hour),
      activityCount: parseInt(row.activity_count),
      memberIds: row.member_ids || []
    }));

    await this.cache.set(cacheKey, JSON.stringify(heatmap));
    return heatmap;
  }

  /**
   * Get comparative analytics
   */
  private async getComparativeAnalytics(period: any): Promise<ComparativeAnalytics[]> {
    const cacheKey = `comparative_analytics:${this.tenantId}:${JSON.stringify(period)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    // Calculate previous period dates
    const duration = period.endDate.getTime() - period.startDate.getTime();
    const previousEndDate = new Date(period.startDate.getTime());
    const previousStartDate = new Date(previousEndDate.getTime() - duration);

    const metrics = [
      {
        name: 'totalActivities',
        currentQuery: `
          SELECT COUNT(*) as value
          FROM team_activity_logs
          WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
        `,
        previousQuery: `
          SELECT COUNT(*) as value
          FROM team_activity_logs
          WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
        `
      },
      {
        name: 'averageResponseTime',
        currentQuery: `
          SELECT COALESCE(AVG(
            EXTRACT(EPOCH FROM (responded_at - created_at))
          ), 0) as value
          FROM lead_responses
          WHERE created_at BETWEEN $2 AND $3
        `,
        previousQuery: `
          SELECT COALESCE(AVG(
            EXTRACT(EPOCH FROM (responded_at - created_at))
          ), 0) as value
          FROM lead_responses
          WHERE created_at BETWEEN $2 AND $3
        `
      }
      // Add more metrics as needed
    ];

    const comparativeAnalytics: ComparativeAnalytics[] = [];

    for (const metric of metrics) {
      const [currentResult, previousResult] = await Promise.all([
        this.db.query(metric.currentQuery, [this.tenantId, period.startDate, period.endDate]),
        this.db.query(metric.previousQuery, [this.tenantId, previousStartDate, previousEndDate])
      ]);

      const currentValue = parseFloat(currentResult.rows[0].value) || 0;
      const previousValue = parseFloat(previousResult.rows[0].value) || 0;

      const changePercentage = previousValue > 0
        ? ((currentValue - previousValue) / previousValue) * 100
        : 0;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (Math.abs(changePercentage) > 5) {
        trend = changePercentage > 0 ? 'up' : 'down';
      }

      comparativeAnalytics.push({
        period: period.type,
        metrics: {
          totalActivities: 0, // Would be calculated based on specific metric
          averageResponseTime: 0,
          customerSatisfaction: 0,
          salesPerformance: 0,
          teamCollaboration: 0
        },
        comparison: {
          previousPeriod: previousValue,
          changePercentage,
          trend
        }
      });
    }

    await this.cache.set(cacheKey, JSON.stringify(comparativeAnalytics));
    return comparativeAnalytics;
  }

  /**
   * Generate AI-powered insights from team data
   */
  private async generateInsights(period: any): Promise<any[]> {
    const insights = [];

    try {
      // Get team metrics for insight generation
      const teamMetrics = await this.getTeamMetrics(period);
      const performanceMetrics = await this.getPerformanceMetrics(period);

      // Insight 1: Low activity members
      const lowActivityMembers = performanceMetrics.filter(
        m => m.activityScore < 10 && m.lastActiveTime
      );
      if (lowActivityMembers.length > 0) {
        insights.push({
          type: 'warning',
          title: 'Low Activity Detected',
          description: `${lowActivityMembers.length} team member(s) have shown minimal activity this period`,
          metric: 'activity_score',
          recommendation: 'Consider checking in with these team members to identify any obstacles or provide additional training'
        });
      }

      // Insight 2: High performers
      const topPerformers = performanceMetrics
        .sort((a, b) => b.activityScore - a.activityScore)
        .slice(0, 3);
      if (topPerformers.length > 0 && topPerformers[0].activityScore > 50) {
        insights.push({
          type: 'positive',
          title: 'Excellent Performance',
          description: `${topPerformers[0].memberName} is showing outstanding performance with ${topPerformers[0].activityScore} activity points`,
          metric: 'activity_score',
          recommendation: 'Consider recognizing this achievement and sharing best practices with the team'
        });
      }

      // Insight 3: Response time issues
      const avgResponseTime = performanceMetrics.reduce(
        (sum, m) => sum + m.leadResponseTime.average, 0
      ) / performanceMetrics.length;
      if (avgResponseTime > 3600) { // More than 1 hour
        insights.push({
          type: 'warning',
          title: 'Slow Response Times',
          description: `Average lead response time is ${Math.round(avgResponseTime / 60)} minutes`,
          metric: 'response_time',
          recommendation: 'Implement lead response protocols and consider setting up automated notifications'
        });
      }

      // Insight 4: Department balance
      const totalMembers = teamMetrics.totalMembers;
      const largestDept = teamMetrics.membersByDepartment[0];
      if (largestDept && largestDept.percentage > 60) {
        insights.push({
          type: 'info',
          title: 'Department Distribution',
          description: `${largestDept.department} represents ${largestDept.percentage}% of the team`,
          metric: 'department_distribution',
          recommendation: 'Consider balancing team distribution across departments for better coverage'
        });
      }

      // Insight 5: New member onboarding
      if (teamMetrics.newMembersThisMonth > 0) {
        insights.push({
          type: 'positive',
          title: 'Team Growth',
          description: `${teamMetrics.newMembersThisMonth} new team member(s) joined this month`,
          metric: 'new_members',
          recommendation: 'Ensure proper onboarding and training for new team members'
        });
      }

    } catch (error) {
      this.logger.error('Failed to generate insights', { error });
    }

    return insights;
  }

  /**
   * Export analytics data in various formats
   */
  async exportAnalytics(
    period: any,
    format: 'json' | 'csv' | 'excel'
  ): Promise<any> {
    const analytics = await this.getTeamAnalytics(period);

    switch (format) {
      case 'json':
        return analytics;

      case 'csv':
        return this.convertToCSV(analytics);

      case 'excel':
        return this.convertToExcel(analytics);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert analytics data to CSV format
   */
  private convertToCSV(analytics: TeamAnalyticsReport): string {
    const headers = [
      'Member Name',
      'Role',
      'Department',
      'Activity Score',
      'Inventory Updates',
      'Customer Interactions',
      'Appointments Booked',
      'Sales Closed',
      'Revenue Generated',
      'Avg Response Time (min)'
    ];

    const rows = analytics.performanceMetrics.map(metric => [
      metric.memberName,
      metric.role,
      metric.department,
      metric.activityScore,
      metric.inventoryUpdates,
      metric.customerInteractions,
      metric.appointmentsBooked,
      metric.salesClosed,
      metric.revenueGenerated,
      Math.round(metric.leadResponseTime.average / 60)
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Convert analytics data to Excel format
   */
  private convertToExcel(analytics: TeamAnalyticsReport): any {
    // This would integrate with a library like xlsx
    // For now, return a structure that can be converted
    return {
      sheets: [
        {
          name: 'Team Overview',
          data: analytics.teamMetrics
        },
        {
          name: 'Performance Metrics',
          data: analytics.performanceMetrics
        },
        {
          name: 'Activity Heatmap',
          data: analytics.activityHeatmap
        }
      ]
    };
  }

  /**
   * Clear analytics cache
   */
  async clearCache(): Promise<void> {
    await this.cache.deletePattern(`team_analytics:${this.tenantId}:*`);
    await this.cache.deletePattern(`team_metrics:${this.tenantId}:*`);
    await this.cache.deletePattern(`performance_metrics:${this.tenantId}:*`);
    await this.cache.deletePattern(`activity_heatmap:${this.tenantId}:*`);
    await this.cache.deletePattern(`comparative_analytics:${this.tenantId}:*`);
  }
}