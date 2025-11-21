/**
 * Input Validation and Sanitization for Audit Service
 * Story 1.10: Enhanced security for audit log API endpoints
 *
 * Provides comprehensive validation and sanitization for all audit service inputs
 * to prevent injection attacks, data corruption, and invalid requests.
 */

import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

/**
 * Allowed values for specific enum fields
 */
const ALLOWED_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ALLOWED_CATEGORIES = [
  'USER_MANAGEMENT',
  'DATA_ACCESS',
  'SYSTEM_CHANGE',
  'SECURITY_EVENT',
  'COMPLIANCE',
  'AUTHENTICATION',
  'AUTHORIZATION',
];
const ALLOWED_REPORT_TYPES = [
  'PDPA_COMPLIANCE',
  'FINANCIAL_AUDIT',
  'USER_ACTIVITY',
  'SECURITY_INCIDENTS',
  'DATA_ACCESS',
  'SYSTEM_CHANGES',
];
const ALLOWED_EXPORT_FORMATS = ['CSV', 'JSON', 'PDF', 'XLSX'];

/**
 * Sanitize string input to prevent injection attacks
 * - Removes or escapes special characters
 * - Limits length
 * - Trims whitespace
 */
function sanitizeString(input: string | undefined, maxLength: number = 255): string | undefined {
  if (!input || typeof input !== 'string') {
    return undefined;
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Escape special characters for safe logging
  sanitized = validator.escape(sanitized);

  return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Validate and parse date input
 */
function validateDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr || typeof dateStr !== 'string') {
    return undefined;
  }

  const date = new Date(dateStr);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return undefined;
  }

  // Check if date is within reasonable range (not before 2000, not more than 1 year in future)
  const minDate = new Date('2000-01-01');
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  if (date < minDate || date > maxDate) {
    return undefined;
  }

  return date;
}

/**
 * Validate and sanitize integer input
 */
function validateInteger(
  value: string | undefined,
  min: number = 0,
  max: number = 10000
): number | undefined {
  if (!value || typeof value !== 'string') {
    return undefined;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed) || parsed < min || parsed > max) {
    return undefined;
  }

  return parsed;
}

/**
 * Validate UUID format
 */
function validateUUID(uuid: string | undefined): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  return validator.isUUID(uuid, 4);
}

/**
 * Validate enum value
 */
function validateEnum(value: string | undefined, allowedValues: string[]): string | undefined {
  if (!value || typeof value !== 'string') {
    return undefined;
  }

  const upperValue = value.toUpperCase();
  return allowedValues.includes(upperValue) ? upperValue : undefined;
}

/**
 * Middleware: Validate query parameters for GET /api/audit/logs
 */
export function validateAuditLogQuery(req: Request, res: Response, next: NextFunction): void {
  try {
    const errors: string[] = [];

    // Validate tenant ID (required)
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!validateUUID(tenantId)) {
      errors.push('Invalid or missing tenant ID');
    }

    // Validate and sanitize date range
    const startDate = validateDate(req.query.startDate as string);
    const endDate = validateDate(req.query.endDate as string);

    if (req.query.startDate && !startDate) {
      errors.push('Invalid start date format');
    }
    if (req.query.endDate && !endDate) {
      errors.push('Invalid end date format');
    }

    // Ensure start date is before end date
    if (startDate && endDate && startDate > endDate) {
      errors.push('Start date must be before end date');
    }

    // Validate user ID if provided
    if (req.query.userId && !validateUUID(req.query.userId as string)) {
      errors.push('Invalid user ID format');
    }

    // Sanitize string filters
    const action = sanitizeString(req.query.action as string, 100);
    const entityType = sanitizeString(req.query.entityType as string, 100);
    const searchTerm = sanitizeString(req.query.searchTerm as string, 500);

    // Validate enum fields
    const severity = validateEnum(req.query.severity as string, ALLOWED_SEVERITIES);
    const category = validateEnum(req.query.category as string, ALLOWED_CATEGORIES);

    if (req.query.severity && !severity) {
      errors.push(`Invalid severity. Allowed values: ${ALLOWED_SEVERITIES.join(', ')}`);
    }
    if (req.query.category && !category) {
      errors.push(`Invalid category. Allowed values: ${ALLOWED_CATEGORIES.join(', ')}`);
    }

    // Validate pagination parameters
    const limit = validateInteger(req.query.limit as string, 1, 1000);
    const offset = validateInteger(req.query.offset as string, 0, 1000000);

    if (req.query.limit && !limit) {
      errors.push('Invalid limit (must be 1-1000)');
    }
    if (req.query.offset && offset === undefined) {
      errors.push('Invalid offset (must be >= 0)');
    }

    // Validate tags array
    let tags: string[] | undefined;
    if (req.query.tags && typeof req.query.tags === 'string') {
      tags = (req.query.tags as string)
        .split(',')
        .map((tag) => sanitizeString(tag, 50))
        .filter((tag): tag is string => tag !== undefined)
        .slice(0, 10); // Max 10 tags

      if (tags.length === 0) {
        tags = undefined;
      }
    }

    // If validation errors, return 400
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Attach sanitized values to request for use in route handler
    req.sanitizedQuery = {
      tenantId,
      startDate,
      endDate,
      userId: req.query.userId as string,
      action,
      entityType,
      category,
      severity,
      searchTerm,
      tags,
      isCompliance: req.query.isCompliance === 'true',
      limit: limit || 50,
      offset: offset || 0,
    };

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Validation error',
      message: error.message,
    });
  }
}

