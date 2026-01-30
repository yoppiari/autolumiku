# AutoLumiku WhatsApp LLM Integration Documentation

This directory contains comprehensive documentation about how WhatsApp messages are received, processed, and responded to using LLM (Large Language Model) technology.

## Documentation Files

### 1. WHATSAPP_LLM_INTEGRATION_SUMMARY.md (11KB)
**Start here** - Executive summary covering:
- Quick facts and key statistics
- Core components overview
- LLM integration details
- Configuration requirements
- Performance metrics
- Common issues and solutions
- Testing guide

**Best for:** Getting a high-level understanding quickly (5-10 min read)

### 2. WHATSAPP_LLM_QUICK_REFERENCE.md (13KB)
**Reference guide** containing:
- System architecture diagram
- File structure map
- Step-by-step message flow (15 detailed steps)
- Intent classification types
- Environment variables
- Database table schema
- Performance metrics
- Webhook events
- Testing checklist
- Common issues table

**Best for:** Quick lookups while coding (5 min read, 30 min reference)

### 3. WHATSAPP_LLM_FLOW_ANALYSIS.md (37KB)
**Deep technical dive** including:
- Executive summary
- Webhook reception details (2 endpoints)
- Message processing pipeline
- Message Orchestrator Service breakdown
- LLM invocation step-by-step (16 detailed steps)
- System prompt construction
- Z.AI Client implementation
- Conversation history loading
- Escalation decision logic
- Staff command handling
- Response sending process
- Environment variables explained
- AI configuration schema
- Complete database models
- End-to-end flow diagram
- API endpoints list

**Best for:** Understanding every detail of the system (30-45 min read)

### 4. WHATSAPP_ARCHITECTURE_DIAGRAM.md (42KB)
**Visual diagrams and flows** showing:
- System components overview
- Message processing flow (detailed step-by-step)
- Data flow diagram
- Intent classification decision tree
- LLM prompt construction flow
- Escalation logic tree
- Database schema relationships
- Deployment architecture
- Environment variables dependency map

**Best for:** Understanding system architecture and relationships (20 min read)

---

## Quick Start Path

### For Managers/Product Owners:
1. Read: WHATSAPP_LLM_INTEGRATION_SUMMARY.md (5 min)
2. Review: Quick Facts and Key Components sections
3. Check: Performance Characteristics

### For Developers Integrating with WhatsApp:
1. Read: WHATSAPP_LLM_INTEGRATION_SUMMARY.md (5 min)
2. Reference: WHATSAPP_LLM_QUICK_REFERENCE.md (configuration section)
3. Code: Implementation files in `/src/lib/services/whatsapp-ai/`

### For Backend Developers:
1. Read: WHATSAPP_LLM_INTEGRATION_SUMMARY.md (5 min)
2. Study: WHATSAPP_LLM_QUICK_REFERENCE.md (message flow steps 1-15)
3. Deep dive: WHATSAPP_LLM_FLOW_ANALYSIS.md (sections 1-5)
4. Reference: WHATSAPP_ARCHITECTURE_DIAGRAM.md for data relationships

### For LLM/AI Specialists:
1. Read: WHATSAPP_LLM_INTEGRATION_SUMMARY.md - LLM Integration Details
2. Study: WHATSAPP_LLM_FLOW_ANALYSIS.md - Sections 4 (LLM Invocation)
3. Reference: System prompt template in QUICK_REFERENCE.md
4. Review: Z.AI client implementation in FLOW_ANALYSIS.md - Section 4.5

### For DevOps/Infrastructure:
1. Read: WHATSAPP_LLM_INTEGRATION_SUMMARY.md - Configuration section
2. Study: WHATSAPP_ARCHITECTURE_DIAGRAM.md - Deployment Architecture
3. Reference: Environment variables in both files
4. Check: Database requirements (PostgreSQL)

---

## Key Concepts at a Glance

### Message Flow (100-second version)
Customer sends WhatsApp → Aimeow receives → webhook → validate → classify intent → if customer: build prompt + call LLM → send response → save to DB → customer receives (2-6 seconds total)

### LLM Integration (30-second version)
Per-tenant AI config → dynamic system prompt (with showroom info + vehicle list + FAQ) → conversation history (last 10 messages) → Z.AI GLM-4.6 API call → escalation check → return response

### Intent Types
- **SPAM** (ignore) - Pulsa, voucher, hadiah
- **STAFF** (command) - /upload, /status, /inventory, /stats
- **CUSTOMER** (LLM) - Greeting, vehicle inquiry, price inquiry, test drive

### Core Tables
- `AimeowAccount` - WhatsApp connection per tenant
- `WhatsAppConversation` - Conversation thread per customer
- `WhatsAppMessage` - Individual messages with intent/confidence
- `WhatsAppAIConfig` - AI settings per tenant
- `StaffWhatsAppAuth` - Staff authorization

---

## Implementation Files

