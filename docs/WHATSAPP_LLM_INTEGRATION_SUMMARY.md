# AutoLumiku WhatsApp LLM Integration - Executive Summary

## Overview

AutoLumiku integrates WhatsApp messaging with an LLM (Large Language Model) to provide automated customer support for a used car showroom. Messages are processed synchronously through Aimeow (WhatsApp Business API) and intelligent responses are generated using Z.AI's GLM-4.6 model.

---

## Quick Facts

- **Synchronous Processing:** No queues - messages processed in real-time
- **Response Time:** 2-6 seconds per message (1-5s from LLM API)
- **LLM Used:** Z.AI GLM-4.6 (OpenAI-compatible API)
- **Intent Classification:** Pattern-based (regex, no ML)
- **Database:** PostgreSQL with Prisma ORM
- **Multi-tenant:** Full isolation per showroom
- **Scale:** Not production-tested at high volume

---

## Key Components

### 1. Webhook Receivers
- **Primary:** `/api/v1/aimeow/webhook`
- **Legacy:** `/api/v1/webhooks/aimeow`
- Both handle: messages, status updates, QR codes, connection events

### 2. Message Orchestrator
Central coordinator that:
1. Receives message from webhook
2. Gets/creates conversation
3. Saves message to database
4. Classifies intent (spam, staff, customer)
5. Routes to appropriate handler
6. Gets response (LLM or command)
7. Sends response back via Aimeow
8. Updates conversation status

### 3. Intent Classification
Pattern-based detection:
- **SPAM:** Pulsa, voucher, hadiah, dll (ignores)
- **STAFF:** Staff command patterns, requires StaffWhatsAppAuth
- **CUSTOMER:** Vehicle inquiry, price inquiry, test drive, greeting

### 4. LLM Response Generation (Customer Inquiries)
1. Load AI config from database
2. Build dynamic system prompt with:
   - AI name and personality
   - Showroom information
   - Available vehicles (if relevant)
   - Custom FAQ (if configured)
   - Business rules
3. Get conversation history (last 10 messages)
4. Build user prompt with context
5. Call Z.AI API with glm-4.6 model
6. Check for escalation triggers
7. Return response

### 5. Staff Command Execution
Supported commands:
- `/upload` or `upload mobil` - Upload vehicle
- `/status` or `update status` - Change vehicle status
- `/inventory` or `cek stok` - Check inventory
- `/stats` or `laporan` - Get statistics

---

## LLM Integration Details

### Model Information
- **Provider:** Z.AI (Zhipu AI)
- **Text Model:** glm-4.6 (default)
- **Vision Model:** glm-4.5v (for vehicle AI identification)
- **API Style:** OpenAI-compatible (uses OpenAI SDK)
- **Base URL:** `https://api.z.ai/api/coding/paas/v4/` (or `/api/` for standard plan)

### System Prompt Template
```
Anda adalah [aiName], asisten virtual untuk [tenantName]
Personality: [aiPersonality]

Tugas Anda:
- Menjawab pertanyaan customer tentang mobil
- Memberikan info harga, spek, kondisi
- Membantu menemukan mobil cocok
- Menjadwalkan test drive
- Bersikap ramah, profesional

Informasi Showroom:
- Nama: [tenantName]
- Lokasi: [city]
- Telepon: [phone]
- WhatsApp: [whatsappNumber]

[Optional: Vehicle Inventory]
[Optional: Custom FAQ]

Aturan Penting:
1. Jangan informasi yang tidak pasti
2. Jujur jika mobil tidak ada
3. Sarankan staff untuk kompleks
4. Bahasa Indonesia sopan
5. Fokus kebutuhan, bukan hard selling
```

### API Call Parameters
```typescript
{
  model: "glm-4.6",
  temperature: 0.7,      // Configurable (0-1)
  max_tokens: 1000,      // Configurable
  messages: [
    { role: "system", content: "[system prompt]" },
    { role: "user", content: "[conversation + user message]" }
  ]
}
```

### Response Processing
- Extract `message.content` from response
- Check for escalation keywords
- Return message to customer
- Save to database with `aiResponse: true`

---

## Configuration

