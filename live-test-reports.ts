import { handlePDFCommand } from './src/lib/services/whatsapp-ai/command-handler.service';
import * as fs from 'fs';

async function verifyLiveReports() {
    console.log('🚀 Starting Live Post-Deployment Verification...');

    // Mock context - replace with valid tenantId and phone if needed for deeper DB check
    // In a real environment, this would use a valid user from the DB
    const context = {
        tenantId: 'clp1234567890', // Symbolic, but the service will attempt to fetch
        userPhone: '628123456789',
        userRole: 'ADMIN',
        userRoleLevel: 100
    };

    const testCommands = [
        'sales report',
        'whatsapp ai analytics',
        'low stock alert',
        'total revenue',
        'staff performance'
    ];

    for (const cmd of testCommands) {
        console.log(`\nTesting command: "${cmd}"...`);
        try {
            const result = await (handlePDFCommand as any)(cmd, context);

            if (result.success && result.pdfBuffer) {
                const filename = `live-test-${cmd.replace(/\s+/g, '-')}.pdf`;
                fs.writeFileSync(filename, result.pdfBuffer);
                console.log(`✅ SUCCESS: Generated ${filename} (${result.pdfBuffer.length} bytes)`);
            } else {
                console.warn(`⚠️ WARNING: ${cmd} result:`, result.message);
            }
        } catch (error) {
            console.error(`❌ ERROR testing "${cmd}":`, error);
        }
    }

    console.log('\n✨ Verification complete.');
}

verifyLiveReports().catch(console.error);
