# AutoLumiku WhatsApp AI - Architecture Diagrams

## System Components Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SYSTEMS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐      ┌──────────────────────────────────┐ │
│  │   WhatsApp Customer          │      │      Aimeow API                  │ │
│  │   (via WhatsApp App)         │      │   (WhatsApp Business)            │ │
│  │                              │      │  https://meow.lumiku.com         │ │
│  └──────────────────┬───────────┘      └──────────────┬───────────────────┘ │
│                     │                                  │                     │
│                     │ Message                          │ Webhook POST        │
│                     │                                  │                     │
└─────────────────────┼──────────────────────────────────┼────────────────────┘
                      │                                  │
                      └──────────────────┬───────────────┘
                                        │
                      ┌─────────────────▼─────────────────┐
                      │   AUTOLUMIKU PLATFORM            │
                      │  (Next.js API Routes)            │
                      │                                  │
                      │  /api/v1/aimeow/webhook         │ ◄── Webhook Handler
                      │  /api/v1/webhooks/aimeow        │ ◄── Legacy Handler
                      └─────────────────┬─────────────────┘
                                        │
                      ┌─────────────────▼──────────────────────────┐
                      │  MESSAGE ORCHESTRATOR SERVICE             │
                      │  (message-orchestrator.service.ts)       │
                      │                                           │
                      │  • Get/Create Conversation                │
                      │  • Save Incoming Message                  │
                      │  • Classify Intent                        │
                      │  • Route to Handler                       │
                      │  • Send Response                          │
                      │  • Update Conversation Status             │
                      └─────────────────┬──────────────────────────┘
                                        │
                ┌───────────────────────┼───────────────────────┐
                │                       │                       │
    ┌───────────▼──────────┐  ┌────────▼────────┐  ┌──────────▼──────────┐
    │  INTENT              │  │ STAFF COMMAND   │  │ CUSTOMER INQUIRY    │
    │  CLASSIFIER          │  │ SERVICE         │  │ (CHAT SERVICE)      │
    │                      │  │                 │  │                     │
    │ Pattern matching:    │  │ Commands:       │  │ 1. Load history     │
    │ • Spam detection     │  │ • Upload        │  │ 2. Build prompt     │
    │ • Staff detection    │  │ • Status        │  │ 3. Call Z.AI LLM    │
    │ • Intent patterns    │  │ • Inventory     │  │ 4. Check escalation │
    │                      │  │ • Stats         │  │ 5. Return response  │
    └──────────────────────┘  └─────────────────┘  └──────────────────────┘
                                    │                       │
                                    │                       │
                                    │          ┌────────────▼─────────────┐
                                    │          │  Z.AI LLM API           │
                                    │          │  https://api.z.ai/...   │
                                    │          │                         │
                                    │          │ Model: glm-4.6          │
                                    │          │ (OpenAI-compatible API) │
                                    │          └────────────┬─────────────┘
                                    │                       │
                                    └───────────┬───────────┘
                                                │
                                ┌───────────────▼────────────────┐
                                │ RESPONSE HANDLER               │
                                │                                │
                                │ • Send via Aimeow API          │
                                │ • Save Outbound Message        │
                                │ • Update Conversation Status   │
                                └───────────────┬────────────────┘
                                                │
                                ┌───────────────▼────────────────┐
                                │ AIMEOW CLIENT SERVICE          │
                                │ (aimeow-client.service.ts)    │
                                │                                │
                                │ POST /api/v1/clients/{id}/     │
                                │       send-message             │
                                └───────────────┬────────────────┘
                                                │
                      ┌─────────────────────────▼────────────────────────────┐
                      │          DATABASE (PostgreSQL)                        │
                      │                                                       │
                      │  • AimeowAccount          • WhatsAppMessage         │
                      │  • WhatsAppConversation   • WhatsAppAIConfig        │
                      │  • Tenant                 • StaffWhatsAppAuth       │
                      └─────────────────────────┬────────────────────────────┘
                                                │
                                ┌───────────────▼────────────────┐
                                │ RESPONSE DELIVERY              │
                                │                                │
                                │ Message sent to customer       │
                                │ via WhatsApp                   │
                                └────────────────────────────────┘
