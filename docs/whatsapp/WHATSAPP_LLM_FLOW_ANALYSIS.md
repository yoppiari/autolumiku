# AutoLumiku WhatsApp AI Message Processing Flow - Complete Analysis

## Executive Summary

AutoLumiku implements a sophisticated WhatsApp messaging automation system that processes incoming messages through Aimeow (WhatsApp Business API), classifies intent, invokes an LLM for customer responses, and handles staff commands. The flow is synchronous (no queue system) and processes messages in real-time from webhook reception to response delivery.

---

## 1. WEBHOOK RECEPTION & ENTRY POINTS

### Dual Webhook Endpoints

The system has two webhook endpoints that both handle Aimeow events:

#### Endpoint 1: `/api/v1/aimeow/webhook` (Primary)
- **Location:** `/src/app/api/v1/aimeow/webhook/route.ts`
- **Method:** POST
- **Purpose:** Primary webhook handler for Aimeow events
- **Format:** Receives structured event payload

#### Endpoint 2: `/api/v1/webhooks/aimeow` (Legacy)
- **Location:** `/src/app/api/v1/webhooks/aimeow/route.ts`
- **Method:** POST
- **Purpose:** Alternative/legacy webhook handler
- **Status:** Both are active (redundancy)

### Webhook Verification

```typescript
// Optional signature verification (if AIMEOW_WEBHOOK_SECRET is configured)
const signature = request.headers.get("x-aimeow-signature");
if (webhookSecret && (!signature || signature !== webhookSecret)) {
  return 401 Unauthorized
}

// Basic verification: User-Agent check in production
const expectedUserAgent = process.env.AIMEOW_WEBHOOK_USER_AGENT || "Go-http-client";
```

### Webhook Payload Structure

```typescript
interface AimeowWebhookPayload {
  clientId: string;                    // Aimeow client identifier
  event: "message" | "status" | "qr" | "connected" | "disconnected";
  timestamp: string;
  data: {
    from?: string;                     // Sender phone (E.164 format)
    to?: string;
    message?: string;                  // Message text
    text?: string;                     // Alternative field
    mediaUrl?: string;
    mediaType?: string;
    messageId?: string;
    status?: string;
    qrCode?: string;
    phoneNumber?: string;
  };
}
```

---

## 2. MESSAGE PROCESSING PIPELINE

### Step 2.1: Account Lookup & Validation

```typescript
// From webhook handler (handleIncomingMessage)
const account = await AimeowClientService.getAccountByClientId(payload.clientId);

// Fetches from database:
// - AimeowAccount record with clientId
// - Associated Tenant and WhatsAppAIConfig
// - Verification that account exists and is linked to a tenant
```

**Database Model:** `AimeowAccount`
- `id`: Unique account ID
- `tenantId`: Link to Tenant (one-to-one)
- `clientId`: Unique Aimeow client identifier
- `phoneNumber`: WhatsApp number (E.164)
- `isActive`: Connection status
- `connectionStatus`: "connected", "disconnected", "qr_ready"
- `aiConfig`: Relation to `WhatsAppAIConfig`

### Step 2.2: Duplicate Detection

```typescript
// Check if message already processed
const existing = await prisma.whatsAppMessage.findUnique({
  where: { aimeowMessageId: messageId },
});

if (existing) {
  console.log(`Duplicate message skipped: ${messageId}`);
  return; // Prevent double processing
}
```

### Step 2.3: Orchestrator Dispatch

All message processing is delegated to the **Message Orchestrator Service**:

```typescript
// From: /src/lib/services/whatsapp-ai/message-orchestrator.service.ts
const result = await MessageOrchestratorService.processIncomingMessage({
  accountId: account.id,
  tenantId: account.tenantId,
  from: payload.data.from,
  message: payload.data.message,
  mediaUrl: payload.data.mediaUrl,
  mediaType: payload.data.mediaType,
  messageId: payload.data.messageId,
});
```

---

## 3. MESSAGE ORCHESTRATOR SERVICE (Core Pipeline)

**File:** `/src/lib/services/whatsapp-ai/message-orchestrator.service.ts`

The orchestrator is the central coordinator that handles the complete flow:

### Flow Diagram

