/**
 * Lightweight Test: Report Intent Classification
 * Tests only the regex pattern matching without DB dependencies
 */

// Copy the exact pattern from intent-classifier.service.ts
const STAFF_COMMAND_PATTERNS = {
    get_report: [
        /(?:sales|penjualan)\s*report/i,
        /total\s*(?:sales|penjualan)/i,
        /total\s*(?:revenue|pendapatan)/i,
        /(?:tren|tren\s*penjualan|sales\s*trend)/i,
        /(?:metrik\s*penjualan|sales\s*metric|kpi)/i,
        /(?:sales\s*summary|ringkasan)/i,
        /total\s*(?:inventory|stok|stock)/i,
        /(?:vehicle\s*listing|daftar\s*kendaraan)/i,
        /(?:low\s*stock|stok\s*tipis|peringatan\s*stok)/i,
        /(?:average\s*price|rata\s*rata\s*harga)/i,
        /(?:staff\s*performance|performa\s*sales)/i,
        /(?:recent\s*sales|penjualan\s*terkini)/i,
        /(?:whatsapp\s*ai|performa\s*bot)/i,
        /(?:customer\s*metric|analisis\s*pelanggan)/i,
        /(?:operasional\s*metric|efisiensi\s*chat)/i,
        // Report Menu / List
        /(?:report\s*ada\s*apa(?:\s*saja)?)/i,
        /(?:list|daftar|menu)\s*report/i,
        /(?:pilihan|opsi)\s*report/i,
    ],
};

// Copy the reportMap from staff-command.service.ts
const reportMap: Record<string, string> = {
    'sales report': 'sales_report',
    'total sales': 'total_sales',
    'total revenue': 'total_revenue',
    'staff performance': 'staff_performance',
    'menu report': 'report_menu',
    'report ada apa': 'report_menu',
    'list report': 'report_menu',
    'daftar report': 'report_menu',
};

function testIntentClassification() {
    console.log('=== TESTING REPORT INTENT CLASSIFICATION ===\n');

    const testPhrases = [
        "total report ada apa saja?",
        "report ada apa aja",
        "menu report",
        "list report",
        "menu admin",
        "sales report",
        "staff performance",
    ];

    for (const phrase of testPhrases) {
        const matches = STAFF_COMMAND_PATTERNS.get_report.some(p => p.test(phrase));

        console.log(`Testing: "${phrase}"`);
        console.log(`  ├─ Pattern Match: ${matches ? '✅ YES' : '❌ NO'}`);

        if (matches) {
            // Test reportMap matching
            let reportType = null;
            for (const [key, value] of Object.entries(reportMap)) {
                if (phrase.toLowerCase().includes(key)) {
                    reportType = value;
                    break;
                }
            }

            console.log(`  └─ Report Type: ${reportType || '⚠️ No mapping found'}`);

            if (reportType === 'report_menu' && phrase.toLowerCase().includes('report ada apa')) {
                console.log('     🎯 CORRECT: Maps to report_menu!\n');
            } else if (reportType) {
                console.log(`     ✓ Maps to: ${reportType}\n`);
            } else {
                console.log('     ⚠️ WARNING: Pattern matched but no report type mapping\n');
            }
        } else {
            console.log(`  └─ ❌ FAILED: Should match staff_get_report pattern\n`);
        }
    }
}

testIntentClassification();
