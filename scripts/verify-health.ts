import { SystemHealthService } from '../src/lib/services/system-health.service';

async function main() {
    console.log('🏥 Starting System-Wide Health Check...');
    console.log('----------------------------------------');

    try {
        const report = await SystemHealthService.checkIntegrity();

        console.log(JSON.stringify(report, null, 2));

        if (
            report.database.status === 'healthy' &&
            report.vehicles.status !== 'error' &&
            report.leads.status !== 'error' &&
            report.whatsapp.status !== 'error' &&
            report.settings.status === 'healthy'
        ) {
            console.log('----------------------------------------');
            console.log('✅ SYSTEM STATUS: HEALTHY');
            process.exit(0);
        } else {
            console.log('----------------------------------------');
            console.log('⚠️ SYSTEM STATUS: ISSUES DETECTED');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ SYSTEM CHECK COMPROMISED:', error);
        process.exit(1);
    }
}

main();
