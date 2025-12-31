/**
 * Test script for the new Sales Report PDF format
 * Run with: npx ts-node test-sales-report-pdf.ts
 */

import { SalesReportPDF } from './src/lib/reports/sales-report-pdf';
import * as fs from 'fs';
import * as path from 'path';

async function testSalesReportPDF() {
    console.log('🚀 Testing Sales Report PDF Generator...\n');

    const config = {
        tenantName: 'PRIMA MOBIL',
        date: new Date(),
        metrics: {
            totalPenjualan: 0,
            totalRevenue: 0,
            rataRataHarga: 0,
            topSalesStaff: null as string | null
        },
        chartData: [
            { label: 'A', value: 30, percentage: 30, color: '#3b82f6' },
            { label: 'B', value: 40, percentage: 40, color: '#8b5cf6' },
            { label: 'C', value: 30, percentage: 30, color: '#10b981' }
        ]
    };

    try {
        const generator = new SalesReportPDF();
        const pdfBuffer = await generator.generate(config);

        const outputPath = path.join(__dirname, 'test-sales-report-draft.pdf');
        fs.writeFileSync(outputPath, pdfBuffer);

        console.log('✅ PDF generated successfully!');
        console.log(`📄 Output: ${outputPath}`);
        console.log(`📊 Size: ${pdfBuffer.length} bytes`);
    } catch (error) {
        console.error('❌ Error generating PDF:', error);
    }
}

testSalesReportPDF();
