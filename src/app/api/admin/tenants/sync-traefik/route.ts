/**
 * Manual Traefik Sync API
 * POST: Trigger manual sync of all tenant domains to Traefik config
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Manual Traefik sync triggered...');

    const { stdout, stderr } = await execAsync('npm run traefik:sync -- --no-confirm', {
      cwd: process.cwd(),
      timeout: 30000, // 30 seconds
    });

    console.log('✅ Traefik sync completed:', stdout);

    if (stderr && !stderr.includes('npm')) {
      console.warn('⚠️ Traefik sync warnings:', stderr);
    }

    return NextResponse.json({
      success: true,
      message: 'Traefik configuration synced successfully',
      output: stdout,
    });
  } catch (error: any) {
    console.error('❌ Traefik sync failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync Traefik configuration',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