```
Incoming Message
    ↓
[1] Get/Create Conversation
    ↓
[2] Save Incoming Message to DB
    ↓
[3] Classify Intent (IntentClassifierService)
    ↓
    ├─→ Intent: SPAM → Ignore, no response
    │
    ├─→ Intent: STAFF COMMAND → StaffCommandService.executeCommand()
    │   ├─→ Parse command parameters
    │   ├─→ Execute (upload, status, inventory, stats)
    │   └─→ Return response message
    │
    └─→ Intent: CUSTOMER → WhatsAppAIChatService.generateResponse()
        ├─→ Get conversation history
        ├─→ Build system prompt (with business context)
        ├─→ Call ZAI LLM API
        └─→ Return AI-generated response
    ↓
[4] Send Response via Aimeow
    ↓
[5] Update Conversation Status
    ↓
Return ProcessingResult
```

### Step 3.1: Get or Create Conversation

```typescript
// Find active conversation for this customer
let conversation = await prisma.whatsAppConversation.findFirst({
  where: {
    accountId,
    customerPhone,
    status: "active",
  },
  orderBy: { lastMessageAt: "desc" },
});

// Create new if doesn't exist
if (!conversation) {
  conversation = await prisma.whatsAppConversation.create({
    data: {
      accountId,
      tenantId,
      customerPhone,
      isStaff: false,
      conversationType: "customer",
      status: "active",
    },
  });
}
```

**Database Model:** `WhatsAppConversation`
- Tracks conversation thread per customer per account
- Stores escalation status, conversation type, last intent
- Used to maintain context across messages

### Step 3.2: Save Incoming Message

```typescript
const incomingMsg = await prisma.whatsAppMessage.create({
  data: {
    conversationId,
    tenantId,
    direction: "inbound",
    sender: incoming.from,
    senderType: "customer", // Updated after classification
    content: incoming.message,
    mediaUrl: incoming.mediaUrl,
    mediaType: incoming.mediaType,
    aimeowMessageId: incoming.messageId,
    aimeowStatus: "delivered",
  },
});
```

**Database Model:** `WhatsAppMessage`
- Stores all messages (inbound/outbound)
- Records intent classification, confidence, entities
- Tracks Aimeow delivery status (sent, delivered, read)
- AI response flag for bot-generated messages

### Step 3.3: Intent Classification

**Service:** `IntentClassifierService` at `/src/lib/services/whatsapp-ai/intent-classifier.service.ts`

```typescript
const classification = await IntentClassifierService.classify(
  message,
  senderPhone,
  tenantId
);
```

**Classification Process:**

1. **Staff Detection:** Check if sender is in `StaffWhatsAppAuth` table
   - Verified staff get access to commands
   - Non-staff are treated as customers

2. **Spam Detection:** Regex patterns for common spam
   ```typescript
   const SPAM_PATTERNS = [
     /\b(pulsa|voucher|game|chip|diamond|promo\s+pinjaman)\b/i,
     /\b(menang|hadiah|klik\s+link|claim|bonus)\b/i,
     /^[0-9\s\.\-\(\)]+$/, // Only numbers and punctuation
   ];
   ```

3. **Staff Command Matching:** Pattern-based detection
   ```typescript
   const STAFF_COMMAND_PATTERNS = {
     upload_vehicle: [/^\/upload/i, /^upload\s+mobil/i, /^tambah\s+mobil/i],
     update_status: [/^\/status/i, /^update\s+status/i],
     check_inventory: [/^\/inventory/i, /^cek\s+stok/i],
     get_stats: [/^\/stats/i, /^laporan/i],
   };
   ```

4. **Customer Intent Matching:** Keywords and patterns
   ```typescript
   const CUSTOMER_PATTERNS = {
     greeting: [/^(halo|hai|hello|hi|pagi|siang)/i],
     vehicle_inquiry: [/\b(mobil|motor|kendaraan)\b/i, /brand names/i],
     price_inquiry: [/\b(harga|price|berapa|biaya|kredit)/i],
     test_drive: [/\b(test\s*drive|coba|lihat.*showroom)\b/i],
   };
   ```