```

---

## Message Processing Flow (Detailed)

```
INPUT
  │
  └─► Webhook POST: /api/v1/aimeow/webhook
      └─► Payload: { clientId, event: "message", data: {...} }
          │
          ├─► [1] PARSE & VERIFY
          │   ├─► Parse JSON body
          │   ├─► Check signature (optional)
          │   └─► Validate clientId format
          │
          ├─► [2] ACCOUNT LOOKUP
          │   └─► Query: AimeowAccount where clientId = ?
          │       Response: { id, tenantId, phoneNumber, aiConfig }
          │
          ├─► [3] DUPLICATE CHECK
          │   └─► Query: WhatsAppMessage where aimeowMessageId = ?
          │       If exists: return early (prevent double processing)
          │
          └─► [4] DISPATCH TO ORCHESTRATOR
              └─► MessageOrchestratorService.processIncomingMessage()
                  │
                  ├─► [4a] GET/CREATE CONVERSATION
                  │   ├─► Query: WhatsAppConversation where 
                  │   │         accountId & customerPhone & status='active'
                  │   ├─► If not found: Create new conversation
                  │   └─► Result: conversation { id, accountId, ... }
                  │
                  ├─► [4b] SAVE INCOMING MESSAGE
                  │   └─► Insert WhatsAppMessage {
                  │         conversationId, direction='inbound',
                  │         sender=from, content, aimeowMessageId
                  │       }
                  │
                  ├─► [4c] CLASSIFY INTENT
                  │   ├─► IntentClassifierService.classify()
                  │   │   ├─► Check SPAM patterns
                  │   │   ├─► Check STAFF (query StaffWhatsAppAuth)
                  │   │   └─► Check CUSTOMER patterns
                  │   │
                  │   └─► Result: {
                  │         intent: "customer_vehicle_inquiry",
                  │         confidence: 0.85,
                  │         isStaff: false,
                  │         isCustomer: true
                  │       }
                  │
                  ├─► [4d] ROUTE BASED ON INTENT
                  │   │
                  │   ├─► IF intent === "spam"
                  │   │   └─► Ignore, return (no response)
                  │   │
                  │   ├─► ELSE IF isStaff === true
                  │   │   └─► StaffCommandService.handleStaffCommand()
                  │   │       ├─► Parse command
                  │   │       ├─► Verify permissions
                  │   │       ├─► Execute (upload/status/inventory/stats)
                  │   │       └─► Get response message
                  │   │
                  │   └─► ELSE (customer inquiry)
                  │       └─► WhatsAppAIChatService.generateResponse()
                  │           │
                  │           ├─► Load AI Config (temperature, maxTokens, etc)
                  │           ├─► Check if chat enabled
                  │           ├─► Check business hours
                  │           │
                  │           ├─► BUILD SYSTEM PROMPT
                  │           │   ├─► Base: AI name, personality, showroom info
                  │           │   ├─► If vehicle inquiry:
                  │           │   │   └─► Add 10 available vehicles
                  │           │   └─► If custom FAQ exists:
                  │           │       └─► Add FAQ to context
                  │           │
                  │           ├─► GET CONVERSATION HISTORY
                  │           │   ├─► Query last 10 messages
                  │           │   └─► Format as chat history
                  │           │
                  │           ├─► BUILD USER PROMPT
                  │           │   ├─► Add recent conversation history
                  │           │   └─► Add current message
                  │           │
                  │           ├─► CALL Z.AI LLM API ⭐ SLOWEST STEP
                  │           │   ├─► Endpoint: https://api.z.ai/api/coding/paas/v4/
                  │           │   ├─► Model: glm-4.6
                  │           │   ├─► Headers: Authorization: Bearer {ZAI_API_KEY}
                  │           │   └─► Duration: 1-5 seconds
                  │           │
                  │           ├─► CHECK ESCALATION
                  │           │   ├─► Look for uncertainty keywords
                  │           │   │   ("tidak yakin", "tidak tahu", etc)
                  │           │   └─► Check if price negotiation
                  │           │
                  │           └─► Return: {
                  │                 message: "Halo! Ya, kami memiliki...",
                  │                 shouldEscalate: false,
                  │                 confidence: 0.85
                  │               }
                  │
                  ├─► [4e] UPDATE MESSAGE WITH INTENT
                  │   └─► Update WhatsAppMessage set intent, confidence
                  │
                  ├─► [4f] SEND RESPONSE VIA AIMEOW
                  │   ├─► Get account from DB (refresh clientId)
                  │   ├─► AimeowClientService.sendMessage({
                  │   │     clientId, to, message
                  │   │   })
                  │   │   └─► POST {AIMEOW_BASE_URL}/api/v1/clients/{clientId}/send-message
                  │   │       Body: { phone: to, message: responseText }
                  │   │       Response: { messageId: "aimeow_msg_123" }
                  │   │
                  │   └─► Result: { success: true, messageId }
                  │
                  ├─► [4g] SAVE OUTBOUND MESSAGE
                  │   └─► Insert WhatsAppMessage {
                  │         conversationId, direction='outbound',
                  │         sender='ai', senderType='ai',
                  │         content, aiResponse=true,
                  │         aimeowMessageId, aimeowStatus='sent'
                  │       }
                  │
                  ├─► [4h] UPDATE CONVERSATION STATUS
                  │   └─► Update WhatsAppConversation set
                  │         lastMessageAt = NOW(),
                  │         lastIntent = classification.intent,
                  │         [if escalated] escalatedTo = "human",
                  │         [if escalated] escalatedAt = NOW()
                  │
                  └─► [4i] RETURN RESULT
                      └─► {
                            success: true,
                            conversationId: "conv_789",
                            intent: "customer_vehicle_inquiry",
                            responseMessage: "Halo! Ya, kami...",
                            escalated: false
                          }

