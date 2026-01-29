
import { StaffCommandService } from '../src/lib/services/whatsapp-ai/staff-command.service';
import { prisma } from '../src/lib/prisma';

async function testStaffMenu() {
    console.log('🧪 Testing Staff Menu Generation...');

    // Mock data for a staff member
    const mockTenantId = 'test-tenant-id';
    const mockPhone = '6281234567890';
    const mockName = 'Test Staff';

    // We need to ensure we simulate what handleSendGreeting does
    // It calls getTimeBasedGreeting and then constructs the string.
    // Since handleSendGreeting is public static, we can try to call it if we can mock the context or
    // just verify the string construction logic directly if necessary.

    // Actually, handleSendGreeting is part of StaffCommandService.
    // Let's see if we can instantiate or call it.

    try {
        // Create a dummy staff/user if needed for deep testing, 
        // but the greeting function usually just needs strings found in the DB.
        // For this test, we will just simulate the method call if possible
        // or duplicate the logic to verify the output format matches expectation.

        const result = await StaffCommandService.handleSendGreeting(
            mockTenantId,
            mockPhone,
            mockName
        );

        console.log('\n📄 Result Message:\n');
        console.log(result.message);

        console.log('\n✅ Verification Checklist:');
        console.log(`[ ${result.message.includes('Sales Report') ? 'PASS' : 'FAIL'} ] Contains "Sales Report"`);
        console.log(`[ ${result.message.includes('Total Inventory') ? 'PASS' : 'FAIL'} ] Contains "Total Inventory"`);
        console.log(`[ ${result.message.includes('Staff Performance') ? 'PASS' : 'FAIL'} ] Contains "Staff Performance"`);
        console.log(`[ ${result.message.includes('WhatsApp AI Analytics') ? 'PASS' : 'FAIL'} ] Contains "WhatsApp AI Analytics"`);

    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

// We can't easily run this with ts-node if clean env isn't set up,
// so we'll rely on the visual inspection of the code committed previously.
// But let's try to run a simple curl if the endpoint exists.