**Returns:**
```typescript
interface IntentClassificationResult {
  intent: "customer_greeting" | "customer_vehicle_inquiry" | "customer_price_inquiry" |
          "customer_test_drive" | "customer_general_question" |
          "staff_upload_vehicle" | "staff_update_status" | "staff_check_inventory" |
          "staff_get_stats" | "spam" | "unknown";
  confidence: number; // 0-1
  isStaff: boolean;
  isCustomer: boolean;
  entities?: Record<string, any>;
  reason?: string;
}
```

---

## 4. LLM INVOCATION FOR CUSTOMER INQUIRIES

### Step 4.1: Routing Decision

```typescript
if (classification.intent === "spam") {
  // Ignore spam, no response
  return { success: true, escalated: false };
  
} else if (classification.isStaff) {
  // Handle staff command (see Section 5)
  const result = await this.handleStaffCommand(...);
  
} else {
  // Handle customer inquiry with AI (see below)
  const result = await this.handleCustomerInquiry(...);
}
```

### Step 4.2: Customer Inquiry Handler

**File:** `/src/lib/services/whatsapp-ai/chat.service.ts`

```typescript
private static async handleCustomerInquiry(
  conversation: any,
  intent: MessageIntent,
  message: string
): Promise<{ message: string; escalated: boolean }> {
  try {
    // 1. Get conversation history
    const messageHistory = await WhatsAppAIChatService.getConversationHistory(
      conversation.id,
      10  // Last 10 messages
    );

    // 2. Generate AI response
    const aiResponse = await WhatsAppAIChatService.generateResponse(
      {
        tenantId: conversation.tenantId,
        conversationId: conversation.id,
        customerPhone: conversation.customerPhone,
        customerName: conversation.customerName,
        intent,
        messageHistory,
      },
      message
    );

    return {
      message: aiResponse.message,
      escalated: aiResponse.shouldEscalate,
    };
  } catch (error) {
    // Fallback to human escalation
    return {
      message: "Maaf, terjadi gangguan sistem. Staff kami akan segera membantu Anda.",
      escalated: true,
    };
  }
}
```

### Step 4.3: LLM Generation Pipeline

**Service:** `WhatsAppAIChatService.generateResponse()`

**Process:**

```typescript
static async generateResponse(
  context: ChatContext,
  userMessage: string
): Promise<ChatResponse> {
  // 1. Load AI Configuration
  const account = await prisma.aimeowAccount.findUnique({
    where: { tenantId: context.tenantId },
    include: {
      aiConfig: true,
      tenant: true,
    },
  });

  const config = account.aiConfig;

  // 2. Verify customer chat is enabled
  if (!config.customerChatEnabled) {
    return {
      message: "Maaf, fitur chat otomatis sedang tidak aktif...",
      shouldEscalate: true,
      confidence: 1.0,
      processingTime: Date.now() - startTime,
    };
  }

  // 3. Check business hours (if configured)
  const shouldCheckHours = config.businessHours && config.afterHoursMessage;
  if (shouldCheckHours && !this.isWithinBusinessHours(config.businessHours, config.timezone)) {
    return {
      message: config.afterHoursMessage,
      shouldEscalate: false,
      confidence: 1.0,
      processingTime: Date.now() - startTime,
    };
  }

  // 4. Build system prompt
  const systemPrompt = await this.buildSystemPrompt(
    account.tenant,
    config,
    context.intent
  );

  // 5. Build conversation context
  const conversationContext = this.buildConversationContext(
    context.messageHistory,
    userMessage
  );

  // 6. Call Z.AI LLM
  const zaiClient = createZAIClient();
  const aiResponse = await zaiClient.generateText({
    systemPrompt,
    userPrompt: conversationContext,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });

  // 7. Determine if escalation needed
  const shouldEscalate = this.shouldEscalateToHuman(
    aiResponse.content,
    context.intent
  );

  return {
    message: aiResponse.content,
    shouldEscalate,
    confidence: 0.85,
    processingTime: Date.now() - startTime,
  };
}
```

### Step 4.4: System Prompt Construction

The system prompt is dynamically built with business context:

```typescript
private static async buildSystemPrompt(
  tenant: any,
  config: any,
  intent: MessageIntent
): Promise<string> {
  let systemPrompt = `Anda adalah ${config.aiName}, asisten virtual untuk ${tenant.name}, 
sebuah showroom mobil bekas.

