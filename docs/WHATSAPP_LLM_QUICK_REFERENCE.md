# AutoLumiku WhatsApp AI - Quick Reference Guide

## System Architecture Overview

```
WHATSAPP MESSAGE
       │
       ├──> Aimeow API (WhatsApp Business)
       │
       ├──> Webhook Receiver
       │    ├─ /api/v1/aimeow/webhook
       │    └─ /api/v1/webhooks/aimeow
       │
       ├──> Message Orchestrator
       │    ├─ Get/Create Conversation
       │    ├─ Save Message
       │    ├─ Classify Intent
       │    │
       │    ├──> SPAM → Ignore
       │    │
       │    ├──> STAFF COMMAND → StaffCommandService
       │    │    └─ Parse & Execute
       │    │
       │    └──> CUSTOMER INQUIRY → WhatsAppAIChatService
       │         ├─ Load Conversation History
       │         ├─ Build System Prompt
       │         ├─ Call Z.AI LLM (glm-4.6)
       │         └─ Return AI Response
       │
       ├──> Response Handler
       │    ├─ Send via Aimeow API
       │    ├─ Save Outbound Message
       │    └─ Update Conversation Status
       │
       └──> WhatsApp Customer
            └─ Message Displayed
```

---

## File Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── zai-client.ts                    # Z.AI LLM Client
│   │   └── blog-ai-service.ts
│   │
│   └── services/
│       ├── aimeow/
│       │   └── aimeow-client.service.ts     # Aimeow API Integration
│       │
│       └── whatsapp-ai/
│           ├── message-orchestrator.service.ts  # Main Coordinator
│           ├── chat.service.ts                  # LLM Response Gen
│           ├── intent-classifier.service.ts    # Intent Classification
│           └── staff-command.service.ts        # Staff Command Execution
│
└── app/api/
    ├── v1/
    │   ├── aimeow/webhook/route.ts         # Primary Webhook
    │   │
    │   └── whatsapp-ai/
    │       ├── conversations/route.ts
    │       ├── conversations/[id]/messages/route.ts
    │       ├── config/route.ts
    │       ├── initialize/route.ts
    │       ├── status/route.ts
    │       ├── stats/route.ts
    │       ├── staff/route.ts
    │       └── disconnect/route.ts
    │
    └── webhooks/
        └── aimeow/route.ts                 # Legacy Webhook

```

---

## Message Flow Step-by-Step

### 1. Message Arrives (< 50ms)
```
Customer sends WhatsApp message
    ↓
Aimeow receives and sends webhook
    ↓
POST /api/v1/aimeow/webhook
Body: {
  clientId: "abc123",
  event: "message",
  data: {
    from: "6281234567890",
    message: "Ada mobil Honda Jazz?",
    messageId: "msg_xyz"
  }
}
```

### 2. Account Lookup (< 50ms)
```
Select * from AimeowAccount where clientId = "abc123"
    ↓
Found: {
  id: "acc_123",
  tenantId: "tenant_456",
  phoneNumber: "+6282288888888"
}
    ↓
Check for existing message (prevent duplicates)
    ↓
Found: None (process new message)
```

### 3. Create Conversation (< 50ms)
```
Select * from WhatsAppConversation 
where accountId = "acc_123" 
  and customerPhone = "6281234567890" 
  and status = "active"
    ↓
Not found → Create new conversation:
{
  id: "conv_789",
  accountId: "acc_123",
  tenantId: "tenant_456",
  customerPhone: "6281234567890",
  status: "active"
}
```

### 4. Save Incoming Message (< 50ms)
```
Insert into WhatsAppMessage {
  conversationId: "conv_789",
  direction: "inbound",
  sender: "6281234567890",
  content: "Ada mobil Honda Jazz?",
  aimeowMessageId: "msg_xyz"
}
```

### 5. Classify Intent (< 20ms)
```
Message: "Ada mobil Honda Jazz?"
    ↓
Check if SPAM? No
Check if STAFF? (query StaffWhatsAppAuth) No
Check CUSTOMER patterns:
    ✓ Vehicle inquiry (matches brand "Honda" + vehicle keyword)
    ✓ Intent: "customer_vehicle_inquiry"
    ✓ Confidence: 0.85
```

### 6. Route Decision (< 10ms)
```
if intent === "spam" → Ignore
if isStaff → StaffCommandService
else → WhatsAppAIChatService.generateResponse()
    ↓
Route to: WhatsAppAIChatService
```

### 7. Get Conversation History (< 100ms)
```
Select * from WhatsAppMessage 
where conversationId = "conv_789"
order by createdAt desc
limit 10
    ↓
Result: [
  { direction: "inbound", content: "Ada mobil Honda Jazz?" }
  // (other messages if any)
]
```

### 8. Build System Prompt (< 100ms)
```
Load WhatsAppAIConfig for tenant
    ↓
Build prompt:
"Anda adalah [aiName], asisten virtual untuk [tenantName]...
Personality: friendly
Informasi Showroom:
- Nama: Autolumiku Showroom
- Kota: Jakarta
- Telepon: 021-xxxx-xxxx

