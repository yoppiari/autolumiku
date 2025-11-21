/**
 * Team Analytics Service Unit Tests
 * Tests for team performance analytics functionality
 */

import { TeamAnalyticsService } from '@/services/team-analytics-service';
import { DatabaseClient } from '@/lib/database';
import { Cache } from '@/lib/cache';
import { Logger } from '@/lib/logger';

// Mock dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/cache');
jest.mock('@/lib/logger');

describe('TeamAnalyticsService', () => {
  let service: TeamAnalyticsService;
  let mockDb: jest.Mocked<DatabaseClient>;
  let mockCache: jest.Mocked<Cache>;
  let mockLogger: jest.Mocked<Logger>;

  const tenantId = 'test-tenant-123';

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      query: jest.fn(),
      close: jest.fn()
    } as any;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      deletePattern: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    service = new TeamAnalyticsService(mockDb, tenantId);
  });

  describe('getTeamAnalytics', () => {
    const period = {
      startDate: new Date('2023-12-01'),
      endDate: new Date('2023-12-31'),
      type: 'monthly' as const
    };

    it('should return comprehensive team analytics report', async () => {
      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Mock all the dependent service calls
      mockDb.query
        // Team metrics queries
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // total members
        .mockResolvedValueOnce({ rows: [{ count: '8' }] }) // active members
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // online members
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // new members
        .mockResolvedValueOnce({
          rows: [
            { name: 'sales_manager', display_name: 'Sales Manager', count: '3', percentage: '30.0' }
          ]
        }) // members by role
        .mockResolvedValueOnce({
          rows: [
            { department: 'Sales', count: '5', percentage: '50.0' }
          ]
        }) // members by department

        // Performance metrics query
        .mockResolvedValueOnce({
          rows: [
            {
              member_id: 'member-1',
              member_name: 'John Doe',
              role: 'Sales Executive',
              department: 'Sales',
              avg_response_time: '300',
              median_response_time: '250',
              best_response_time: '60',
              worst_response_time: '900',
              inventory_updates: '5',
              customer_interactions: '20',
              appointments_booked: '8',
              sales_closed: '3',
              revenue_generated: '45000',
              activity_score: '85',
              last_activity_at: new Date()
            }
          ]
        })

        // Activity heatmap query
        .mockResolvedValueOnce({
          rows: [
            {
              date: '2023-12-01',
              hour: 9,
              activity_count: '15',
              member_ids: ['member-1', 'member-2']
            }
          ]
        })

        // Comparative analytics queries
        .mockResolvedValueOnce({ rows: [{ value: '100' }] }) // current period
        .mockResolvedValueOnce({ rows: [{ value: '80' }] }); // previous period

      // Mock the private methods by calling them through the public method
      const result = await service.getTeamAnalytics(period);

      expect(result).toMatchObject({
        period,
        teamMetrics: {
          totalMembers: 10,
          activeMembers: 8,
          onlineMembers: 3,
          newMembersThisMonth: 2,
          membersByRole: expect.any(Array),
          membersByDepartment: expect.any(Array)
        },
        performanceMetrics: expect.any(Array),
        activityHeatmap: expect.any(Array),
        comparativeAnalytics: expect.any(Array),
        insights: expect.any(Array)
      });

      expect(result.performanceMetrics).toHaveLength(1);
      expect(result.performanceMetrics[0]).toMatchObject({
        memberId: 'member-1',
        memberName: 'John Doe',
        role: 'Sales Executive',
        department: 'Sales',
        activityScore: 85,
        inventoryUpdates: 5,
        customerInteractions: 20,
        appointmentsBooked: 8,
        salesClosed: 3,
        revenueGenerated: 45000
      });

      expect(mockCache.set).toHaveBeenCalledWith(
        `team_analytics:${tenantId}:${JSON.stringify(period)}`,
        expect.any(String)
      );
    });

    it('should return cached analytics when available', async () => {
      const cachedReport = {
        period,
        teamMetrics: { totalMembers: 10 },
        performanceMetrics: [],
        activityHeatmap: [],
        comparativeAnalytics: [],
        insights: []
      };

      mockCache.get.mockResolvedValue(JSON.stringify(cachedReport));

      const result = await service.getTeamAnalytics(period);

      expect(result).toEqual(cachedReport);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getTeamAnalytics(period)).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get team analytics',
        expect.objectContaining({ period })
      );
    });
  });

  describe('getTeamMetrics', () => {
    const period = {
      startDate: new Date('2023-12-01'),
      endDate: new Date('2023-12-31'),
      type: 'monthly' as const
    };

    it('should calculate team metrics correctly', async () => {
      mockCache.get.mockResolvedValue(null);

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '15' }] }) // total members
        .mockResolvedValueOnce({ rows: [{ count: '12' }] }) // active members
        .mockResolvedValueOnce({ rows: [{ count: '4' }] }) // online members
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // new members
        .mockResolvedValueOnce({
          rows: [
            { name: 'sales_executive', display_name: 'Sales Executive', count: '8', percentage: '53.3' },
            { name: 'manager', display_name: 'Manager', count: '7', percentage: '46.7' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { department: 'Sales', count: '10', percentage: '66.7' },
            { department: 'Management', count: '5', percentage: '33.3' }
          ]
        });

      const result = await service['getTeamMetrics'](period);

      expect(result).toMatchObject({
        totalMembers: 15,
        activeMembers: 12,
        onlineMembers: 4,
        newMembersThisMonth: 3,
        membersByRole: [
          { name: 'sales_executive', displayName: 'Sales Executive', count: 8, percentage: 53.3 },
          { name: 'manager', displayName: 'Manager', count: 7, percentage: 46.7 }
        ],
        membersByDepartment: [
          { department: 'Sales', count: 10, percentage: 66.7 },
          { department: 'Management', count: 5, percentage: 33.3 }
        ]
      });
    });

    it('should handle empty team gracefully', async () => {
      mockCache.get.mockResolvedValue(null);

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service['getTeamMetrics'](period);

      expect(result).toMatchObject({
        totalMembers: 0,
        activeMembers: 0,
        onlineMembers: 0,
        newMembersThisMonth: 0,
        membersByRole: [],
        membersByDepartment: []
      });
    });
  });

  describe('getPerformanceMetrics', () => {
    const period = {
      startDate: new Date('2023-12-01'),
      endDate: new Date('2023-12-31'),
      type: 'monthly' as const
    };

    it('should calculate performance metrics with proper aggregations', async () => {
      mockCache.get.mockResolvedValue(null);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            member_id: 'member-1',
            member_name: 'Alice Johnson',
            role: 'Sales Manager',
            department: 'Sales',
            avg_response_time: '180', // 3 minutes in seconds
            median_response_time: '150',
            best_response_time: '30',
            worst_response_time: '600',
            inventory_updates: '10',
            customer_interactions: '45',
            appointments_booked: '15',
            sales_closed: '8',
            revenue_generated: '120000',
            activity_score: '125',
            last_activity_at: new Date('2023-12-31T10:00:00Z')
          }
        ]
      });

      const result = await service['getPerformanceMetrics'](period);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        memberId: 'member-1',
        memberName: 'Alice Johnson',
        role: 'Sales Manager',
        department: 'Sales',
        leadResponseTime: {
          average: 180,
          median: 150,
          best: 30,
          worst: 600
        },
        inventoryUpdates: 10,
        customerInteractions: 45,
        appointmentsBooked: 15,
        salesClosed: 8,
        revenueGenerated: 120000,
        activityScore: 125
      });
    });

    it('should handle NULL values gracefully', async () => {
      mockCache.get.mockResolvedValue(null);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            member_id: 'member-1',
            member_name: 'Bob Smith',
            role: 'Sales Executive',
            department: 'Sales',
            avg_response_time: null,
            median_response_time: null,
            best_response_time: null,
            worst_response_time: null,
            inventory_updates: '0',
            customer_interactions: '0',
            appointments_booked: '0',
            sales_closed: '0',
            revenue_generated: null,
            activity_score: '0',
            last_activity_at: null
          }
        ]
      });

      const result = await service['getPerformanceMetrics'](period);

      expect(result[0]).toMatchObject({
        leadResponseTime: {
          average: 0,
          median: 0,
          best: 0,
          worst: 0
        },
        revenueGenerated: 0,
        lastActiveTime: null
      });
    });
  });

  describe('getActivityHeatmap', () => {
    const period = {
      startDate: new Date('2023-12-01'),
      endDate: new Date('2023-12-31'),
      type: 'monthly' as const
    };

    it('should generate activity heatmap data', async () => {
      mockCache.get.mockResolvedValue(null);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            date: '2023-12-01',
            hour: 9,
            activity_count: '25',
            member_ids: ['member-1', 'member-2', 'member-3']
          },
          {
            date: '2023-12-01',
            hour: 14,
            activity_count: '15',
            member_ids: ['member-1', 'member-2']
          }
        ]
      });

      const result = await service['getActivityHeatmap'](period);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        date: '2023-12-01',
        hour: 9,
        activityCount: 25,
        memberIds: ['member-1', 'member-2', 'member-3']
      });
    });
  });

  describe('generateInsights', () => {
    const period = {
      startDate: new Date('2023-12-01'),
      endDate: new Date('2023-12-31'),
      type: 'monthly' as const
    };

    it('should generate insights for low activity members', async () => {
      // Mock team metrics
      jest.spyOn(service as any, 'getTeamMetrics').mockResolvedValueOnce({
        totalMembers: 5
      });

      // Mock performance metrics with low activity members
      jest.spyOn(service as any, 'getPerformanceMetrics').mockResolvedValueOnce([
        {
          memberId: 'member-1',
          memberName: 'John Doe',
          activityScore: 5,
          lastActiveTime: new Date('2023-12-15')
        },
        {
          memberId: 'member-2',
          memberName: 'Jane Smith',
          activityScore: 8,
          lastActiveTime: new Date('2023-12-20')
        }
      ]);

      const insights = await service['generateInsights'](period);

      expect(insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            title: 'Low Activity Detected',
            description: '2 team member(s) have shown minimal activity this period',
            metric: 'activity_score',
            recommendation: expect.stringContaining('check in with these team members')
          })
        ])
      );
    });

    it('should generate insights for high performers', async () => {
      jest.spyOn(service as any, 'getTeamMetrics').mockResolvedValueOnce({
        totalMembers: 3
      });

      jest.spyOn(service as any, 'getPerformanceMetrics').mockResolvedValueOnce([
        {
          memberId: 'member-1',
          memberName: 'Alice Johnson',
          activityScore: 120
        },
        {
          memberId: 'member-2',
          memberName: 'Bob Smith',
          activityScore: 80
        }
      ]);

      const insights = await service['generateInsights'](period);

      expect(insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'positive',
            title: 'Excellent Performance',
            description: 'Alice Johnson is showing outstanding performance with 120 activity points',
            metric: 'activity_score'
          })
        ])
      );
    });

    it('should generate insights for slow response times', async () => {
      jest.spyOn(service as any, 'getTeamMetrics').mockResolvedValueOnce({
        totalMembers: 2
      });

      jest.spyOn(service as any, 'getPerformanceMetrics').mockResolvedValueOnce([
        {
          memberId: 'member-1',
          memberName: 'John Doe',
          leadResponseTime: { average: 7200 } // 2 hours
        },
        {
          memberId: 'member-2',
          memberName: 'Jane Smith',
          leadResponseTime: { average: 1800 } // 30 minutes
        }
      ]);

      const insights = await service['generateInsights'](period);

      expect(insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            title: 'Slow Response Times',
            description: 'Average lead response time is 45 minutes',
            metric: 'response_time'
          })
        ])
      );
    });

    it('should generate insights for department imbalance', async () => {
      jest.spyOn(service as any, 'getTeamMetrics').mockResolvedValueOnce({
        totalMembers: 10,
        membersByDepartment: [
          { department: 'Sales', count: 8, percentage: 80 },
          { department: 'Management', count: 2, percentage: 20 }
        ]
      });

      jest.spyOn(service as any, 'getPerformanceMetrics').mockResolvedValueOnce([]);

      const insights = await service['generateInsights'](period);

      expect(insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'info',
            title: 'Department Distribution',
            description: 'Sales represents 80% of the team',
            metric: 'department_distribution'
          })
        ])
      );
    });

    it('should handle insight generation errors gracefully', async () => {
      jest.spyOn(service as any, 'getTeamMetrics').mockRejectedValueOnce(
        new Error('Metrics generation failed')
      );

      const insights = await service['generateInsights'](period);

      expect(insights).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate insights',
        expect.any(Object)
      );
    });
  });

  describe('exportAnalytics', () => {
    const period = {
      startDate: new Date('2023-12-01'),
      endDate: new Date('2023-12-31'),
      type: 'monthly' as const
    };

    const mockAnalyticsData = {
      period,
      teamMetrics: { totalMembers: 10 },
      performanceMetrics: [
        {
          memberName: 'John Doe',
          role: 'Sales Executive',
          department: 'Sales',
          activityScore: 85,
          inventoryUpdates: 5,
          customerInteractions: 20
        }
      ],
      activityHeatmap: [],
      comparativeAnalytics: [],
      insights: []
    };

    it('should export analytics as JSON', async () => {
      jest.spyOn(service, 'getTeamAnalytics').mockResolvedValueOnce(mockAnalyticsData);

      const result = await service.exportAnalytics(period, 'json');

      expect(result).toEqual(mockAnalyticsData);
    });

    it('should export analytics as CSV', async () => {
      jest.spyOn(service, 'getTeamAnalytics').mockResolvedValueOnce(mockAnalyticsData);

      const result = await service.exportAnalytics(period, 'csv');

      expect(result).toContain('Member Name');
      expect(result).toContain('John Doe');
      expect(result).toContain('Sales Executive');
      expect(result).toContain('85');
    });

    it('should export analytics as Excel structure', async () => {
      jest.spyOn(service, 'getTeamAnalytics').mockResolvedValueOnce(mockAnalyticsData);

      const result = await service.exportAnalytics(period, 'excel');

      expect(result).toMatchObject({
        sheets: expect.arrayContaining([
          { name: 'Team Overview', data: mockAnalyticsData.teamMetrics },
          { name: 'Performance Metrics', data: mockAnalyticsData.performanceMetrics },
          { name: 'Activity Heatmap', data: [] }
        ])
      });
    });

    it('should handle unsupported export formats', async () => {
      await expect(
        service.exportAnalytics(period, 'pdf' as any)
      ).rejects.toThrow('Unsupported export format: pdf');
    });
  });

  describe('cache management', () => {
    it('should clear all analytics cache', async () => {
      await service.clearCache();

      expect(mockCache.deletePattern).toHaveBeenCalledWith(`team_analytics:${tenantId}:*`);
      expect(mockCache.deletePattern).toHaveBeenCalledWith(`team_metrics:${tenantId}:*`);
      expect(mockCache.deletePattern).toHaveBeenCalledWith(`performance_metrics:${tenantId}:*`);
      expect(mockCache.deletePattern).toHaveBeenCalledWith(`activity_heatmap:${tenantId}:*`);
      expect(mockCache.deletePattern).toHaveBeenCalledWith(`comparative_analytics:${tenantId}:*`);
    });
  });

  describe('error handling', () => {
    const period = {
      startDate: new Date('2023-12-01'),
      endDate: new Date('2023-12-31'),
      type: 'monthly' as const
    };

    it('should handle database connection errors', async () => {
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockRejectedValue(new Error('Connection timeout'));

      await expect(service.getTeamAnalytics(period)).rejects.toThrow('Connection timeout');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache service unavailable'));

      // Should still attempt to fetch from database
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service['getTeamMetrics'](period);

      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});