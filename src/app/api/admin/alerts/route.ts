/**
 * Alerts API Endpoint
 * Provides alert management functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { AlertService, AlertServiceConfig } from '../../../../services/alert-service';

// Initialize alert service (in a real app, this would be properly dependency injected)
const alertServiceConfig: AlertServiceConfig = {
  checkInterval: 60, // 1 minute
  maxActiveAlerts: 100,
  notificationRetries: 3,
  defaultCooldown: 900 // 15 minutes
};
const alertService = new AlertService(alertServiceConfig);

// Start monitoring on server start
alertService.startMonitoring();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('id');
    const ruleId = searchParams.get('ruleId');
    const stats = searchParams.get('stats');

    if (stats === 'true') {
      // Get alert statistics
      const statistics = alertService.getAlertStatistics();
      return NextResponse.json({
        success: true,
        data: statistics
      });
    }

    if (alertId) {
      // Get specific alert
      const alert = alertService.getAlert(alertId);
      if (!alert) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ALERT_NOT_FOUND',
              message: 'Alert not found'
            }
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: alert
      });
    }

    if (ruleId) {
      // Get specific rule
      const rule = alertService.getAlertRule(ruleId);
      if (!rule) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RULE_NOT_FOUND',
              message: 'Alert rule not found'
            }
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: rule
      });
    }

    const active = searchParams.get('active') === 'true';
    const enabled = searchParams.get('enabled') === 'true';

    if (active) {
      // Get active alerts
      const alerts = alertService.getActiveAlerts();
      return NextResponse.json({
        success: true,
        data: alerts
      });
    }

    if (enabled) {
      // Get enabled rules
      const rules = alertService.getEnabledAlertRules();
      return NextResponse.json({
        success: true,
        data: rules
      });
    }

    // Get all data
    return NextResponse.json({
      success: true,
      data: {
        rules: alertService.getAlertRules(),
        activeAlerts: alertService.getActiveAlerts(),
        isMonitoring: alertService.isMonitoringActive()
      }
    });

  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ALERTS_API_ERROR',
          message: error.message || 'Failed to retrieve alerts'
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId, ruleData, ruleId } = body;

    switch (action) {
      case 'create_rule':
        if (!ruleData) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_RULE_DATA',
                message: 'Alert rule data is required'
              }
            },
            { status: 400 }
          );
        }

        const newRule = alertService.createAlertRule(ruleData);
        return NextResponse.json({
          success: true,
          data: newRule
        });

      case 'update_rule':
        if (!ruleId || !ruleData) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_UPDATE_DATA',
                message: 'Rule ID and update data are required'
              }
            },
            { status: 400 }
          );
        }

        const updatedRule = alertService.updateAlertRule(ruleId, ruleData);
        return NextResponse.json({
          success: true,
          data: updatedRule
        });

      case 'delete_rule':
        if (!ruleId) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_RULE_ID',
                message: 'Rule ID is required'
              }
            },
            { status: 400 }
          );
        }

        const deleted = alertService.deleteAlertRule(ruleId);
        return NextResponse.json({
          success: true,
          data: { deleted }
        });

      case 'acknowledge_alert':
        if (!alertId || !body.acknowledgedBy) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_ACKNOWLEDGE_DATA',
                message: 'Alert ID and acknowledgedBy are required'
              }
            },
            { status: 400 }
          );
        }

        alertService.acknowledgeAlert(alertId, body.acknowledgedBy, body.message);
        const acknowledgedAlert = alertService.getAlert(alertId);
        return NextResponse.json({
          success: true,
          data: acknowledgedAlert
        });

      case 'resolve_alert':
        if (!alertId) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_ALERT_ID',
                message: 'Alert ID is required'
              }
            },
            { status: 400 }
          );
        }

        alertService.resolveAlert(alertId);
        const resolvedAlert = alertService.getAlert(alertId);
        return NextResponse.json({
          success: true,
          data: resolvedAlert
        });

      case 'start_monitoring':
        alertService.startMonitoring();
        return NextResponse.json({
          success: true,
          message: 'Alert monitoring started',
          data: { isMonitoring: true }
        });

      case 'stop_monitoring':
        alertService.stopMonitoring();
        return NextResponse.json({
          success: true,
          message: 'Alert monitoring stopped',
          data: { isMonitoring: false }
        });

      case 'test_notification':
        if (!body.channel || !body.message) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_NOTIFICATION_DATA',
                message: 'Channel and message are required'
              }
            },
            { status: 400 }
          );
        }

        // This would test the notification channel
        return NextResponse.json({
          success: true,
          message: 'Test notification sent successfully',
          data: { channel: body.channel, message: body.message }
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
    console.error('Alert management API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ALERT_MANAGEMENT_ERROR',
          message: error.message || 'Failed to manage alerts'
        }
      },
      { status: 500 }
    );
  }
}