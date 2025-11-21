/**
 * Subdomain Availability Check API
 * Epic 1: Story 1.5 - Tenant Onboarding
 *
 * Endpoint:
 * - GET /api/v1/tenants/check-subdomain?subdomain=xyz - Check subdomain availability
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantService } from '@/services/tenant-service';

/**
 * GET /api/v1/tenants/check-subdomain
 * Check if a subdomain is available
 */
export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const subdomain = searchParams.get('subdomain');

    // Validate subdomain parameter
    if (!subdomain) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing subdomain parameter',
          message: 'subdomain query parameter is required',
        },
        { status: 400 }
      );
    }

    // Validate subdomain format (alphanumeric and hyphens only)
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          error: 'Invalid subdomain format',
          message: 'Subdomain can only contain lowercase letters, numbers, and hyphens',
        },
        { status: 400 }
      );
    }

    // Check minimum and maximum length
    if (subdomain.length < 3) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          error: 'Subdomain too short',
          message: 'Subdomain must be at least 3 characters long',
        },
        { status: 400 }
      );
    }

    if (subdomain.length > 63) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          error: 'Subdomain too long',
          message: 'Subdomain must be 63 characters or less',
        },
        { status: 400 }
      );
    }

    // Check if subdomain starts or ends with hyphen
    if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          error: 'Invalid subdomain format',
          message: 'Subdomain cannot start or end with a hyphen',
        },
        { status: 400 }
      );
    }

    // Reserved subdomains
    const reserved = [
      'www',
      'api',
      'admin',
      'app',
      'mail',
      'ftp',
      'localhost',
      'webmail',
      'smtp',
      'pop',
      'imap',
      'blog',
      'dev',
      'staging',
      'test',
      'demo',
      'support',
      'help',
      'docs',
      'status',
      'cdn',
      'assets',
      'static',
    ];

    if (reserved.includes(subdomain)) {
      return NextResponse.json({
        success: true,
        available: false,
        message: 'This subdomain is reserved',
      });
    }

    // Check availability in database
    const isAvailable = await tenantService.checkSubdomainAvailability(subdomain);

    return NextResponse.json({
      success: true,
      available: isAvailable,
      message: isAvailable ? 'Subdomain is available' : 'Subdomain is already taken',
    });
  } catch (error) {
    console.error('Check subdomain API error:', error);
    return NextResponse.json(
      {
        success: false,
        available: false,
        error: 'Internal server error',
        message: 'Failed to check subdomain availability',
      },
      { status: 500 }
    );
  }
};
