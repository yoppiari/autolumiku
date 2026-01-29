import { NextRequest, NextResponse } from 'next/server';

// Mock token blacklist - in production, use Redis or database
const tokenBlacklist = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header or request body
    const authHeader = request.headers.get('authorization');
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const body = await request.json().catch(() => ({}));
      token = body.token;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 400 }
      );
    }

    // Add token to blacklist (in production, set expiry)
    tokenBlacklist.add(token);

    return NextResponse.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
