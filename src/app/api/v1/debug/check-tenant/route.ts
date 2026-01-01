import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get('slug') || 'prima-mobil';

    const tenant = await prisma.tenant.findFirst({
        where: {
            OR: [
                { slug: slug },
                { slug: slug + '-id' },
                { domain: slug + '.id' }
            ]
        }
    });

    return NextResponse.json({ tenant });
}