Personality: ${config.aiPersonality}
Tugas Anda:
- Menjawab pertanyaan customer tentang mobil yang tersedia
- Memberikan informasi harga, spesifikasi, dan kondisi kendaraan
- Membantu customer untuk menemukan mobil yang sesuai kebutuhan
- Menjadwalkan test drive atau kunjungan showroom
- Bersikap ramah, profesional, dan membantu

Informasi Showroom:
- Nama: ${tenant.name}
- Lokasi: ${tenant.city || "Indonesia"}
- Telepon: ${tenant.phoneNumber}
- WhatsApp: ${tenant.whatsappNumber}

Aturan Penting:
1. JANGAN memberikan informasi yang tidak Anda ketahui dengan pasti
2. Jika ditanya tentang mobil spesifik yang tidak ada, jujur katakan tidak tersedia
3. Jika pertanyaan terlalu kompleks, sarankan customer berbicara dengan staff
4. Selalu gunakan Bahasa Indonesia yang sopan
5. Fokus pada kebutuhan customer, bukan hard selling`;

  // Add vehicle inventory if relevant
  if (intent === "customer_vehicle_inquiry" || intent === "customer_price_inquiry") {
    const vehicles = await this.getAvailableVehicles(tenant.id);
    if (vehicles.length > 0) {
      systemPrompt += `\n\nInventory Mobil Tersedia (${vehicles.length} unit):\n`;
      systemPrompt += vehicles
        .map(v => `- ${v.make} ${v.model} ${v.year} - Rp ${v.price} - ${v.color}`)
        .join("\n");
    }
  }

  // Add custom FAQ if configured
  if (config.customFAQ) {
    systemPrompt += `\n\nFAQ:\n${JSON.stringify(config.customFAQ, null, 2)}`;
  }

  return systemPrompt;
}
```

### Step 4.5: Z.AI Client Integration

**File:** `/src/lib/ai/zai-client.ts`

```typescript
export class ZAIClient {
  async generateText(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    const response = await this.client.chat.completions.create({
      model: this.textModel,                    // "glm-4.6" (default)
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4000,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      reasoning: (response.choices[0]?.message as any)?.reasoning_content || null,
      finishReason: response.choices[0]?.finish_reason,
      usage: response.usage,
    };
  }
}
```

**Z.AI Client Initialization:**
```typescript
export function createZAIClient(): ZAIClient | null {
  const apiKey = process.env.ZAI_API_KEY;
  const baseURL = process.env.ZAI_BASE_URL;

  if (!apiKey || !baseURL) {
    return null; // Returns null during build time
  }

  return new ZAIClient({
    apiKey,
    baseURL,
    timeout: parseInt(process.env.API_TIMEOUT_MS || '300000', 10),
    textModel: process.env.ZAI_TEXT_MODEL || 'glm-4.6',
    visionModel: process.env.ZAI_VISION_MODEL || 'glm-4.5v',
  });
}
```

### Step 4.6: Conversation History Loading

```typescript
static async getConversationHistory(
  conversationId: string,
  limit: number = 10
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const messages = await prisma.whatsAppMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Reverse for chronological order
  return messages.reverse().map((msg) => ({
    role: msg.direction === "inbound" ? "user" : "assistant",
    content: msg.content,
  }));
}
```

### Step 4.7: Escalation Decision

```typescript
private static shouldEscalateToHuman(
  aiResponse: string,
  intent: MessageIntent
): boolean {
  // Check for uncertainty keywords
  const uncertaintyKeywords = [
    "tidak yakin", "tidak tahu", "maaf saya tidak",
    "hubungi staff", "berbicara dengan staff", "tidak dapat membantu",
  ];

  const hasUncertainty = uncertaintyKeywords.some((keyword) =>
    aiResponse.toLowerCase().includes(keyword)
  );

  // Check for price negotiation (if not enabled)
  const isPriceNegotiation =
    intent === "customer_price_inquiry" &&
    (aiResponse.toLowerCase().includes("nego") ||
     aiResponse.toLowerCase().includes("diskon"));

  return hasUncertainty || isPriceNegotiation;
}
```

---

## 5. STAFF COMMAND HANDLING

**Service:** `/src/lib/services/whatsapp-ai/staff-command.service.ts`

### Staff Verification

