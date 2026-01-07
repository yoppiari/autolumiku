/**
 * System Health & Self-Healing Verification Suite
 * Tests if the "AI 5.0" Central Nervous System works as expected.
 *
 * Run with: npx tsx src/lib/services/__tests__/system-health.test.ts
 */

import { SystemHealthService } from '../system-health.service';
import { prisma } from '@/lib/prisma';

async function runTests() {
    console.log('🚀 INITIALIZING AI 5.0 HEALTH DIAGNOSTIC TEST...\n');

    // Setup: Get Valid Tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.error('❌ No tenant found. Cannot run tests.');
        return;
    }
    const tenantId = tenant.id;
    console.log(`ℹ️ Testing with Tenant ID: ${tenantId}\n`);

    // ==================== TEST 1: DASHBOARD / DB HEALTH ====================
    console.log('🔹 TEST 1: Database Connectivity');
    try {
        const report = await SystemHealthService.runDiagnostic(tenantId);
        if (report.modules.dashboard.status === 'healthy') {
            console.log('✅ PASS: Database is reachable.');
        } else {
            console.error('❌ FAIL: Database reported unhealthy.', report.modules.dashboard);
        }
    } catch (e) { console.error('❌ FAIL: Check crashed', e); }


    // ==================== TEST 2: VEHICLE SELF-HEALING ====================
    console.log('\n🔹 TEST 2: Vehicle Auto-Correction (Self-Healing)');
    try {
        // 1. Create "Broken" Vehicle
        const brokenVehicle = await prisma.vehicle.create({
            data: {
                tenantId,
                make: 'TestBroken',
                model: 'Car',
                year: 2024,
                price: 0, // INVALID PRICE for AVAILABLE status
                status: 'AVAILABLE',
                displayId: `TEST-${Date.now()}`
            }
        });
        console.log(`   Created broken vehicle: ${brokenVehicle.id} (Price: 0, Status: AVAILABLE)`);

        // 2. Run Diagnostic (Should Heal)
        const report = await SystemHealthService.runDiagnostic(tenantId);

        // 3. Verify Healing
        const healedVehicle = await prisma.vehicle.findUnique({ where: { id: brokenVehicle.id } });

        if (healedVehicle?.status === 'DRAFT') {
            console.log('✅ PASS: Vehicle auto-corrected to DRAFT status.');
        } else {
            console.error(`❌ FAIL: Vehicle status is still ${healedVehicle?.status}`);
        }

        if (report.actionsTaken.some(a => a.includes('Auto-corrected'))) {
            console.log('✅ PASS: Action log recorded the heal event.');
        }

        // Cleanup
        await prisma.vehicle.delete({ where: { id: brokenVehicle.id } });

    } catch (e) { console.error('❌ FAIL: Vehicle test crashed', e); }


    // ==================== TEST 3: SETTINGS SELF-HEALING ====================
    console.log('\n🔹 TEST 3: Settings Auto-Restoration (Self-Healing)');
    try {
        // 1. Ensure a required key is missing
        const testKey = 'currency';
        await prisma.globalSetting.deleteMany({ where: { key: testKey, tenantId } });
        console.log(`   Deleted setting: ${testKey}`);

        // 2. Run Diagnostic
        const report = await SystemHealthService.runDiagnostic(tenantId);

        // 3. Verify Restoration
        const restoredSetting = await prisma.globalSetting.findFirst({ where: { key: testKey, tenantId } });

        if (restoredSetting) {
            console.log(`✅ PASS: Setting '${testKey}' was auto-restored.`);
        } else {
            console.error(`❌ FAIL: Setting '${testKey}' is still missing.`);
        }

        if (report.modules.settings.status === 'healthy') {
            console.log('✅ PASS: Settings module reports healthy after healing.');
        }

    } catch (e) { console.error('❌ FAIL: Settings test crashed', e); }


    // ==================== SUMMARY ====================
    console.log('\n\n✅ ALL TESTS COMPLETED.');
}

runTests();