WEBHOOK HANDLER
  │
  └─► Log processing result
      └─► Return: { success: true, received: true }

OUTPUT
  │
  └─► Aimeow sends message to customer's WhatsApp
      └─► Customer sees response in chat

STATUS UPDATES (Async)
  │
  └─► Aimeow sends status webhook for message delivery
      ├─► Event: "status"
      ├─► Data: { messageId, status: "delivered" | "read" }
      └─► Update WhatsAppMessage set aimeowStatus, deliveredAt/readAt
```

---

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                       DATA STRUCTURES & FLOW                           │
└────────────────────────────────────────────────────────────────────────┘

INPUT: Webhook Payload
├─ clientId: "aimeow_abc123"
├─ event: "message"
├─ data:
│  ├─ from: "6281234567890"
│  ├─ message: "Ada mobil Honda Jazz?"
│  └─ messageId: "msg_xyz123"
│
├──────────────────────────────────────────────────────────────────────
│
│  Database Operations
│  
│  ┌─ AimeowAccount
│  │  └─ SELECT WHERE clientId = 'aimeow_abc123'
│  │     Result: { id: 'acc_1', tenantId: 'tenant_1', ... }
│  │
│  ├─ WhatsAppConversation (CREATE or SELECT)
│  │  └─ Result: { id: 'conv_1', accountId: 'acc_1', customerPhone, ... }
│  │
│  ├─ WhatsAppMessage (INBOUND) INSERT
│  │  ├─ conversationId: 'conv_1'
│  │  ├─ direction: 'inbound'
│  │  ├─ content: 'Ada mobil Honda Jazz?'
│  │  ├─ intent: null (will be updated)
│  │  └─ aimeowMessageId: 'msg_xyz123'
│  │
│  ├─ StaffWhatsAppAuth (SELECT)
│  │  └─ To check if sender is staff
│  │
│  ├─ WhatsAppMessage (UPDATE)
│  │  └─ Set intent = 'customer_vehicle_inquiry', confidence = 0.85
│  │
│  ├─ Tenant (SELECT)
│  │  └─ For system prompt (name, city, phone, vehicles)
│  │
│  ├─ Vehicle (SELECT TOP 10)
│  │  └─ For system prompt context
│  │
│  ├─ WhatsAppMessage (OUTBOUND) INSERT
│  │  ├─ conversationId: 'conv_1'
│  │  ├─ direction: 'outbound'
│  │  ├─ content: "Halo! Ya, kami memiliki Honda Jazz..."
│  │  ├─ aiResponse: true
│  │  └─ aimeowMessageId: 'aimeow_msg_123'
│  │
│  └─ WhatsAppConversation (UPDATE)
│     └─ lastMessageAt, lastIntent, [escalatedTo, escalatedAt]
│
├──────────────────────────────────────────────────────────────────────
│
│  External API Calls
│
│  ┌─ Z.AI API
│  │  POST /api/coding/paas/v4/chat/completions
│  │  Request: {
│  │    model: "glm-4.6",
│  │    messages: [
│  │      { role: "system", content: "[system prompt]" },
│  │      { role: "user", content: "[user prompt + history]" }
│  │    ],
│  │    temperature: 0.7,
│  │    max_tokens: 1000
│  │  }
│  │  Response: {
│  │    choices: [{
│  │      message: { content: "Halo! Ya, kami memiliki..." }
│  │    }]
│  │  }
│  │
│  └─ Aimeow API
│     POST /api/v1/clients/{clientId}/send-message
│     Request: {
│       phone: "6281234567890",
│       message: "Halo! Ya, kami memiliki Honda Jazz..."
│     }
│     Response: {
│       messageId: "aimeow_msg_123"
│     }
│
└────────────────────────────────────────────────────────────────────────
```

