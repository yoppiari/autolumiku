
import { IntentClassifierService } from '../src/lib/services/whatsapp-ai/core/intent-classifier.service';
import { StaffCommandService } from '../src/lib/services/whatsapp-ai/commands/staff-command.service';
import { WhatsAppReportService } from '../src/lib/services/whatsapp-ai/operations/report.service';

async function testReportLogic() {
    console.log('--- STARTING TEST: Report Command Logic ---');

    const testPhrases = [
        "total report ada apa saja?",
        "report ada apa aja?",
        "menu report",
        "list report"
    ];

    // Mock tenant ID and phone
    const tenantId = "test-tenant-id";
    const senderPhone = "6281234567890"; // Needs to be treated as staff

    for (const phrase of testPhrases) {
        console.log(`\nTesting phrase: "${phrase}"`);

        // 1. Test Classification
        // We pass conversationIsStaff = true to simulate a logged-in staff member
        const classification = await IntentClassifierService.classify(
            phrase,
            senderPhone,
            tenantId,
            false, // hasMedia
            true   // conversationIsStaff (Force staff context)
        );

        console.log(`[Classifier] Intent: ${classification.intent}`);
        console.log(`[Classifier] Is Staff: ${classification.isStaff}`);
        console.log(`[Classifier] Confidence: ${classification.confidence}`);

        if (classification.intent === 'staff_get_report') {
            console.log('✅ Matches expected intent: staff_get_report');

            // 2. Test Command Parsing
            const parsed = await StaffCommandService.parseCommand(phrase, classification.intent);
            console.log(`[Parser] Command: ${parsed.command}`);
            console.log(`[Parser] Params:`, parsed.params);

            if (parsed.params.type === 'report_menu') {
                console.log('✅ Matches expected param type: report_menu');

                // 3. Test Service Execution (Simulated)
                console.log('[Service] Simulating report generation...');
                // We can't easily call the private getReportMenu directly without suppressing TS or making it public, 
                // but we can call getReport with 'report_menu'
                const response = await WhatsAppReportService.getReport('report_menu', tenantId);
                console.log('\n--- RESPONSE PREVIEW ---');
                console.log(response.split('\n').slice(0, 5).join('\n') + '\n...');
                console.log('------------------------');
            } else {
                console.error('❌ FAILED: Param type mismatch. Expected report_menu');
            }

        } else {
            console.error(`❌ FAILED: Intent mismatch. Expected staff_get_report, got ${classification.intent}`);
        }
    }
}

// Simple mock for prisma if needed, but the services use direct imports. 
// If the services rely on DB calls that we can't mock easily, this might fail.
// However, the specific logic we changed (Classifier regex and Command Parser regex) 
// does NOT hit the DB for these specific lines. 
// isStaffMember check in classifier might hit DB, but we bypassed it with conservationIsStaff=true.

testReportLogic().catch(console.error);