### Environment Variables
```bash
# Z.AI LLM
ZAI_API_KEY=sk-xxxxxxxx
ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4/
ZAI_TEXT_MODEL=glm-4.6
ZAI_VISION_MODEL=glm-4.5v
API_TIMEOUT_MS=300000

# Aimeow
AIMEOW_BASE_URL=https://meow.lumiku.com
AIMEOW_WEBHOOK_SECRET=webhook-secret
```

### Database Configuration
Per-tenant in `WhatsAppAIConfig`:
- `aiName`: AI assistant name
- `aiPersonality`: friendly|professional|casual
- `temperature`: 0.0-1.0
- `maxTokens`: Max response length
- `businessHours`: JSON with hours per day
- `timezone`: For business hours check
- `customFAQ`: Array of Q&A
- `autoReply`: Enable auto-replies
- `customerChatEnabled`: Enable customer chat
- Feature toggles: Vehicle info, price negotiation, test drive, etc.

---

## Message Flow (Simplified)

```
Customer Message
    ↓
Aimeow Webhook
    ↓
Webhook Handler
    ↓
Message Orchestrator
    ├─→ Save Message
    ├─→ Classify Intent
    │
    ├─→ SPAM → Ignore
    ├─→ STAFF → Execute Command
    └─→ CUSTOMER → 
         ├─→ Load Config
         ├─→ Build Prompt
         ├─→ Call Z.AI
         └─→ Get Response
    ↓
Send Response via Aimeow
    ↓
Save Outbound Message
    ↓
Update Conversation
    ↓
Customer Receives Message
```

---

## Database Models

### Core Models
1. **AimeowAccount**
   - One per tenant
   - Stores clientId, phoneNumber, connection status
   - Links to WhatsAppAIConfig

2. **WhatsAppConversation**
   - One per customer-account pair
   - Tracks conversation state, intent, escalation
   - Links messages

3. **WhatsAppMessage**
   - One per message (inbound/outbound)
   - Stores intent, confidence, AI response flag
   - Tracks delivery status

4. **WhatsAppAIConfig**
   - One per tenant
   - Stores all AI settings and behavior toggles

5. **StaffWhatsAppAuth**
   - One per staff member per tenant
   - Authorizes staff commands

---

## Performance Characteristics

### Processing Steps
| Step | Duration | Bottleneck |
|------|----------|-----------|
| Webhook parse | <10ms | |
| Account lookup | <50ms | DB |
| Duplicate check | <20ms | DB |
| Save message | <50ms | DB |
| Intent classification | <20ms | CPU |
| **LLM API call** | **1-5s** | **Z.AI API** |
| Send response | <100ms | Network |
| Total | **2-6 seconds** | **LLM** |

### Bottleneck
The Z.AI LLM API call is the bottleneck (1-5 seconds). Everything else is <100ms.

### Scalability Concerns
- No queue system means webhook receiver must wait for response
- Long LLM latency could timeout if webhook has short timeout
- Database queries are indexed but grow with data
- Each message loads vehicle inventory (up to 10 vehicles)

---

## Error Handling

### LLM API Fails
- Catch exception
- Return fallback message: "Maaf, terjadi gangguan sistem..."
- Mark conversation as escalated
- Log error for debugging

### Webhook Validation Fails
- Return 401/400 error
- Log security event
- Do not process message

### Message Already Processed
- Duplicate check via `aimeowMessageId`
- Return early, no processing
- Prevents double-processing

### Escalation Triggers
- Uncertainty keywords in AI response
- Price negotiation (if not enabled)
- Processing errors
- Manual escalation via UI

---

## Supported Intents

### Customer Intents
| Intent | Keywords | Handler |
|--------|----------|---------|
| greeting | halo, hai, pagi, siang | WhatsAppAIChatService |
| vehicle_inquiry | mobil, kendaraan, brand names | WhatsAppAIChatService |
| price_inquiry | harga, berapa, kredit, dp | WhatsAppAIChatService |
| test_drive | test drive, coba, showroom | WhatsAppAIChatService |
| general_question | anything else | WhatsAppAIChatService |

### Staff Intents
| Intent | Commands | Action |
|--------|----------|--------|
| upload_vehicle | /upload, upload mobil | StaffCommandService |
| update_status | /status, update status | StaffCommandService |
| check_inventory | /inventory, cek stok | StaffCommandService |
| get_stats | /stats, laporan | StaffCommandService |