Available Vehicles (10 units):
- Honda Jazz 2022 (Manual) - Rp 185.000.000 - Merah
- Toyota Avanza 2020 (Manual) - Rp 150.000.000 - Putih
..."
```

### 9. Build User Prompt (< 10ms)
```
Conversation History:
Customer: "Ada mobil Honda Jazz?"

Berikan respons yang membantu dan relevan:
```

### 10. Call Z.AI LLM API (1-5 seconds) ⭐ LONGEST STEP
```
POST https://api.z.ai/api/coding/paas/v4/chat/completions
Headers: {
  Authorization: "Bearer [ZAI_API_KEY]",
  Content-Type: "application/json"
}
Body: {
  model: "glm-4.6",
  messages: [
    { role: "system", content: "[system prompt]" },
    { role: "user", content: "[user prompt]" }
  ],
  temperature: 0.7,
  max_tokens: 1000
}
    ↓
Response: {
  content: "Halo! Ya, kami memiliki Honda Jazz 2022 yang tersedia...",
  finish_reason: "stop"
}
```

### 11. Check Escalation (< 10ms)
```
AI Response: "Halo! Ya, kami memiliki Honda Jazz 2022..."
    ↓
Check uncertainty keywords:
  - "tidak yakin" → No
  - "hubungi staff" → No
  - "tidak dapat membantu" → No
    ↓
escalated: false
```

### 12. Send via Aimeow (< 100ms)
```
POST https://meow.lumiku.com/api/v1/clients/[clientId]/send-message
Body: {
  phone: "6281234567890",
  message: "Halo! Ya, kami memiliki Honda Jazz 2022..."
}
    ↓
Response: {
  messageId: "aimeow_msg_123"
}
```

### 13. Save Outbound Message (< 50ms)
```
Insert into WhatsAppMessage {
  conversationId: "conv_789",
  direction: "outbound",
  sender: "ai",
  senderType: "ai",
  content: "Halo! Ya, kami memiliki Honda Jazz 2022...",
  aiResponse: true,
  aimeowMessageId: "aimeow_msg_123",
  aimeowStatus: "sent"
}
```

### 14. Update Conversation (< 50ms)
```
Update WhatsAppConversation
set lastMessageAt = NOW(),
    lastIntent = "customer_vehicle_inquiry"
where id = "conv_789"
```

### 15. Return Response (< 10ms)
```
Return to webhook handler:
{
  success: true,
  conversationId: "conv_789",
  intent: "customer_vehicle_inquiry",
  responseMessage: "Halo! Ya, kami memiliki Honda Jazz 2022...",
  escalated: false
}
```

---

## Intent Classification Types

```
CUSTOMER INTENTS:
├─ customer_greeting        → "Halo", "Hai", "Pagi", etc.
├─ customer_vehicle_inquiry → Mobil, brand names, "ada", "jual"
├─ customer_price_inquiry   → "Harga", "berapa", "kredit", "dp"
├─ customer_test_drive      → "Test drive", "tes coba", "lihat showroom"
└─ customer_general_question → Any other question

STAFF COMMANDS:
├─ staff_upload_vehicle    → "/upload", "upload mobil", "tambah mobil"
├─ staff_update_status     → "/status", "update status", "ubah status"
├─ staff_check_inventory   → "/inventory", "cek stok", "lihat inventory"
└─ staff_get_stats         → "/stats", "laporan", "statistik"

SPECIAL CASES:
├─ spam                    → Pulsa, voucher, hadiah, dll
└─ unknown                 → Could not classify
```

---

## Key Environment Variables

```bash
# REQUIRED: Z.AI LLM Configuration
ZAI_API_KEY=sk-xxxxxxxx
ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4/
ZAI_TEXT_MODEL=glm-4.6
ZAI_VISION_MODEL=glm-4.5v
API_TIMEOUT_MS=300000  # 5 minutes

# REQUIRED: Aimeow Configuration  
AIMEOW_BASE_URL=https://meow.lumiku.com
AIMEOW_WEBHOOK_SECRET=your-webhook-secret

# OPTIONAL: Webhook Verification
AIMEOW_WEBHOOK_USER_AGENT=Go-http-client
AIMEOW_WEBHOOK_VERIFY_TOKEN=autolumiku_webhook_2024

# DATABASE
DATABASE_URL=postgresql://user:pass@host:5432/autolumiku
```

---

## Database Tables Used

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `AimeowAccount` | WhatsApp connection per tenant | clientId, tenantId, phoneNumber |
| `WhatsAppConversation` | Conversation thread per customer | conversationId, accountId, customerPhone |
| `WhatsAppMessage` | Individual messages | messageId, conversationId, direction, intent |
| `WhatsAppAIConfig` | AI settings per tenant | tenantId, temperature, maxTokens, businessHours |
| `Tenant` | Showroom information | tenantId, name, city, phoneNumber |
| `StaffWhatsAppAuth` | Staff members | phoneNumber, tenantId, isActive |

---

## Error Handling

```
If message processing fails:
├─ Log error with context
├─ Return escalated: true
├─ Send fallback message:
│  "Maaf, terjadi gangguan sistem. Staff kami akan segera membantu Anda."
└─ Update conversation.status = "escalated"