/**
 * Middleware: Validate body for POST /api/audit/reports/compliance
 */
export function validateComplianceReportRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const errors: string[] = [];

    // Validate tenant ID
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!validateUUID(tenantId)) {
      errors.push('Invalid or missing tenant ID');
    }

    // Validate report type
    const reportType = validateEnum(req.body.reportType, ALLOWED_REPORT_TYPES);
    if (!reportType) {
      errors.push(`Invalid report type. Allowed values: ${ALLOWED_REPORT_TYPES.join(', ')}`);
    }

    // Validate date range
    const periodStart = validateDate(req.body.periodStart);
    const periodEnd = validateDate(req.body.periodEnd);

    if (!periodStart) {
      errors.push('Invalid or missing period start date');
    }
    if (!periodEnd) {
      errors.push('Invalid or missing period end date');
    }

    if (periodStart && periodEnd && periodStart > periodEnd) {
      errors.push('Period start must be before period end');
    }

    // Validate format
    const format = validateEnum(req.body.format || 'PDF', ALLOWED_EXPORT_FORMATS);
    if (!format) {
      errors.push(`Invalid format. Allowed values: ${ALLOWED_EXPORT_FORMATS.join(', ')}`);
    }

    // If validation errors, return 400
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Attach sanitized values
    req.sanitizedBody = {
      tenantId,
      reportType,
      periodStart,
      periodEnd,
      format,
    };

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Validation error',
      message: error.message,
    });
  }
}

/**
 * Middleware: Validate body for POST /api/audit/export
 */
export function validateExportRequest(req: Request, res: Response, next: NextFunction): void {
  try {
    const errors: string[] = [];

    // Validate tenant ID
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!validateUUID(tenantId)) {
      errors.push('Invalid or missing tenant ID');
    }

    // Validate format
    const format = validateEnum(req.body.format || 'CSV', ALLOWED_EXPORT_FORMATS);
    if (!format) {
      errors.push(`Invalid format. Allowed values: ${ALLOWED_EXPORT_FORMATS.join(', ')}`);
    }

    // Validate optional filters
    const startDate = validateDate(req.body.startDate);
    const endDate = validateDate(req.body.endDate);

    if (req.body.startDate && !startDate) {
      errors.push('Invalid start date format');
    }
    if (req.body.endDate && !endDate) {
      errors.push('Invalid end date format');
    }

    if (startDate && endDate && startDate > endDate) {
      errors.push('Start date must be before end date');
    }

    // Validate user ID if provided
    if (req.body.userId && !validateUUID(req.body.userId)) {
      errors.push('Invalid user ID format');
    }

    // Sanitize string filters
    const action = sanitizeString(req.body.action, 100);
    const entityType = sanitizeString(req.body.entityType, 100);
    const reason = sanitizeString(req.body.reason, 500);

    // Validate enum fields
    const severity = validateEnum(req.body.severity, ALLOWED_SEVERITIES);
    const category = validateEnum(req.body.category, ALLOWED_CATEGORIES);

    if (req.body.severity && !severity) {
      errors.push(`Invalid severity. Allowed values: ${ALLOWED_SEVERITIES.join(', ')}`);
    }
    if (req.body.category && !category) {
      errors.push(`Invalid category. Allowed values: ${ALLOWED_CATEGORIES.join(', ')}`);
    }

    // If validation errors, return 400
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Attach sanitized values
    req.sanitizedBody = {
      tenantId,
      format,
      startDate,
      endDate,
      userId: req.body.userId,
      action,
      entityType,
      category,
      severity,
      reason,
    };

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Validation error',
      message: error.message,
    });
  }
}

/**
 * Extend Express Request interface to include sanitized data
 */
declare global {
  namespace Express {
    interface Request {
      sanitizedQuery?: any;
      sanitizedBody?: any;
    }
  }
}
