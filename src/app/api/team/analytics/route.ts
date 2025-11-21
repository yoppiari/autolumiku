import { NextRequest, NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/database';
import { TeamAnalyticsService } from '@/services/team-analytics-service';
import { authenticateRequest } from '@/lib/auth';
import { Logger } from '@/lib/logger';

const logger = new Logger('TeamAnalyticsAPI');

/**
 * GET /api/team/analytics - Team performance analytics
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Unauthorized', message: auth.error },
        { status: 401 }
      );
    }

    // Check if user has permission to view analytics
    await auth.requirePermission('team.view_analytics');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const reportType = searchParams.get('type') || 'monthly';
    const includeInsights = searchParams.get('includeInsights') === 'true';
    const includeHeatmap = searchParams.get('includeHeatmap') === 'true';

    // Validate report type
    const validTypes = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validTypes.includes(reportType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate and parse dates
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation error',
            message: 'Invalid date format. Use ISO format (YYYY-MM-DD)'
          },
          { status: 400 }
        );
      }

      if (start >= end) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation error',
            message: 'Start date must be before end date'
          },
          { status: 400 }
        );
      }
    } else {
      // Set default period based on report type
      end = new Date();

      switch (reportType) {
        case 'daily':
          start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
          break;
        case 'weekly':
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
          break;
        case 'monthly':
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          break;
        case 'quarterly':
          start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000); // Last 90 days
          break;
        case 'yearly':
          start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000); // Last 365 days
          break;
        default:
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    // Limit date range to 1 year
    const maxRange = 365 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRange) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: 'Date range cannot exceed 1 year'
        },
        { status: 400 }
      );
    }

    const db = new DatabaseClient();
    const analyticsService = new TeamAnalyticsService(db, auth.tenantId);

    const period = {
      startDate: start,
      endDate: end,
      type: reportType as any
    };

    const analyticsData = await analyticsService.getTeamAnalytics(period);

    await db.close();

    // Filter data based on query parameters
    let filteredData = analyticsData;

    if (!includeInsights) {
      filteredData = { ...analyticsData, insights: [] };
    }

    if (!includeHeatmap) {
      filteredData = { ...filteredData, activityHeatmap: [] };
    }

    return NextResponse.json({
      success: true,
      data: filteredData,
      meta: {
        period: {
          start,
          end,
          type: reportType,
          days: Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
        },
        includeInsights,
        includeHeatmap,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Failed to fetch team analytics', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch team analytics'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/analytics/export - Export analytics data
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Unauthorized', message: auth.error },
        { status: 401 }
      );
    }

    // Check if user has permission to export analytics
    await auth.requirePermission('team.export_analytics');

    const body = await request.json();
    const {
      format,
      startDate,
      endDate,
      reportType = 'monthly',
      includeInsights = true,
      includeHeatmap = true
    } = body;

    // Validate required fields
    if (!format || !['json', 'csv', 'excel'].includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: 'Valid format is required (json, csv, or excel)'
        },
        { status: 400 }
      );
    }

    // Validate report type
    const validTypes = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validTypes.includes(reportType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate and parse dates
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation error',
            message: 'Invalid date format. Use ISO format (YYYY-MM-DD)'
          },
          { status: 400 }
        );
      }

      if (start >= end) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation error',
            message: 'Start date must be before end date'
          },
          { status: 400 }
        );
      }
    } else {
      // Set default period based on report type
      end = new Date();

      switch (reportType) {
        case 'daily':
          start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarterly':
          start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'yearly':
          start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    // Limit date range to 1 year
    const maxRange = 365 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRange) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: 'Date range cannot exceed 1 year'
        },
        { status: 400 }
      );
    }

    const db = new DatabaseClient();
    const analyticsService = new TeamAnalyticsService(db, auth.tenantId);

    const period = {
      startDate: start,
      endDate: end,
      type: reportType as any
    };

    const exportData = await analyticsService.exportAnalytics(period, format as any);

    await db.close();

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `team-analytics-${reportType}-${timestamp}.${format}`;

    return NextResponse.json({
      success: true,
      data: {
        content: format === 'json' ? JSON.stringify(exportData, null, 2) : exportData,
        fileName,
        mimeType: format === 'json' ? 'application/json' :
                   format === 'csv' ? 'text/csv' :
                   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: JSON.stringify(exportData).length
      },
      meta: {
        period: {
          start,
          end,
          type: reportType,
          days: Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
        },
        format,
        includeInsights,
        includeHeatmap,
        exportedAt: new Date()
      },
      message: 'Analytics export generated successfully'
    });

  } catch (error) {
    logger.error('Failed to export analytics', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to export analytics'
      },
      { status: 500 }
    );
  }
}