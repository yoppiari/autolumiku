/**
 * Test Analytics Export Endpoint
 * GET /api/v1/debug/test-analytics-export
 *
 * Debug endpoint to test analytics export without authentication
 * Shows detailed error information
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    steps: [],
    success: false,
  };

  try {
    results.steps.push({ step: '1. Database Connection', status: 'running' });
    await prisma.$connect();
    results.steps[0].status = 'ok';

    // Test tenant query
    results.steps.push({ step: '2. Test Tenant Query', status: 'running' });
    const tenant = await prisma.tenant.findFirst({
      select: { id: true, name: true },
    });
    results.steps[1].status = 'ok';
    results.steps[1].data = { tenantId: tenant?.id, tenantName: tenant?.name };

    if (!tenant) {
      throw new Error('No tenant found in database');
    }

    // Test vehicle query
    results.steps.push({ step: '3. Test Vehicle Query', status: 'running' });
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId: tenant.id, status: 'SOLD' },
      take: 5,
      select: { make: true, model: true, price: true },
    });
    results.steps[2].status = 'ok';
    results.steps[2].data = { count: vehicles.length };

    // Test WhatsApp conversation query
    results.steps.push({ step: '4. Test WhatsApp Conversation Query', status: 'running' });
    try {
      const conversations = await prisma.whatsAppConversation.findMany({
        where: { tenantId: tenant.id },
        take: 5,
        include: { messages: true },
      });
      results.steps[3].status = 'ok';
      results.steps[3].data = { count: conversations.length };
    } catch (err: any) {
      results.steps[3].status = 'warning';
      results.steps[3].error = err.message;
    }

    // Test PDF document creation
    results.steps.push({ step: '5. Test PDF Document Creation', status: 'running' });
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      results.steps.push({ step: '6. PDF Generated', status: 'ok', size: chunks.length });
    });
    doc.on('error', (err: any) => {
      results.steps.push({ step: '6. PDF Generation', status: 'error', error: err.message });
    });

    doc.fontSize(20).text('Test PDF Document');
    doc.end();

    // Wait for PDF to complete
    await new Promise<void>((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });

    results.steps[4].status = 'ok';
    results.steps[4].data = { pdfSize: chunks.length };

    // Test Excel creation
    results.steps.push({ step: '7. Test Excel Creation', status: 'running' });
    const XLSX = require('xlsx');
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Test', 'Data'],
      ['Row 1', 'Value 1'],
      ['Row 2', 'Value 2'],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Test');
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    results.steps[5].status = 'ok';
    results.steps[5].data = { excelSize: excelBuffer.length };

    results.success = true;
    results.message = 'All tests passed! Analytics export should work.';

  } catch (error: any) {
    results.steps.push({
      step: 'ERROR',
      status: 'failed',
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 10).join('\n'),
    });
    results.success = false;
    results.message = 'Analytics export test failed: ' + error.message;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (err) {
      // Ignore disconnect errors
    }
  }

  return NextResponse.json(results);
}