```typescript
// Verify staff authorization
const isAuthorized = await this.verifyStaffAuthorization(
  tenantId,
  staffPhone,
  intent
);

// Checks StaffWhatsAppAuth table for phone number + tenant + enabled status
private static async verifyStaffAuthorization(
  tenantId: string,
  staffPhone: string,
  intent: MessageIntent
): Promise<boolean> {
  const staff = await prisma.staffWhatsAppAuth.findFirst({
    where: {
      tenantId,
      phoneNumber: staffPhone,
      isActive: true,
    },
  });

  if (!staff) return false;

  // Check feature enablement in AI config
  const aiConfig = await prisma.whatsAppAIConfig.findUnique({
    where: { tenantId },
  });

  switch (intent) {
    case "staff_upload_vehicle":
      return aiConfig?.enableStaffUpload ?? true;
    case "staff_update_status":
      return aiConfig?.enableStaffStatus ?? true;
    case "staff_check_inventory":
      return aiConfig?.enableStaffStatus ?? true; // Inventory check tied to status
    case "staff_get_stats":
      return aiConfig?.enableStaffStatus ?? true;
    default:
      return false;
  }
}
```

### Command Execution

**Supported Commands:**

1. **Upload Vehicle**: `/upload` or `upload mobil`
   - Saves vehicle data, creates records in Vehicle table
   - Processes media attachments

2. **Update Status**: `/status` or `update status`
   - Changes vehicle status (available, sold, etc.)
   - Updates database

3. **Check Inventory**: `/inventory` or `cek stok`
   - Lists available vehicles
   - Returns formatted response

4. **Get Statistics**: `/stats` or `laporan`
   - Retrieves conversation and conversion metrics

---

## 6. MESSAGE RESPONSE SENDING

After LLM response is generated, the message is sent back to the customer via Aimeow:

### Step 6.1: Send Response via Aimeow

```typescript
private static async sendResponse(
  accountId: string,
  to: string,                    // Customer phone number
  message: string,               // AI-generated response
  conversationId: string,
  intent: MessageIntent
) {
  // Get account with fresh clientId from DB
  const account = await prisma.aimeowAccount.findUnique({
    where: { id: accountId },
  });

  // Send via Aimeow API
  const result = await AimeowClientService.sendMessage({
    clientId: account.clientId,
    to,
    message,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send message");
  }

  // Save outbound message to database
  await prisma.whatsAppMessage.create({
    data: {
      conversationId,
      tenantId: conversation.tenantId,
      direction: "outbound",
      sender: account.phoneNumber || "AI",
      senderType: "ai",
      content: message,
      intent,
      aiResponse: true,
      aimeowMessageId: result.messageId,
      aimeowStatus: "sent",
    },
  });
}
```

### Step 6.2: Aimeow API Integration

**File:** `/src/lib/services/aimeow/aimeow-client.service.ts`

```typescript
static async sendMessage(params: AimeowSendMessageParams): Promise<AimeowMessageResponse> {
  const { clientId, to, message, mediaUrl } = params;

  const payload = {
    phone: to,
    message: message,
  };

  let endpoint = `${AIMEOW_BASE_URL}/api/v1/clients/${clientId}/send-message`;

  if (mediaUrl) {
    endpoint = `${AIMEOW_BASE_URL}/api/v1/clients/${clientId}/send-images`;
    payload.images = [mediaUrl];
    delete payload.message;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    success: true,
    messageId: data.messageId || data.id || `msg_${Date.now()}`,
  };
}
```

---

## 7. CONFIGURATION & ENVIRONMENT VARIABLES

### Required Environment Variables for LLM

```bash
# Z.AI Configuration (Required for customer responses)
ZAI_API_KEY="your-zai-api-key-here"
ZAI_BASE_URL="https://api.z.ai/api/coding/paas/v4/"  # Use /api/coding/ for Coding Plan
ZAI_VISION_MODEL="glm-4.5v"          # For vehicle identification
ZAI_TEXT_MODEL="glm-4.6"             # For descriptions & pricing
API_TIMEOUT_MS="300000"              # 5 minutes timeout

# Aimeow Configuration
AIMEOW_BASE_URL="https://meow.lumiku.com"
AIMEOW_WEBHOOK_SECRET="change-this-to-a-random-secret-for-webhook-verification"

# Webhook Verification
AIMEOW_WEBHOOK_USER_AGENT="Go-http-client"
AIMEOW_WEBHOOK_VERIFY_TOKEN="autolumiku_webhook_2024"
```