If LLM API fails:
├─ Catch error
├─ Return escalated: true
├─ Same fallback message above

If Aimeow send fails:
├─ Log error
├─ Message marked as "failed"
├─ Message still saved in DB
├─ Can be retried later
```

---

## Performance Metrics

| Step | Duration | Bottleneck |
|------|----------|-----------|
| Webhook reception | <10ms | Network |
| Account lookup | <50ms | DB query |
| Message save | <50ms | DB write |
| Intent classification | <20ms | Pattern matching |
| Conversation ops | <100ms | DB queries |
| System prompt build | <100ms | DB query (vehicles) |
| **LLM API call** | **1-5s** | **Z.AI API** |
| Response send | <100ms | Network |
| Message save | <50ms | DB write |
| **Total** | **~2-6 seconds** | **LLM latency** |

---

## Webhook Events Handled

```
Event: "message"
├─ Direction: Inbound
├─ Action: Full processing pipeline
└─ Result: Response sent back

Event: "status"
├─ Direction: Status update
├─ Action: Update aimeowStatus (sent/delivered/read)
└─ Result: Message updated in DB

Event: "qr"
├─ Direction: QR code update
├─ Action: Save QR code for scanning
└─ Result: UI can display QR

Event: "connected"
├─ Direction: Connection established
├─ Action: Update connection status
└─ Result: System ready to receive/send

Event: "disconnected"
├─ Direction: Connection lost
├─ Action: Update connection status
└─ Result: Messages queued until reconnect
```

---

## Testing Integration

To test the system:

### 1. Set up Aimeow webhook
```
1. Create account on Aimeow
2. Get clientId from API
3. Configure webhook URL: https://yourdomain.com/api/v1/aimeow/webhook
4. Scan QR code to connect WhatsApp
```

### 2. Initialize from UI
```
POST /api/v1/whatsapp-ai/initialize
Body: { tenantId: "..." }
Response: { clientId, qrCode }
```

### 3. Send test message via WhatsApp
```
Message: "Ada mobil Honda Jazz?"
Wait: 2-6 seconds
Response: AI-generated answer about Honda Jazz
```

### 4. Check database
```
SELECT * FROM whatsapp_conversations WHERE tenantId = '...';
SELECT * FROM whatsapp_messages WHERE conversationId = '...';
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| LLM returns `null` | ZAI_API_KEY/BASE_URL not configured | Set env variables, rebuild |
| Messages not received | Webhook URL not configured in Aimeow | Update webhook URL in Aimeow dashboard |
| Long response time | Z.AI API slow | Normal (1-5s). Check API status |
| Duplicate messages | Message processed twice | Duplicate check via `aimeowMessageId` prevents this |
| Staff commands don't work | Phone not in `StaffWhatsAppAuth` | Add phone to staff table and set `isActive=true` |
| AI escalates too much | Uncertainty keywords in prompt | Adjust `shouldEscalateToHuman()` logic |
| Business hours not working | Timezone misconfigured | Set `timezone` in `WhatsAppAIConfig` |

---

## LLM Configuration (Per Tenant)

Admin can configure in UI:
- `aiName`: "Nama Asisten" (default: "AI Assistant")
- `aiPersonality`: friendly|professional|casual
- `temperature`: 0.0-1.0 (default: 0.7) - Higher = more creative
- `maxTokens`: Max response length (default: 1000)
- `businessHours`: JSON object with hours
- `customFAQ`: Array of Q&A for knowledge base
- `autoReply`: Enable/disable auto-replies
- `customerChatEnabled`: Enable/disable customer chat
- Feature toggles: `enableVehicleInfo`, `enablePriceNegotiation`, etc.

---

## Monitoring & Logging

Key logs to monitor:
```
[Aimeow Webhook] Received event: message
[Orchestrator] === Processing incoming message ===
[Orchestrator] Classifying intent: customer_vehicle_inquiry
[WhatsApp AI Chat] Generating response
[Orchestrator] Sending response via clientId: abc123
[Orchestrator] Message processed successfully
```

Check:
- Message processing times (should be 1-6s)
- Error rates in logs
- Conversation metrics in `/api/v1/whatsapp-ai/stats`
- Escalation rates

---

## Summary

- **Synchronous** processing (no queues)
- **Real-time** response (1-6 seconds)
- **LLM-powered** customer responses using Z.AI GLM-4.6
- **Pattern-based** intent classification
- **Staff command** support for vehicles & status
- **Conversation history** context (last 10 messages)
- **Escalation** to humans when AI can't handle
- **Multi-tenant** with per-tenant AI config
- **Database-driven** all messages and conversations stored

