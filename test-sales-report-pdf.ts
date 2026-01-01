/**
 * Test script for the revised Sales Report PDF format
 * Run with: npx tsx test-sales-report-pdf.ts
 */

import { SalesReportPDF } from './src/lib/reports/sales-report-pdf';
import * as fs from 'fs';
import * as path from 'path';

async function testSalesReportPDF() {
    console.log('🚀 Testing Revised Sales Report PDF Generator...\n');

    // Test dengan data simulasi seperti dari database
    const config = {
        tenantName: 'PRIMA MOBIL',
        date: new Date(),
        metrics: {
            totalPenjualan: 8,
            totalRevenue: 1250000000, // 1.25 Miliar
            rataRataHarga: 156250000, // 156.25 Juta
            topSalesStaff: 'Budi Santoso'
        },
        chartData: [
            { label: 'Toyota', value: 3, percentage: 37.5, color: '#3b82f6' },
            { label: 'Honda', value: 2, percentage: 25, color: '#8b5cf6' },
            { label: 'Suzuki', value: 2, percentage: 25, color: '#10b981' },
            { label: 'Daihatsu', value: 1, percentage: 12.5, color: '#f59e0b' }
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
        console.log('\n📋 Data yang digunakan:');
        console.log(`   - Total Penjualan: ${config.metrics.totalPenjualan} unit`);
        console.log(`   - Total Revenue: Rp ${(config.metrics.totalRevenue / 1000000000).toFixed(2)} Miliar`);
        console.log(`   - Rata-rata Harga: Rp ${(config.metrics.rataRataHarga / 1000000).toFixed(0)} Juta`);
        console.log(`   - Top Sales: ${config.metrics.topSalesStaff}`);
        console.log(`   - Chart: ${config.chartData.length} segments (${config.chartData.map(d => d.label).join(', ')})`);
    } catch (error) {
        console.error('❌ Error generating PDF:', error);
    }
}

// Test dengan data kosong juga
async function testEmptyData() {
    console.log('\n🧪 Testing with empty data...\n');

    const config = {
        tenantName: 'PRIMA MOBIL',
        date: new Date(),
        metrics: {
            totalPenjualan: 0,
            totalRevenue: 0,
            rataRataHarga: 0,
            topSalesStaff: null as string | null
        },
        chartData: []
    };

    try {
        const generator = new SalesReportPDF();
        const pdfBuffer = await generator.generate(config);

        const outputPath = path.join(__dirname, 'test-sales-report-empty.pdf');
        fs.writeFileSync(outputPath, pdfBuffer);

        console.log('✅ Empty data PDF generated!');
        console.log(`📄 Output: ${outputPath}`);
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testSalesReportPDF().then(() => testEmptyData());