### Core Services (LLM)
```
/src/lib/services/whatsapp-ai/
├── message-orchestrator.service.ts     # Main coordinator
├── chat.service.ts                     # LLM response generation
├── intent-classifier.service.ts        # Intent detection
└── staff-command.service.ts            # Command execution

/src/lib/ai/
├── zai-client.ts                       # Z.AI API client
```

### Webhook Handlers
```
/src/app/api/
├── v1/aimeow/webhook/route.ts         # Primary webhook
└── v1/webhooks/aimeow/route.ts        # Legacy webhook
```

### Management APIs
```
/src/app/api/v1/whatsapp-ai/
├── config/route.ts
├── initialize/route.ts
├── status/route.ts
├── conversations/route.ts
├── conversations/[id]/messages/route.ts
├── stats/route.ts
├── staff/route.ts
└── disconnect/route.ts
```

### Database
```
/prisma/schema.prisma               # Search for WhatsApp* models
```

---

## Environment Variables Required

```bash
# Z.AI (LLM)
ZAI_API_KEY="sk-xxxxxxxx"
ZAI_BASE_URL="https://api.z.ai/api/coding/paas/v4/"
ZAI_TEXT_MODEL="glm-4.6"
ZAI_VISION_MODEL="glm-4.5v"
API_TIMEOUT_MS="300000"

# Aimeow (WhatsApp)
AIMEOW_BASE_URL="https://meow.lumiku.com"
AIMEOW_WEBHOOK_SECRET="your-webhook-secret"

# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"
```

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Total Response Time | 2-6 seconds |
| Bottleneck | Z.AI LLM API (1-5s) |
| Everything Else | <100ms |
| Messages Stored | Infinite (PostgreSQL) |
| Conversations | One per customer per account |
| Conversation History Used | Last 10 messages |
| System Prompt Overhead | <100ms |

---

## Common Questions

### Q: Where is the LLM response generated?
A: In `WhatsAppAIChatService.generateResponse()` in `/src/lib/services/whatsapp-ai/chat.service.ts`

### Q: How does it know if the sender is staff or customer?
A: Intent classifier checks `StaffWhatsAppAuth` table first. If found, routes to staff command handler. Otherwise, treats as customer.

### Q: Why does it take 2-6 seconds to respond?
A: The Z.AI API call takes 1-5 seconds. Everything else is <100ms. This is normal for LLM APIs.

### Q: What if the customer sends a message while the AI is generating a response?
A: Messages are processed sequentially via webhooks. Each message is independent and will get its own LLM response.

### Q: Can I configure the AI per showroom?
A: Yes, completely. `WhatsAppAIConfig` is one per tenant, with settings like AI name, personality, temperature, business hours, FAQ, etc.

### Q: What happens if the LLM API fails?
A: System catches the error, returns a fallback message: "Maaf, terjadi gangguan sistem. Staff kami akan segera membantu Anda.", and escalates the conversation to humans.

### Q: How many messages can it handle?
A: Unknown - never been tested at scale. System is synchronous, so it processes one webhook at a time. Should be fine for 100s of messages/day.

### Q: Is there a queue system?
A: No. Messages are processed synchronously. This makes it simple but less scalable.

---

## Troubleshooting Checklist

- [ ] Is `ZAI_API_KEY` set and valid?
- [ ] Is `ZAI_BASE_URL` set correctly? (with `/api/coding/` or `/api/` depending on plan)
- [ ] Is `AIMEOW_BASE_URL` reachable?
- [ ] Is webhook URL correctly configured in Aimeow dashboard?
- [ ] Does the customer phone number exist in database?
- [ ] Are messages being saved to `WhatsAppMessage` table?
- [ ] Is the intent being classified correctly?
- [ ] For staff commands, is the phone in `StaffWhatsAppAuth`?
- [ ] Are there any logs showing errors in service calls?

---

## Further Reading

### Architecture Patterns
- Webhook-based message processing
- Intent classification pipeline
- LLM prompt engineering
- Multi-tenant isolation
- Synchronous request processing

### Related Technologies
- Aimeow WhatsApp Business API
- Z.AI (Zhipu AI) GLM models
- Prisma ORM
- Next.js API routes
- PostgreSQL

### Potential Improvements
1. Add queue system (Bull, Agenda)
2. Implement caching layer (Redis)
3. Add conversation streaming
4. Fine-tune LLM for domain
5. Add sentiment analysis
6. Implement A/B testing

---

## Support & Questions

For issues or questions:
1. Check the "Common Issues" section in WHATSAPP_LLM_INTEGRATION_SUMMARY.md
2. Review the relevant section in WHATSAPP_LLM_FLOW_ANALYSIS.md
3. Check logs in the service files
4. Review database state in `whatsapp_conversations` and `whatsapp_messages` tables
5. Check environment variables are set correctly

---

**Last Updated:** December 6, 2024
**Documentation Version:** 1.0
**Files:** 4 comprehensive documents (~112KB total)
**Code References:** 10+ service files analyzed
**Database Models:** 5 core WhatsApp models documented
