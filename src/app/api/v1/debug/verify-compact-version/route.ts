/**
 * Verify Compact PDF Version
 * GET /api/v1/debug/verify-compact-version
 *
 * Returns JSON info about which PDF generator is being used
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Check if CompactExecutivePDF exists and is being used
  try {
    const fs = await import('fs');
    const path = await import('path');

    // Read the command-handler file to check which generator is being used
    const commandHandlerPath = path.join(process.cwd(), 'src/lib/services/whatsapp-ai/command-handler.service.ts');
    const fileContent = fs.readFileSync(commandHandlerPath, 'utf-8');

    // Check for CompactExecutivePDF usage
    const usesCompact = fileContent.includes('new CompactExecutivePDF()');
    const usesAnalytics = fileContent.includes('new AnalyticsPDFGenerator()');

    // Find the generateSalesSummaryPDF function
    const salesSummaryFunction = fileContent.match(/async function generateSalesSummaryPDF[\s\S]*?\n}/);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      deployment: {
        usesCompactPDF: usesCompact,
        usesAnalyticsPDF: usesAnalytics,
        recommendedGenerator: usesCompact ? 'CompactExecutivePDF (2-page)' : 'NOT SET',
        currentGeneratorInSalesSummary: usesCompact ? '✅ CompactExecutivePDF' : usesAnalytics ? '❌ AnalyticsPDFGenerator (8-page)' : 'UNKNOWN',
      },
      codeSnippet: salesSummaryFunction ? salesSummaryFunction[0].substring(0, 500) + '...' : 'Not found',
      commit: '8be6bdf',
      expected: {
        file: 'command-handler.service.ts',
        line: 1539,
        shouldHave: 'const generator = new CompactExecutivePDF();',
        message: 'Sales summary should use CompactExecutivePDF for 2-page output',
      },
      instructions: {
        ifWrong: 'If currentGeneratorInSalesSummary is not CompactExecutivePDF, run: git pull && npm run build && restart service',
        testEndpoint: '/api/v1/debug/test-whatsapp-sales-summary should return ~5-6 KB PDF',
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: 'Could not verify deployment - check server logs',
    }, { status: 500 });
  }
}