### Special Cases
| Case | Keywords | Action |
|------|----------|--------|
| spam | pulsa, voucher, hadiah | Ignore (no response) |
| unknown | unmatched | Default to general question |

---

## Files to Review

### Core Services (LLM Integration)
- **`chat.service.ts`** - LLM response generation
- **`zai-client.ts`** - Z.AI API client
- **`message-orchestrator.service.ts`** - Main coordinator
- **`intent-classifier.service.ts`** - Intent detection
- **`staff-command.service.ts`** - Command execution

### Webhook Handlers
- **`/api/v1/aimeow/webhook/route.ts`** - Primary webhook
- **`/api/v1/webhooks/aimeow/route.ts`** - Legacy webhook

### API Routes (Management)
- **`/api/v1/whatsapp-ai/*`** - Configuration and status endpoints

### Database
- **`prisma/schema.prisma`** - Database models

---

## Testing the Integration

### 1. Set Up Aimeow Account
```
1. Create Aimeow account
2. Get clientId
3. Configure webhook URL: https://yourdomain.com/api/v1/aimeow/webhook
4. Scan QR code to connect WhatsApp
```

### 2. Initialize WhatsApp Connection
```
POST /api/v1/whatsapp-ai/initialize
Body: { tenantId: "..." }
Response: { clientId, qrCode }
```

### 3. Send Test Message
```
Send WhatsApp message: "Ada mobil Honda Jazz?"
Wait 2-6 seconds
Expect AI response about Honda Jazz availability
```

### 4. Verify in Database
```sql
SELECT * FROM whatsapp_conversations 
WHERE tenantId = '...' 
ORDER BY startedAt DESC;

SELECT * FROM whatsapp_messages 
WHERE conversationId = '...' 
ORDER BY createdAt DESC;
```

---

## Common Issues

| Problem | Root Cause | Solution |
|---------|-----------|----------|
| LLM returns null | Missing env vars | Set ZAI_API_KEY, ZAI_BASE_URL |
| Messages not received | Webhook URL wrong | Update in Aimeow dashboard |
| Long delay | Normal LLM latency | Expected (1-5s) |
| Staff commands fail | Phone not in auth table | Add to `StaffWhatsAppAuth` |
| Business hours ignored | Config missing | Set `businessHours` in DB |
| Escalation always | Sensitive keywords | Check `shouldEscalateToHuman()` |

---

## Future Improvements

### Short Term
1. Add queue system for better scalability
2. Implement caching for FAQ and vehicle lists
3. Add request timeout handling
4. Improve error messages

### Medium Term
1. Migrate to streaming responses (if LLM supports)
2. Add conversation sentiment analysis
3. Implement learning from escalations
4. Add performance monitoring

### Long Term
1. Fine-tune LLM for domain-specific tasks
2. Add multi-language support
3. Implement A/B testing for prompts
4. Add advanced analytics

---

## Documentation Files

1. **WHATSAPP_LLM_FLOW_ANALYSIS.md** - Detailed technical breakdown (37KB)
2. **WHATSAPP_LLM_QUICK_REFERENCE.md** - Quick lookup guide (13KB)
3. **WHATSAPP_ARCHITECTURE_DIAGRAM.md** - Visual diagrams (42KB)
4. **WHATSAPP_LLM_INTEGRATION_SUMMARY.md** - This file (Overview)

---

## Key Takeaways

1. **Synchronous Processing:** Messages processed in real-time, no background jobs
2. **LLM-Powered:** Uses Z.AI GLM-4.6 for intelligent customer responses
3. **Intent-Based Routing:** Pattern matching sends to appropriate handler
4. **Fully Configurable:** Per-tenant AI settings, business hours, FAQs
5. **Database-Driven:** All conversations and messages stored for analytics
6. **Multi-Tenant:** Complete isolation between tenants
7. **Scalable:** Can handle single tenant well, needs optimization for many tenants
8. **Production-Ready:** Error handling, escalation logic, duplicate prevention

---

## Contact & Support

For questions about the WhatsApp LLM integration, refer to:
- Code: `/src/lib/services/whatsapp-ai/`
- Config: `/src/app/api/v1/whatsapp-ai/`
- Database: `prisma/schema.prisma` (search for WhatsApp* models)
- Docs: `/docs/WHATSAPP_*`

