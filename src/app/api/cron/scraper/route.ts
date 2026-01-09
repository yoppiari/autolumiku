import { NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/scraper-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max duration

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        const source = searchParams.get('source') || 'ALL';

        // Verify secret key to prevent unauthorized access
        const CRON_SECRET = process.env.CRON_SECRET || 'autolumiku_scraper_secret_Key_2026';
        if (key !== CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[Cron] Starting scheduled scraper for ${source}...`);

        // Start job
        // executedBy = 'system-cron'
        const job = await scraperService.startJob({
            source: source as any,
            targetCount: 50, // Default batch size
            executedBy: 'system-cron',
        });

        return NextResponse.json({
            success: true,
            message: 'Scraper job started',
            jobId: job.id
        });

    } catch (error) {
        console.error('[Cron] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