---

## Intent Classification Decision Tree

```
MESSAGE CLASSIFICATION FLOW
═════════════════════════════════════════════════════════════════════

Input: message, senderPhone, tenantId
         │
         ▼
    Normalize text
         │
         ▼
    ┌─────────────────────────────────────────┐
    │ CHECK IF SPAM                           │
    ├─────────────────────────────────────────┤
    │ Patterns:                               │
    │ • pulsa, voucher, game, chip, diamond   │
    │ • menang, hadiah, klik link, bonus      │
    │ • only numbers/punctuation              │
    └──────┬──────────────────────────────────┘
           │
           ├─► MATCH → Intent: "spam", Return ✓
           │
           └─► NO MATCH → Continue
               │
               ▼
               ┌──────────────────────────────────┐
               │ CHECK IF SENDER IS STAFF         │
               ├──────────────────────────────────┤
               │ Query StaffWhatsAppAuth where:  │
               │ • phoneNumber = senderPhone      │
               │ • tenantId = tenantId            │
               │ • isActive = true                │
               └──────┬───────────────────────────┘
                      │
                      ├─► FOUND (isStaff = true)
                      │   │
                      │   ▼
                      │   ┌──────────────────────────────────┐
                      │   │ CHECK STAFF COMMANDS             │
                      │   ├──────────────────────────────────┤
                      │   │ /upload, upload mobil            │
                      │   │ /status, update status           │
                      │   │ /inventory, cek stok             │
                      │   │ /stats, laporan                  │
                      │   └─► Intent: "staff_*", Return ✓
                      │
                      └─► NOT FOUND (isCustomer = true)
                          │
                          ▼
                          ┌──────────────────────────────────┐
                          │ CHECK CUSTOMER INTENTS           │
                          ├──────────────────────────────────┤
                          │ Priority order (confidence):      │
                          │                                  │
                          │ 1. Greeting (0.9)              │
                          │    halo, hai, pagi, siang       │
                          │                                  │
                          │ 2. Vehicle Inquiry (0.85)       │
                          │    mobil, kendaraan, brand names │
                          │                                  │
                          │ 3. Price Inquiry (0.85)         │
                          │    harga, berapa, kredit, dp    │
                          │                                  │
                          │ 4. Test Drive (0.85)            │
                          │    test drive, coba, showroom   │
                          │                                  │
                          │ 5. General Question (0.6)       │
                          │    default fallback              │
                          └─► Intent: "customer_*", Return ✓

Output: {
  intent: "customer_vehicle_inquiry",
  confidence: 0.85,
  isStaff: false,
  isCustomer: true
}
```