### AI Configuration Stored in Database

**WhatsAppAIConfig Model** - Per tenant settings:

```typescript
{
  aiName: "AI Assistant",                    // Name of AI
  aiPersonality: "friendly",                 // friendly, professional, casual
  welcomeMessage: "Halo! 👋 Saya asisten virtual showroom...",
  
  // Behavior Settings
  autoReply: true,                           // Enable auto-reply
  customerChatEnabled: true,                 // Enable customer chat
  staffCommandsEnabled: true,                // Enable staff commands
  
  // Business Hours
  businessHours: {                           // JSON object with hours
    monday: { open: "09:00", close: "17:00" },
    // ... other days
  },
  timezone: "Asia/Jakarta",
  afterHoursMessage: "Kami sedang tutup...",
  
  // LLM Settings
  aiModel: "glm-4-plus",                     // (legacy, uses ZAI_TEXT_MODEL)
  temperature: 0.7,                          // 0-1, higher = more creative
  maxTokens: 1000,                           // Max response length
  
  // Knowledge Base
  customFAQ: [                               // JSON array
    { question: "...", answer: "..." }
  ],
  productKnowledge: {},
  
  // Feature Toggles
  enableVehicleInfo: true,
  enablePriceNegotiation: false,
  enableTestDriveBooking: true,
  enableStaffUpload: true,
  enableStaffStatus: true,
}
```

---

## 8. DATABASE SCHEMA (Relevant Models)

### AimeowAccount
```
id (uuid)                - Primary key
tenantId (uuid)          - FK to Tenant (unique)
apiKey (text)            - Encrypted Aimeow API key
clientId (string, unique)- Aimeow client identifier
phoneNumber (string)     - WhatsApp number (E.164)
isActive (boolean)       - Connection active
connectionStatus (string)- connected, disconnected, qr_ready
lastConnectedAt (datetime)
qrCode (text)            - Last QR code
qrCodeExpiresAt (datetime)
webhookUrl (string)      - Webhook URL for Aimeow
webhookSecret (string)   - Secret for webhook verification
```

### WhatsAppConversation
```
id (uuid)                - Primary key
accountId (uuid)         - FK to AimeowAccount
tenantId (uuid)          - FK to Tenant
customerPhone (string)   - E.164 format
customerName (string)    - Optional customer name
isStaff (boolean)        - Staff conversation flag
conversationType (string)- customer, staff, system
leadId (uuid)            - Optional link to Lead
lastIntent (string)      - Last classified intent
contextData (json)       - Conversation state
conversationState (string)- Multi-step command state
status (string)          - active, escalated, closed
escalatedTo (string)     - User ID if escalated
escalatedAt (datetime)
startedAt (datetime)
lastMessageAt (datetime)
closedAt (datetime)
```

### WhatsAppMessage
```
id (uuid)                - Primary key
conversationId (uuid)    - FK to WhatsAppConversation
tenantId (uuid)          - FK to Tenant
direction (string)       - inbound, outbound
sender (string)          - Phone number or "ai"
senderType (string)      - customer, staff, ai, system
content (text)           - Message text
mediaType (string)       - image, video, document, audio
mediaUrl (text)          - Media URL
mediaThumbnail (text)    - Thumbnail URL
intent (string)          - Detected intent
confidence (float)       - 0-1 confidence score
entities (json)          - Extracted entities
aiResponse (boolean)     - Flag if AI-generated
processingTime (int)     - Milliseconds
aimeowMessageId (string) - Aimeow message ID
aimeowStatus (string)    - sent, delivered, read, failed
deliveredAt (datetime)
readAt (datetime)
createdAt (datetime)
```

### WhatsAppAIConfig
```
id (uuid)                - Primary key
tenantId (uuid)          - FK to Tenant (unique)
accountId (uuid)         - FK to AimeowAccount (unique)
aiName (string)
aiPersonality (string)
welcomeMessage (text)
autoReply (boolean)
customerChatEnabled (boolean)
staffCommandsEnabled (boolean)
businessHours (json)
timezone (string)
afterHoursMessage (text)
aiModel (string)
temperature (float)
maxTokens (int)
customFAQ (json)
productKnowledge (json)
enableVehicleInfo (boolean)
enablePriceNegotiation (boolean)
enableTestDriveBooking (boolean)
enableStaffUpload (boolean)
enableStaffStatus (boolean)
```

