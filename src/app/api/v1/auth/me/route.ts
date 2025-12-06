import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, getUserPermissions } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request using JWT verification
    const auth = await authenticateRequest(request);

    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Return user data and permissions
    return NextResponse.json({
      success: true,
      data: {
        user: auth.user,
        permissions: getUserPermissions(auth.user.role),
      },
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
