
// Simulate receiving a webhook and processing it through the orchestrator logic
// WITHOUT verifying DB/Network (Mocking everything)

console.log("🚀 Starting Webhook Simulation (Mocked Mode)...");

// Mock dependencies
const mockPrisma = {
    aimeowAccount: {
        findMany: async () => [{ id: 'acc_123', clientId: 'client_uuid_1', tenant: { name: 'Test Showroom' }, isConnected: true }]
    },
    user: {
        findMany: async () => [
            { firstName: 'Owner', lastName: 'User', phone: '6281234567890', role: 'OWNER' },
            { firstName: 'Admin', lastName: 'User', phone: '6281234567891', role: 'ADMIN' }
        ],
        findFirst: async () => ({ firstName: 'Sender', lastName: 'User', phone: '6281234567890', role: 'OWNER' }) // Mock finding the sender
    }
};

const mockAimeowClient = {
    sendDocumentBase64: async (clientId, to, base64Pdf, filename, message) => {
        console.log(`[MOCK AIMEOW] 📄 Sending PDF to ${to}: ${filename} (${base64Pdf.length} chars)`);
        if (to === '6281234567899') throw new Error("Simulated Send Failure"); // Fail for specific number
        return { success: true, messageId: 'msg_' + Date.now() };
    }
};

// Simulation Function
async function simulateBroadcast() {
    console.log("📝 simulating Broadcast Logic...");

    // Mock Payload
    const result = {
        success: true,
        pdfBuffer: Buffer.from("fake pdf content"),
        filename: "report.pdf",
        message: "Here is your report",
        broadcastToRoles: ['OWNER', 'ADMIN', 'SUPER_ADMIN']
    };

    const incoming = {
        from: '6281234567890',
        clientId: 'client_uuid_1',
        tenantId: 'tenant_123'
    };

    // --- REPLICATING ORCHESTRATOR LOGIC HERE ---

    // 1. Initial Send (to Requester)
    console.log(`[Orchestrator] 📤 Sending PDF via WhatsApp to ${incoming.from} (base64 mode)`);
    try {
        const sendResult = await mockAimeowClient.sendDocumentBase64(incoming.clientId, incoming.from, result.pdfBuffer.toString('base64'), result.filename, 'Caption');
        console.log(`[Orchestrator] ✅ PDF sent:`, sendResult);
    } catch (e) {
        console.error(`[Orchestrator] ❌ Initial send failed:`, e.message);
    }

    // 2. Broadcast Loop
    if (result.broadcastToRoles && result.broadcastToRoles.length > 0) {
        console.log(`[Orchestrator] 📢 Broadcasting PDF to roles: ${result.broadcastToRoles.join(', ')}`);

        // Mock finding recipients
        const recipients = await mockPrisma.user.findMany();
        // Assume filtering happens here...
        const filteredRecipients = recipients.filter(r => r.phone !== incoming.from);

        console.log(`[Orchestrator] 👥 Found ${filteredRecipients.length} broadcast recipients (after filtering sender)`);

        for (const recipient of filteredRecipients) {
            console.log(`[Orchestrator] 📤 Broadcasting to ${recipient.firstName} (${recipient.role}) at ${recipient.phone}`);
            try {
                await mockAimeowClient.sendDocumentBase64(
                    incoming.clientId,
                    recipient.phone,
                    result.pdfBuffer.toString('base64'),
                    result.filename,
                    `📢 Broadcast Report: ...`
                );
            } catch (err) {
                console.error(`[Orchestrator] ❌ Failed to broadcast to ${recipient.phone}:`, err.message);
            }
        }
    }
    // --- END LOGIC ---

    console.log("✅ Simulation Complete");
}

simulateBroadcast();