---

## LLM Prompt Construction Flow

```
SYSTEM PROMPT BUILDING
═════════════════════════════════════════════════════════════════════

Load whatsapp_ai_config for tenant
         │
         ▼
BASE TEMPLATE
─────────────────────────────────────────
Anda adalah {aiName}, asisten virtual untuk {tenantName}

Personality: {aiPersonality}

Tugas Anda:
• Menjawab pertanyaan customer tentang mobil
• Memberikan informasi harga, spek, kondisi
• Membantu customer menemukan mobil cocok
• Menjadwalkan test drive
• Bersikap ramah, profesional, membantu

Informasi Showroom:
• Nama: {tenant.name}
• Lokasi: {tenant.city}
• Telepon: {tenant.phoneNumber}
• WhatsApp: {tenant.whatsappNumber}

Aturan Penting:
1. JANGAN informasi yang tidak pasti
2. Jika mobil tidak ada, jujur katakan
3. Jika terlalu kompleks, sarankan bicara staff
4. Gunakan Bahasa Indonesia sopan
5. Fokus kebutuhan, bukan hard selling
─────────────────────────────────────────
         │
         ▼
IF intent = "vehicle_inquiry" OR "price_inquiry"
         │
         ├─► Query available vehicles (top 10)
         │
         ├─► Format:
         │   Inventory Mobil Tersedia (10 unit):
         │   - Honda Jazz 2022 (Manual) - Rp 185.000.000 - Merah
         │   - Toyota Avanza 2020 (Manual) - Rp 150.000.000 - Putih
         │   ...
         │
         └─► APPEND TO SYSTEM PROMPT
                      │
                      ▼
IF customFAQ configured
         │
         ├─► Format FAQ array as JSON
         │
         └─► APPEND TO SYSTEM PROMPT
                      │
                      ▼
FINAL SYSTEM PROMPT READY
─────────────────────────────────────────────────────────────────


USER PROMPT BUILDING
═════════════════════════════════════════════════════════════════════

Load conversation history (last 10 messages)
         │
         ▼
Riwayat Percakapan:
Customer: "Ada mobil Honda Jazz?"

Customer sekarang mengirim:
Ada mobil Honda Jazz?

Berikan respons yang membantu dan relevan:
─────────────────────────────────────────────────────────────────


Z.AI API CALL
═════════════════════════════════════════════════════════════════════

POST https://api.z.ai/api/coding/paas/v4/chat/completions
Body: {
  model: "glm-4.6",
  messages: [
    { role: "system", content: "[FINAL SYSTEM PROMPT]" },
    { role: "user", content: "[USER PROMPT]" }
  ],
  temperature: {config.temperature},      # default 0.7
  max_tokens: {config.maxTokens}          # default 1000
}

Response: {
  choices: [{
    message: {
      content: "Halo! Ya, kami memiliki Honda Jazz 2022..."
    }
  }]
}
         │
         ▼
RETURN TO ORCHESTRATOR
```

---

## Escalation Decision Tree

```
ESCALATION LOGIC
═════════════════════════════════════════════════════════════════════

AI Response: "Halo! Ya, kami memiliki Honda Jazz 2022..."
         │
         ▼
CHECK UNCERTAINTY KEYWORDS
         │
         ├─ "tidak yakin"          → ESCALATE
         ├─ "tidak tahu"           → ESCALATE
         ├─ "maaf saya tidak"      → ESCALATE
         ├─ "hubungi staff"        → ESCALATE
         ├─ "berbicara dengan staff" → ESCALATE
         └─ "tidak dapat membantu" → ESCALATE
                      │
                      ├─► IF MATCH → shouldEscalate = true
                      │
                      └─► CONTINUE
                          │
                          ▼
                          CHECK PRICE NEGOTIATION
                          (Only if intent = "price_inquiry")
                          │
                          ├─ "nego"   → ESCALATE
                          └─ "diskon" → ESCALATE
                          │
                          ├─► IF MATCH → shouldEscalate = true
                          │
                          └─► shouldEscalate = false
                          
         ▼
IF shouldEscalate = true
         │
         ├─► Update conversation.status = "escalated"
         ├─► Set escalatedTo = "human"
         ├─► Set escalatedAt = NOW()
         └─► Mark for human review
```

