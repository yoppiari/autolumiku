/**
 * Reports API Endpoint
 * Provides report generation and management functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportService, ReportServiceConfig } from '../../../../services/report-service';

// Initialize report service (in a real app, this would be properly dependency injected)
const reportServiceConfig: ReportServiceConfig = {
  outputDirectory: '/tmp/reports', // Would be configured properly
  maxConcurrentReports: 5,
  defaultRetention: 30, // days
  templateDirectory: '/templates'
};
const reportService = new ReportService(reportServiceConfig);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');
    const templateId = searchParams.get('templateId');
    const stats = searchParams.get('stats');

    if (stats === 'true') {
      // Get report statistics
      const statistics = reportService.getReportStatistics();
      return NextResponse.json({
        success: true,
        data: statistics
      });
    }

    if (reportId) {
      // Get specific report
      const report = reportService.getReport(reportId);
      if (!report) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'REPORT_NOT_FOUND',
              message: 'Report not found'
            }
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: report
      });
    }

    if (templateId) {
      // Get specific template
      const template = reportService.getTemplate(templateId);
      if (!template) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'TEMPLATE_NOT_FOUND',
              message: 'Report template not found'
            }
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: template
      });
    }

    const status = searchParams.get('status') as any;

    if (status) {
      // Get reports by status
      const reports = reportService.getReportsByStatus(status);
      return NextResponse.json({
        success: true,
        data: reports
      });
    }

    const templates = searchParams.get('templates') === 'true';

    if (templates) {
      // Get all templates
      const templates = reportService.getTemplates();
      return NextResponse.json({
        success: true,
        data: templates
      });
    }

    // Get all reports
    const reports = reportService.getReports();
    return NextResponse.json({
      success: true,
      data: {
        reports,
        availableTemplates: reportService.getTemplates().length
      }
    });

  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REPORTS_API_ERROR',
          message: error.message || 'Failed to retrieve reports'
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, reportId, templateId, templateData, parameters, requestedBy } = body;

    switch (action) {
      case 'generate_report':
        if (!templateId || !parameters || !requestedBy) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_GENERATE_REQUEST',
                message: 'Template ID, parameters, and requestedBy are required'
              }
            },
            { status: 400 }
          );
        }

        const report = await reportService.generateReport(templateId, parameters, requestedBy);
        return NextResponse.json({
          success: true,
          data: report
        });

      case 'create_template':
        if (!templateData) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_TEMPLATE_DATA',
                message: 'Template data is required'
              }
            },
            { status: 400 }
          );
        }

        const newTemplate = reportService.createTemplate(templateData);
        return NextResponse.json({
          success: true,
          data: newTemplate
        });

      case 'update_template':
        if (!templateId || !templateData) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_UPDATE_REQUEST',
                message: 'Template ID and update data are required'
              }
            },
            { status: 400 }
          );
        }

        const updatedTemplate = reportService.updateTemplate(templateId, templateData);
        return NextResponse.json({
          success: true,
          data: updatedTemplate
        });

      case 'delete_template':
        if (!templateId) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_TEMPLATE_ID',
                message: 'Template ID is required'
              }
            },
            { status: 400 }
          );
        }

        const deleted = reportService.deleteTemplate(templateId);
        return NextResponse.json({
          success: true,
          data: { deleted }
        });

      case 'delete_report':
        if (!reportId) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_REPORT_ID',
                message: 'Report ID is required'
              }
            },
            { status: 400 }
          );
        }

        const reportDeleted = reportService.deleteReport(reportId);
        return NextResponse.json({
          success: true,
          data: { deleted: reportDeleted }
        });

      case 'cleanup_expired':
        const cleanedCount = reportService.cleanupExpiredReports();
        return NextResponse.json({
          success: true,
          data: {
            cleanedCount,
            message: `Cleaned up ${cleanedCount} expired reports`
          }
        });

      case 'preview_template':
        if (!templateId || !parameters) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_PREVIEW_REQUEST',
                message: 'Template ID and parameters are required'
              }
            },
            { status: 400 }
          );
        }

        // Generate preview data (without actually saving)
        const previewData = {
          timeRange: parameters.timeRange || {
            from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            to: new Date()
          },
          // Mock preview data
          summary: {
            healthScore: 92,
            totalAlerts: 5,
            activeTenants: 12,
            uptime: 99.95
          },
          metrics: {
            system: {
              cpu: { average: 45, max: 78, current: 32 },
              memory: { average: 62, max: 85, current: 58 }
            },
            application: {
              requests: { total: 52340, errors: 127, avgResponseTime: 142 }
            }
          }
        };

        const template = reportService.getTemplate(templateId);
        if (!template) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'TEMPLATE_NOT_FOUND',
                message: 'Template not found'
              }
            },
            { status: 404 }
          );
        }

        // Simple preview content generation
        let previewContent = template.template.substring(0, 1000); // First 1000 chars
        previewContent = previewContent.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, '[DATA]');

        return NextResponse.json({
          success: true,
          data: {
            templateId,
            templateName: template.name,
            previewContent,
            parameters: parameters,
            sampleData: previewData
          }
        });

      case 'schedule_report':
        if (!templateId || !body.schedule) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_SCHEDULE_REQUEST',
                message: 'Template ID and schedule configuration are required'
              }
            },
            { status: 400 }
          );
        }

        // Update template with schedule
        const scheduledTemplate = reportService.updateTemplate(templateId, {
          schedule: body.schedule
        });

        return NextResponse.json({
          success: true,
          data: {
            templateId,
            schedule: scheduledTemplate.schedule,
            message: 'Report schedule updated successfully'
          }
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Unknown action: ${action}`
            }
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Report management API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REPORT_MANAGEMENT_ERROR',
          message: error.message || 'Failed to manage reports'
        }
      },
      { status: 500 }
    );
  }
}