### StaffWhatsAppAuth
```
id (uuid)                - Primary key
tenantId (uuid)          - FK to Tenant
phoneNumber (string)     - Staff WhatsApp number
name (string)            - Staff name
isActive (boolean)       - Account active
permissions (string)     - JSON array of permissions
```

---

## 9. COMPLETE END-TO-END FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│ WHATSAPP CUSTOMER SENDS MESSAGE                                     │
└─────────────────────┬───────────────────────────────────────────────┘

                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ AIMEOW RECEIVES MESSAGE & SENDS WEBHOOK                             │
│ POST /api/v1/aimeow/webhook or /api/v1/webhooks/aimeow             │
│ Payload: { clientId, event: "message", data: {...} }              │
└─────────────────────┬───────────────────────────────────────────────┘

                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ WEBHOOK HANDLER                                                      │
│ 1. Verify signature (optional)                                       │
│ 2. Parse JSON payload                                                │
│ 3. Look up account by clientId                                       │
│ 4. Check for duplicates (aimeowMessageId)                            │
└─────────────────────┬───────────────────────────────────────────────┘

                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ MESSAGE ORCHESTRATOR SERVICE                                         │
│ messageOrchestrator.processIncomingMessage(                         │
│   { accountId, tenantId, from, message, messageId }                │
│ )                                                                    │
└─────────────────────┬───────────────────────────────────────────────┘

         ┌───────────┬──────────────┬────────────────┐
         ▼           ▼              ▼                ▼
    [1]            [2]            [3]              [4]
  Get/Create    Save Message   Classify Intent   Route
  Conversation  to Database    (Pattern Matching)  

                                     │
                 ┌───────────────────┼──────────────────────┐
                 ▼                   ▼                      ▼
            SPAM          STAFF COMMAND         CUSTOMER INQUIRY
            (Ignore)      (IsStaff=true)        (IsCustomer=true)
                          │                      │
                          ▼                      ▼
               [5a] StaffCommandService    [5b] WhatsAppAIChatService
                  • Parse command              • Get conversation history
                  • Verify permissions        • Build system prompt:
                  • Execute action              - AI name & personality
                  • Return response             - Showroom info
                                                - Business hours check
                                                - Vehicle inventory
                                                - Custom FAQ
                                              • Build user prompt:
                                                - Conversation history
                                                - Current message
                                              • Call Z.AI LLM API
                                                - Model: glm-4.6
                                                - Temperature, maxTokens
                                              • Get LLM response
                                              • Check escalation
                      │                         │
                      └────────────┬────────────┘
                                   │
                                   ▼
                      [6] Determine if escalate
                         • Check AI confidence
                         • Check for uncertainty
                         • Update conversation
                                   │
                                   ▼
                      [7] Send Response via Aimeow
                         • Get account clientId
                         • Call Aimeow API:
                           POST /api/v1/clients/{clientId}/send-message
                           { phone: to, message: responseText }
                         • Receive messageId
                                   │
                                   ▼
                      [8] Save Outbound Message
                         • Create WhatsAppMessage
                         • Set direction: "outbound"
                         • Set senderType: "ai"
                         • Set aiResponse: true
                         • Store aimeowMessageId
                         • Set aimeowStatus: "sent"
                                   │
                                   ▼
                      [9] Update Conversation
                         • lastMessageAt: now()
                         • lastIntent: classification.intent
                         • If escalated:
                           - escalatedTo: "human"
                           - escalatedAt: now()
                         • status: "active" or "escalated"
                                   │
                                   ▼
                      [10] Return ProcessingResult
                          {
                            success: true,
                            conversationId,
                            intent,
                            responseMessage,
                            escalated
                          }

                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ AIMEOW SENDS WHATSAPP MESSAGE TO CUSTOMER                           │
│ Message displayed in WhatsApp chat                                   │
└─────────────────────────────────────────────────────────────────────┘

                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ AIMEOW TRACKS MESSAGE STATUS                                        │
