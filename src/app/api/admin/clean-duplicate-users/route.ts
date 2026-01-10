/**
 * API Endpoint: Clean Duplicate Users
 * POST /api/admin/clean-duplicate-users
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanDuplicateUsers } from '@/actions/clean-duplicate-users';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phone } = body;

        if (!phone) {
            return NextResponse.json(
                { error: 'Phone parameter required' },
                { status: 400 }
            );
        }

        const result = await cleanDuplicateUsers(phone);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[Clean Duplicate Users API] Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