---

## Database Schema Relationships

```
RELATIONAL DIAGRAM
═════════════════════════════════════════════════════════════════════

                         Tenant (1)
                            │
                ┌───────────┬┴────────────┬─────────────┐
                │           │            │             │
         AimeowAccount  WhatsAppAIConfig │      (other tables)
           (1)              (1)          │
             │               │           │
             └─────┬────┬────┘           │
                   │    │               │
                   │    └───────────────┤─► Vehicle
                   │                    │
                   │              (10 vehicles per system prompt)
                   │
             WhatsAppConversation (N)
                   │
                   │ (1 conversation per customer-account pair)
                   │
             WhatsAppMessage (N)
                   │
                   │ (many messages per conversation)
                   │
                   ├─ INBOUND (customer to AI)
                   └─ OUTBOUND (AI to customer)


KEY RELATIONSHIPS:

AimeowAccount
  ├─ tenantId ──────► Tenant (1:1)
  └─ aiConfig ──────► WhatsAppAIConfig (1:1)

WhatsAppConversation
  ├─ accountId ──────► AimeowAccount (N:1)
  ├─ tenantId ──────► Tenant (N:1)
  └─ messages ──────► WhatsAppMessage (1:N)

WhatsAppMessage
  ├─ conversationId ─► WhatsAppConversation (N:1)
  └─ tenantId ──────► Tenant (N:1)

WhatsAppAIConfig
  ├─ tenantId ──────► Tenant (1:1)
  └─ accountId ──────► AimeowAccount (1:1)

StaffWhatsAppAuth
  └─ tenantId ──────► Tenant (N:1)
```

---

## Deployment Architecture

```
PRODUCTION DEPLOYMENT
═════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
└────────┬──────────────────────────────────────────────────────┬──┘
         │                                                       │
         │ WhatsApp Messages                                     │
         │ (via Aimeow)                                          │
         │                                                       │
         ▼                                                       │
    ┌────────────────────────────────────────────────────┐      │
    │  AIMEOW API                                        │      │
    │  https://meow.lumiku.com                           │      │
    │  • Receives messages                               │      │
    │  • Sends webhooks                                  │      │
    └────────────────┬─────────────────────────────────┘      │
                     │                                         │
                     │ Webhook (POST)                          │
                     │ /api/v1/aimeow/webhook                  │
                     │                                         │
                     ▼                                         │
    ┌────────────────────────────────────────────────────┐     │
    │  AUTOLUMIKU PLATFORM (Next.js)                    │     │
    │  ┌──────────────────────────────────────────────┐  │     │
    │  │  API Routes (Webhook Handlers)               │  │     │
    │  ├──────────────────────────────────────────────┤  │     │
    │  │  • /api/v1/aimeow/webhook (PRIMARY)         │  │     │
    │  │  • /api/v1/webhooks/aimeow (LEGACY)         │  │     │
    │  │  • /api/v1/whatsapp-ai/* (Management)       │  │     │
    │  └──────────────┬───────────────────────────────┘  │     │
    │                 │                                   │     │
    │  ┌──────────────▼───────────────────────────────┐  │     │
    │  │  Services (Business Logic)                   │  │     │
    │  ├──────────────────────────────────────────────┤  │     │
    │  │  • MessageOrchestratorService                │  │     │
    │  │  • WhatsAppAIChatService                     │  │     │
    │  │  • IntentClassifierService                   │  │     │
    │  │  • StaffCommandService                       │  │     │
    │  │  • AimeowClientService                       │  │     │
    │  │  • ZAIClient (LLM Integration)               │  │     │
    │  └──────────────┬───────────────────────────────┘  │     │
    │                 │                                   │     │
    │  ┌──────────────▼───────────────────────────────┐  │     │
    │  │  Prisma ORM                                  │  │     │
    │  │  (Database Abstraction)                      │  │     │
    │  └──────────────┬───────────────────────────────┘  │     │
    └─────────────────┼─────────────────────────────────┘     │
                      │                                         │
                      │ TCP Connection (SSL/TLS)                │
                      │                                         │
                      ▼                                         │
         ┌────────────────────────────────────────┐           │
         │  PostgreSQL Database                   │           │
         │  (Persistent Storage)                  │           │
         │  ┌─────────────────────────────────┐  │           │
         │  │ Tables:                          │  │           │
         │  │ • aimeow_accounts               │  │           │
         │  │ • whatsapp_conversations        │  │           │
         │  │ • whatsapp_messages             │  │           │
         │  │ • whatsapp_ai_configs           │  │           │
         │  │ • tenants                       │  │           │
         │  │ • vehicles                      │  │           │
         │  │ • staff_whatsapp_auth           │  │           │
         │  └─────────────────────────────────┘  │           │
         └────────────────────────────────────────┘           │
                                                              │
                                                              │
         ┌────────────────────────────────────────┐          │
         │  Z.AI API (LLM)                        │◄──────────┘
         │  https://api.z.ai/api/coding/paas/v4/ │   HTTP
         │  • glm-4.6 (Text)                      │   Request
         │  • glm-4.5v (Vision)                   │
         └────────────────────────────────────────┘
```