│ Webhook: { clientId, event: "status", data: { messageId, status } }│
│ Updates aimeowStatus: "delivered", "read"                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. KEY CHARACTERISTICS

### Synchronous Processing
- **No Queue System:** Messages are processed synchronously from webhook receipt to response delivery
- **Blocking Calls:** Each step waits for the previous to complete
- **Real-time Response:** Customer sees response within seconds (LLM latency)

### Error Handling
- **Graceful Degradation:** Fallback message if LLM fails: "Maaf, terjadi gangguan sistem..."
- **Escalation on Error:** Marks conversation as escalated if processing fails
- **Duplicate Prevention:** Checks `aimeowMessageId` to prevent reprocessing

### Scalability Considerations
- **Database Queries:** Minimal; mostly indexed lookups
- **LLM Bottleneck:** Z.AI API call is the longest operation (300s timeout)
- **Conversation History:** Limited to last 10 messages to reduce token usage
- **Business Hours:** Optional; reduces unnecessary LLM calls

### Multi-Tenant Isolation
- All queries filtered by `tenantId`
- Each tenant has separate AimeowAccount and WhatsAppAIConfig
- Conversations and messages are tenant-scoped

---

## 11. LIBRARIES & DEPENDENCIES

### Key Dependencies
- **OpenAI SDK:** `openai@^6.9.1` - Used for Z.AI API calls (OpenAI-compatible)
- **Prisma:** `@prisma/client@^6.19.0` - ORM for database operations
- **Next.js:** `next@^14.2.3` - Framework for API routes
- **Winston:** `winston@^3.13.0` - Logging

### Notable Absence
- **No Queue System:** No Bull, Agenda, Resque, or similar
- **No Cron Jobs:** Business hours are checked at request time
- **No Background Workers:** All processing happens in the HTTP request handler

---

## 12. FLOW SUMMARY

| Step | Service | Input | Output | Duration |
|------|---------|-------|--------|----------|
| 1 | Webhook Handler | HTTP POST | Account lookup | <50ms |
| 2 | Message Orchestrator | Account, Message | Conversation ID | <50ms |
| 3 | Intent Classifier | Message text, Phone | Intent classification | <20ms |
| 4a | Staff Command Service | Command params | Staff response | <100ms |
| 4b | Chat Service | Context, Message | LLM request | <100ms |
| 5 | Z.AI Client | System/user prompts | LLM response | 1-5s |
| 6 | Response Handler | Response text | Aimeow API call | <100ms |
| 7 | Aimeow Client | ClientID, Phone, Message | Message sent | <100ms |
| 8 | Message Saver | Response data | DB record | <50ms |
| **Total** | | | | **1-6 seconds** |

---

## 13. API ENDPOINTS FOR MANAGEMENT

### Configuration
- `GET/PUT /api/v1/whatsapp-ai/config` - Get/update AI config
- `POST /api/v1/whatsapp-ai/initialize` - Start QR code flow
- `GET /api/v1/whatsapp-ai/status` - Check connection status
- `POST /api/v1/whatsapp-ai/disconnect` - Disconnect WhatsApp

### Monitoring
- `GET /api/v1/whatsapp-ai/conversations` - List conversations
- `GET /api/v1/whatsapp-ai/conversations/{id}/messages` - Get conversation history
- `GET /api/v1/whatsapp-ai/stats` - Get statistics
- `GET /api/v1/whatsapp-ai/analytics` - Get analytics data

### Staff Management
- `GET/POST /api/v1/whatsapp-ai/staff` - List/create staff
- `GET/PUT/DELETE /api/v1/whatsapp-ai/staff/{id}` - Manage staff

---

## 14. CONCLUSION

The AutoLumiku WhatsApp AI system provides a sophisticated real-time message processing pipeline that:

1. **Receives** messages via Aimeow webhook
2. **Classifies** intent using pattern matching
3. **Routes** to either AI (customer) or command processor (staff)
4. **Generates** AI responses using Z.AI's GLM-4.6 model with dynamic context
5. **Sends** responses back through Aimeow
6. **Tracks** all messages and conversations in the database

The system is **synchronous, tenant-isolated, and production-ready** with proper error handling, escalation logic, and business rules enforcement.