---

## Environment Variables Dependency Map

```
REQUIRED FOR WHATSAPP AI FUNCTIONALITY
════════════════════════════════════════════════════════════════

┌──── Z.AI (LLM) ────────┐
│                         │
│ ZAI_API_KEY             ── Required for customer responses
│ ZAI_BASE_URL            ── API endpoint
│ ZAI_TEXT_MODEL          ── "glm-4.6" (default)
│ ZAI_VISION_MODEL        ── "glm-4.5v" (for AI vehicle ID)
│ API_TIMEOUT_MS          ── 5 minutes (300000ms)
│
└─────────────────────────┘

┌──── Aimeow API ────────┐
│                        │
│ AIMEOW_BASE_URL        ── https://meow.lumiku.com
│ AIMEOW_WEBHOOK_SECRET  ── For signature verification
│                        │
└────────────────────────┘

┌──── Webhook Config ────┐
│                        │
│ AIMEOW_WEBHOOK_USER_AGENT ── Verification
│ AIMEOW_WEBHOOK_VERIFY_TOKEN ── Verification
│                        │
└────────────────────────┘

┌──── Database ──────────┐
│                        │
│ DATABASE_URL           ── PostgreSQL connection
│                        │
└────────────────────────┘


FLOW: When service starts
      │
      ├─► Create Z.AI Client (from env vars)
      ├─► Initialize Prisma ORM (from DATABASE_URL)
      └─► Register webhook handlers


FLOW: When message arrives
      │
      ├─► Use AIMEOW_WEBHOOK_SECRET for verification
      ├─► Use DATABASE_URL to query/store data
      └─► Use Z.AI credentials to generate responses
```

---

## Summary

The AutoLumiku WhatsApp AI system is a sophisticated, multi-layer architecture that:

1. **Receives** messages via Aimeow webhooks
2. **Processes** synchronously through a central orchestrator
3. **Classifies** intent using pattern matching
4. **Routes** to AI (customers) or command handlers (staff)
5. **Generates** intelligent responses using Z.AI LLM
6. **Sends** responses back through Aimeow API
7. **Stores** all data in PostgreSQL for analytics and context
8. **Escalates** to humans when necessary

The entire flow takes 2-6 seconds per message, with the bottleneck being the LLM API call (1-5 seconds). The system supports multi-tenancy, business hours, staff commands, and extensive configuration.

