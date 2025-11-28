# Epic 8: WhatsApp AI Automation - Implementation Plan (REVISED)

**Project:** autolumiku
**Epic:** WhatsApp AI Automation per Showroom
**Version:** 2.0 (Simplified - No Image Detection)
**Author:** Claude & Yoppi
**Date:** 2025-11-27
**Status:** Planning → Ready for Implementation

---

## 📋 EXECUTIVE SUMMARY

### Goal
Enable setiap showroom untuk memiliki dedicated WhatsApp AI assistant yang:
- ✅ Jawab pertanyaan customer otomatis (Z.ai powered)
- ✅ Handle staff operations via command (upload mobil, update status, check inventory)
- ✅ Terpisah per showroom (complete data isolation)
- ✅ Easy setup via QR code scanning

### Key Changes from v1.0
- ❌ **REMOVED:** AI image detection/analysis untuk upload mobil
- ✅ **SIMPLIFIED:** Staff upload foto + text description → AI generate content (like existing dashboard)
- ✅ **FOCUS:** Text-based interaction only (no computer vision)

### Architecture Fit
- Menggunakan Aimeow WhatsApp API yang sudah ada
- Menggunakan Z.ai (GLM-4) yang sudah terintegrasi di autolumiku
- Reuse existing vehicle upload logic dari dashboard
- Tinggal tambah orchestration layer + command parser

---

## 🎯 FEATURE SCOPE

### Customer Features
1. **AI Chat Assistant** (24/7)
   - Tanya jawab tentang mobil (spek, harga, kondisi)
   - Perbandingan mobil
   - Info pembiayaan/kredit
   - Jadwal test drive
   - Escalation ke sales person

2. **Dual Contact Option** (di website catalog)
   - 🤖 Chat dengan AI (instant, 24/7)
   - 👤 Chat dengan Sales (personal)

### Staff Features (via WhatsApp Command)
1. **Upload Mobil**
   ```
   Staff: "#upload mobil"
   AI: "Kirim foto mobil (bisa beberapa sekaligus)"
   Staff: [sends 5-10 photos]
   AI: "Foto diterima! Kirim detail dengan format:
        tahun: 2020
        merk: Toyota
        model: Avanza
        kilometer: 35000
        harga: 180000000
        transmisi: manual
        bahan_bakar: bensin
        warna: silver
        deskripsi: kondisi bagus, service rutin"
   Staff: [sends details]
   AI: "Processing... AI generate deskripsi lengkap..."
   AI: "Preview: [generated content]
        Ketik 'approve' untuk publish"
   Staff: "approve"
   AI: "✅ Published! VH-156
        Link: autolumiku.com/catalog/showroom/vh-156"
   ```

2. **Update Status**
   ```
   Staff: "VH-156 sold"
   AI: "✅ Status updated: SOLD
        Perlu info customer? Ketik: lead [nama] [hp]"

   Staff: "VH-145 booking"
   AI: "✅ Status updated: BOOKED"
   ```

3. **Check Inventory**
   ```
   Staff: "koleksi toyota"
   AI: "📋 Toyota (7 mobil):
        VH-023 - Avanza 2020 | Rp 180jt | AVAILABLE
        VH-045 - Fortuner 2018 | Rp 450jt | BOOKED
        ..."

   Staff: "mobil available"
   AI: "📊 Available: 42 mobil
        Total nilai: Rp 15.8 M"
   ```

4. **Statistics**
   ```
   Staff: "stats penjualan"
   AI: "📊 Penjualan Bulan Ini:
        - Total: 12 unit
        - Revenue: Rp 3.8 M
        - Top seller: Toyota Avanza (3 unit)"
   ```

### Admin Features (Dashboard)
1. **WhatsApp Setup**
   - Scan QR code untuk connect WhatsApp
   - Configure AI name & personality
   - Set business hours
   - Add custom FAQ

2. **Monitoring**
   - View all conversations (customer & staff)
   - Takeover conversation (AI → Human)
   - Analytics dashboard

---

## 🏗️ SIMPLIFIED ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│              AUTOLUMIKU DASHBOARD                        │
│  Admin: Scan QR, Configure AI, Monitor Conversations    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         WHATSAPP AI ORCHESTRATION LAYER                  │
│                                                           │
│  ┌──────────────┐    ┌─────────────┐   ┌─────────────┐ │
│  │   Message    │───▶│   Intent    │──▶│  Response   │ │
│  │   Router     │    │ Classifier  │   │  Generator  │ │
│  └──────────────┘    └─────────────┘   └─────────────┘ │
│         │                    │                  │        │
│         ▼                    ▼                  ▼        │
│  [Is Staff?]        [Customer/Command]    [Z.ai Agent]  │
│         │                    │                  │        │
│         ├─Staff──────▶ Command Handler          │        │
│         └─Customer────────────────────▶ AI Chat         │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              AIMEOW SERVICE LAYER                        │
│  - Multi-client management (1 per showroom)             │
│  - QR code generation                                    │
│  - Message send/receive (TEXT ONLY)                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
              [ WhatsApp ]
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   [ Customer ]              [ Staff ]
```

---

## 📊 DATABASE SCHEMA

### New Models

```prisma
// Aimeow WhatsApp connection per showroom
model AimeowAccount {
  id              String   @id @default(uuid())
  tenantId        String   @unique

  // Connection
  clientId        String   @unique
  phoneNumber     String
  apiKey          String   @db.Text // Encrypted

  // Status
  isActive        Boolean  @default(false)
  connectionStatus String  @default("disconnected")
  lastConnectedAt DateTime?

  // QR Code
  qrCode          String?  @db.Text
  qrCodeExpiresAt DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  aiConfig        WhatsAppAIConfig?
  conversations   AIConversation[]
}

// AI configuration per showroom
model WhatsAppAIConfig {
  id              String   @id @default(uuid())
  tenantId        String   @unique
  accountId       String   @unique

  // AI Identity
  aiName          String   @default("AI Assistant")
  aiPersonality   String   @default("friendly")
  welcomeMessage  String   @db.Text

  // Features
  customerChatEnabled Boolean @default(true)
  staffCommandsEnabled Boolean @default(true)

  // Business Hours
  businessHours   Json?
  timezone        String   @default("Asia/Jakarta")
  afterHoursMessage String? @db.Text

  // Custom FAQ
  customFAQ       Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  account         AimeowAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

// Conversation tracking
model AIConversation {
  id              String   @id @default(uuid())
  accountId       String
  tenantId        String

  // Participant
  customerPhone   String
  customerName    String?
  isStaff         Boolean  @default(false)

  // Lead association
  leadId          String?

  // Context & State
  lastIntent      String?
  contextData     Json?
  conversationState String? // For multi-step commands

  // Status
  status          String   @default("active") // active, escalated, closed
  escalatedTo     String?
  escalatedAt     DateTime?

  // Timestamps
  startedAt       DateTime @default(now())
  lastMessageAt   DateTime @default(now())
  closedAt        DateTime?

  messages        AIMessage[]
  lead            Lead?    @relation(fields: [leadId], references: [id])
  account         AimeowAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([tenantId, customerPhone])
  @@index([tenantId, lastMessageAt])
}

// Individual messages
model AIMessage {
  id              String   @id @default(uuid())
  conversationId  String
  tenantId        String

  // Message
  direction       String   // inbound, outbound
  sender          String   // phone or "ai"
  senderType      String   // customer, staff, ai
  content         String   @db.Text

  // AI Processing
  intent          String?
  confidence      Float?
  entities        Json?
  aiResponse      Boolean  @default(false)

  // Aimeow tracking
  aimeowMessageId String?  @unique
  aimeowStatus    String?  // sent, delivered, read, failed

  createdAt       DateTime @default(now())

  conversation    AIConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
}

// Staff authentication for commands
model StaffWhatsAppAuth {
  id              String   @id @default(uuid())
  tenantId        String
  userId          String

  phoneNumber     String   @unique
  isActive        Boolean  @default(true)
  role            String   @default("staff")

  // Permissions
  canUploadVehicle Boolean @default(true)
  canUpdateStatus Boolean @default(true)
  canViewAnalytics Boolean @default(false)

  // Audit
  lastCommandAt   DateTime?
  commandCount    Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, phoneNumber])
}

// Command execution log
model StaffCommandLog {
  id              String   @id @default(uuid())
  tenantId        String
  staffPhone      String

  // Command
  command         String
  commandType     String
  parameters      Json?

  // Result
  success         Boolean
  resultMessage   String?  @db.Text
  error           String?  @db.Text

  // Resources
  vehicleId       String?
  leadId          String?

  executedAt      DateTime @default(now())

  @@index([tenantId, executedAt])
}
```

**Schema Stats:**
- New Models: 7
- Total Fields: ~85
- Indexes: 10

---

## 🚀 IMPLEMENTATION PHASES

### **FASE 0: Preparation** (3-5 hari)

#### Deliverables:
- [ ] Setup Aimeow account & get API credentials
- [ ] Test Aimeow API basic operations
- [ ] Create database migration files
- [ ] Setup Z.ai prompt templates
- [ ] Create Epic 8 in BMad tracking

#### Files to Create:
```
docs/sprint-artifacts/
├── epic-8-whatsapp-ai-implementation-plan.md (this file)
└── epic-8.md (epic breakdown dengan stories)

prisma/migrations/
└── [timestamp]_add_whatsapp_ai_models/
    └── migration.sql
```

---

### **FASE 1: Core Infrastructure** (7-10 hari)

#### 1.1 Aimeow Service Layer
**File:** `src/lib/services/aimeow/aimeow-client.service.ts`

```typescript
export class AimeowClientService {
  async createClient(tenantId: string): Promise<{ clientId: string; qrCode: string }>
  async getClientStatus(clientId: string): Promise<ConnectionStatus>
  async sendTextMessage(clientId: string, to: string, message: string): Promise<void>
  async deleteClient(clientId: string): Promise<void>
  async refreshQRCode(clientId: string): Promise<string>
}
```

#### 1.2 Webhook Handler
**File:** `src/app/api/v1/webhooks/aimeow/route.ts`

```typescript
export async function POST(req: Request) {
  // 1. Verify signature
  // 2. Parse message payload
  // 3. Route to orchestrator
  // 4. Return 200 OK
}
```

#### 1.3 Admin UI - WhatsApp Setup
**Pages:**
```
src/app/dashboard/whatsapp-ai/
├── page.tsx              (overview & status)
├── setup/
│   └── page.tsx          (QR code scanning wizard)
├── configuration/
│   └── page.tsx          (AI settings)
└── conversations/
    └── page.tsx          (monitoring)
```

**Key Features:**
- Display QR code untuk scanning
- Real-time connection status
- Configure AI name, welcome message, business hours
- Add staff phone numbers
- View conversation history

#### Deliverables:
- [ ] Aimeow service working (send/receive messages)
- [ ] Webhook endpoint receiving messages correctly
- [ ] Admin dapat scan QR dan connect WhatsApp
- [ ] Connection status monitoring dashboard

---

### **FASE 2: AI Customer Assistant** (10-14 hari)

#### 2.1 AI Orchestrator
**File:** `src/lib/ai/whatsapp-ai-orchestrator.service.ts`

```typescript
export class WhatsAppAIOrchestrator {
  async processIncomingMessage(
    tenantId: string,
    from: string,
    message: string
  ): Promise<void> {
    // 1. Check if sender is staff
    const isStaff = await this.isStaffMember(from, tenantId);

    if (isStaff) {
      // Route to command handler
      await this.commandHandler.handle(tenantId, from, message);
    } else {
      // Route to AI customer assistant
      await this.customerAssistant.handle(tenantId, from, message);
    }
  }
}
```

#### 2.2 Intent Classifier
**File:** `src/lib/ai/intent-classifier.service.ts`

```typescript
export class IntentClassifier {
  async classify(message: string, context: Context): Promise<Intent> {
    // Use simple pattern matching + keyword detection
    // Intents: vehicle_inquiry, price_inquiry, financing,
    //          test_drive, contact_sales, greeting, etc.
  }
}
```

#### 2.3 Z.ai Customer Assistant
**File:** `src/lib/ai/customer-assistant.service.ts`

```typescript
export class CustomerAssistant {
  async handle(tenantId: string, from: string, message: string): Promise<void> {
    // 1. Get conversation context
    // 2. Get showroom data (vehicles, business info)
    // 3. Build prompt with context
    // 4. Call Z.ai (GLM-4)
    // 5. Send response via Aimeow
    // 6. Log conversation
    // 7. Create/update lead if needed
  }

  async buildSystemPrompt(tenant: Tenant): Promise<string> {
    return `
Anda adalah ${tenant.aiName}, asisten virtual ${tenant.showroomName}.

TUGAS:
- Bantu customer cari mobil sesuai kebutuhan
- Jawab pertanyaan spek, harga, kondisi
- Info pembiayaan dan test drive
- Sambungkan ke sales jika perlu

GAYA:
- Ramah, profesional, helpful
- Bahasa Indonesia natural
- Emoji secukupnya 😊
- Respons ringkas (max 300 kata)

DATA SHOWROOM:
${this.formatShowroomData(tenant)}

INVENTORY:
${this.formatVehicleList(tenant.vehicles)}

Respond to: ${message}
    `;
  }
}
```

#### 2.4 Website Integration
**Update:** `src/components/catalog/VehicleCard.tsx`

```typescript
// Add dual contact buttons
<div className="space-y-2">
  <Button onClick={() => contactAI(vehicle)}>
    🤖 Chat dengan AI {aiName}
    <span className="text-xs">Jawab instan 24/7</span>
  </Button>

  <Button onClick={() => contactSales(vehicle)} variant="outline">
    👤 Chat dengan Sales
  </Button>
</div>
```

#### Deliverables:
- [ ] Customer dapat chat dengan AI via WhatsApp
- [ ] AI jawab pertanyaan dengan akurat (pakai Z.ai)
- [ ] AI detect intent & respond contextually
- [ ] Lead auto-created untuk new inquiries
- [ ] Escalation to sales working
- [ ] Website catalog punya tombol "Chat AI"

---

### **FASE 3: Staff Command Interface** (10-14 hari)

#### 3.1 Command Parser
**File:** `src/lib/ai/command-parser.service.ts`

```typescript
export class CommandParser {
  parse(message: string): Command | null {
    // Pattern matching untuk commands:
    // - #upload mobil
    // - VH-XXX sold|booking|available
    // - koleksi [brand]
    // - stats penjualan
    // - mobil available

    const patterns = {
      upload: /^#upload mobil$/i,
      status: /^(VH-\d+)\s+(sold|booking|available)$/i,
      inventory: /^(koleksi|mobil)\s+(.+)$/i,
      stats: /^stats?\s*(penjualan|inventory)?$/i,
    };

    // Return parsed command with type & parameters
  }
}
```

#### 3.2 Upload Command Handler
**File:** `src/lib/ai/commands/upload-vehicle.handler.ts`

```typescript
export class UploadVehicleHandler {
  async start(conversationId: string): Promise<void> {
    // Set state: waiting_photos
    await this.sendMessage("Kirim foto mobil (bisa beberapa sekaligus)");
  }

  async handlePhotos(conversationId: string, photos: string[]): Promise<void> {
    // Save photos to context
    // Set state: waiting_details
    await this.sendMessage(`
Foto diterima (${photos.length} foto)!
Kirim detail dengan format:

tahun: 2020
merk: Toyota
model: Avanza
kilometer: 35000
harga: 180000000
transmisi: manual
bahan_bakar: bensin
warna: silver
deskripsi: kondisi bagus, service rutin
    `);
  }

  async handleDetails(conversationId: string, text: string): Promise<void> {
    // Parse key-value pairs
    const details = this.parseDetails(text);

    // Validate required fields
    if (!this.validate(details)) {
      await this.sendMessage("❌ Ada field yang kurang: " + missingFields);
      return;
    }

    // Generate AI description (reuse existing service)
    const aiDescription = await this.vehicleAIService.generateDescription(details);

    // Show preview
    const preview = this.formatPreview(details, aiDescription);
    await this.sendMessage(preview + "\n\nKetik 'approve' untuk publish");

    // Set state: waiting_approval
  }

  async handleApproval(conversationId: string): Promise<void> {
    // Get photos & details from context
    // Upload photos (reuse existing logic)
    // Create vehicle in database
    // Generate display ID
    // Send confirmation

    await this.sendMessage(`
✅ Mobil berhasil di-publish!

Display ID: ${vehicle.displayId}
Link: ${catalogUrl}

📊 Stats koleksi:
- Total: ${totalVehicles} mobil
- Nilai inventory: Rp ${totalValue}
    `);

    // Clear state
  }
}
```

#### 3.3 Status Update Handler
**File:** `src/lib/ai/commands/update-status.handler.ts`

```typescript
export class UpdateStatusHandler {
  async execute(vehicleId: string, newStatus: string): Promise<void> {
    // Find vehicle
    const vehicle = await this.vehicleService.getByDisplayId(vehicleId);

    // Update status
    await this.vehicleService.updateStatus(vehicle.id, newStatus);

    // Send confirmation
    await this.sendMessage(`
✅ Status updated!

${vehicle.displayId} - ${vehicle.name}
${oldStatus} → ${newStatus}

${newStatus === 'SOLD' ? 'Perlu info customer? Ketik: lead [nama] [hp]' : ''}
    `);
  }
}
```

#### 3.4 Inventory Check Handler
**File:** `src/lib/ai/commands/check-inventory.handler.ts`

```typescript
export class CheckInventoryHandler {
  async execute(filter: string, tenantId: string): Promise<void> {
    // Query vehicles with filter
    const vehicles = await this.vehicleService.getByFilter(tenantId, filter);

    // Format response
    const response = this.formatVehicleList(vehicles);
    await this.sendMessage(response);
  }

  formatVehicleList(vehicles: Vehicle[]): string {
    return `
📋 ${filter} (${vehicles.length} mobil):

${vehicles.map((v, i) =>
  `${i+1}. ${v.displayId} - ${v.name} | Rp ${v.price}jt | ${v.status}`
).join('\n')}

Total nilai: Rp ${totalValue}
    `;
  }
}
```

#### 3.5 Stats Handler
**File:** `src/lib/ai/commands/stats.handler.ts`

```typescript
export class StatsHandler {
  async getSalesStats(tenantId: string, period: string): Promise<string> {
    // Query sales data
    const stats = await this.analyticsService.getSalesStats(tenantId, period);

    return `
📊 Penjualan ${period}:
- Total: ${stats.totalSales} unit
- Revenue: Rp ${stats.revenue}
- Top seller: ${stats.topSeller}
- Conversion rate: ${stats.conversionRate}%
    `;
  }

  async getInventoryStats(tenantId: string): Promise<string> {
    const stats = await this.vehicleService.getInventoryStats(tenantId);

    return `
📊 Inventory Stats:
- Available: ${stats.available} mobil
- Booked: ${stats.booked} mobil
- Sold this month: ${stats.soldThisMonth} mobil
- Total value: Rp ${stats.totalValue}
    `;
  }
}
```

#### Deliverables:
- [ ] Staff dapat upload mobil via WhatsApp (multi-step flow)
- [ ] Staff dapat update status (sold, booking, available)
- [ ] Staff dapat check inventory dengan filter
- [ ] Staff dapat get statistics
- [ ] All commands logged untuk audit
- [ ] Conversation state management working

---

### **FASE 4: Advanced Features & Polish** (7-10 hari)

#### 4.1 AI Configuration UI
**Page:** `src/app/dashboard/whatsapp-ai/configuration/page.tsx`

Features:
- AI name & personality
- Welcome message editor
- Business hours configurator
- Custom FAQ management (add/edit/delete)
- Feature toggles (customer chat, staff commands)
- Test AI (chat simulator)

#### 4.2 Conversation Monitoring
**Page:** `src/app/dashboard/whatsapp-ai/conversations/page.tsx`

Features:
- List all conversations (filter: customer/staff, active/closed)
- View full conversation history
- Real-time updates
- Takeover conversation (switch AI → Human)
- Export conversation logs

#### 4.3 Analytics Dashboard
**Page:** `src/app/dashboard/whatsapp-ai/analytics/page.tsx`

Metrics:
- Total conversations
- Customer vs Staff interactions
- AI resolution rate (no human needed)
- Average response time
- Top intents detected
- Escalation rate
- Lead conversion from AI chat
- Command usage stats (for staff)

#### 4.4 Notifications
**Service:** `src/lib/services/notification.service.ts`

Notify admin when:
- New customer inquiry (high value lead)
- Customer requests human sales
- AI confidence low (needs review)
- Staff uploads vehicle
- WhatsApp connection lost

#### Deliverables:
- [ ] Complete configuration UI
- [ ] Conversation monitoring working
- [ ] Analytics dashboard with key metrics
- [ ] Real-time notifications
- [ ] Export functionality

---

### **FASE 5: Testing & Optimization** (5-7 hari)

#### Test Scenarios:

**Customer Flows:**
1. Browse catalog → Click AI chat → Ask about car → Get info → Schedule test drive
2. Ask AI to compare cars → Get comparison → Request financing info → Escalate to sales
3. Ask business hours → Ask location → Get map link

**Staff Flows:**
1. Send "#upload mobil" → Upload 8 photos → Send details → Preview → Approve → Published
2. Send "VH-156 sold" → Status updated → Send "lead Budi 081234" → Lead created
3. Send "koleksi toyota" → Get list → Send "detail VH-045" → Get full info
4. Send "stats penjualan" → Get weekly stats

**Edge Cases:**
1. Invalid command → Helpful error message
2. Missing required fields → Clear validation message
3. Duplicate vehicle upload → Warning & confirmation
4. Connection lost during upload → Resume from last step
5. Customer sends very long message → Truncate & respond
6. Staff not authorized → Access denied message

**Load Testing:**
- 50 concurrent conversations
- 100 messages/minute
- Response time target: < 3 seconds
- Zero message loss

#### Optimization:
- [ ] Database query optimization (add indexes)
- [ ] Z.ai prompt tuning for better responses
- [ ] Response caching for common questions
- [ ] Message queueing with Bull/BullMQ
- [ ] Error handling & retry logic

#### Deliverables:
- [ ] All features tested & passing
- [ ] Performance benchmarks met
- [ ] Bug fixes completed
- [ ] Documentation updated

---

### **FASE 6: Documentation & Launch** (3-5 hari)

#### Documentation:

**1. Admin Guide**
```
docs/features/whatsapp-ai-admin-guide.md

Topics:
- Setup WhatsApp (QR scan)
- Configure AI settings
- Add staff members
- Monitor conversations
- View analytics
- Troubleshooting
```

**2. Staff Guide**
```
docs/features/whatsapp-ai-staff-guide.md

Topics:
- Command reference
- Upload vehicle step-by-step
- Update status commands
- Check inventory
- Get statistics
- Best practices
```

**3. Technical Documentation**
```
docs/features/whatsapp-ai-technical.md

Topics:
- Architecture overview
- Database schema
- API endpoints
- Service layer
- Webhook handling
- Error handling
- Security considerations
```

#### Launch Checklist:
- [ ] Production database migration ready
- [ ] Environment variables documented
- [ ] Aimeow webhook secured (HTTPS + signature verification)
- [ ] Monitoring setup (logs, metrics, alerts)
- [ ] Rate limiting configured
- [ ] Error tracking integrated (Sentry)
- [ ] Backup & rollback plan ready

#### Training:
- [ ] Video tutorial for admin (10 min)
- [ ] Video tutorial for staff (5 min)
- [ ] Command reference card (printable PDF)
- [ ] FAQ document

#### Deliverables:
- [ ] Complete documentation
- [ ] Training materials ready
- [ ] Production deployment complete
- [ ] Monitoring active
- [ ] Support team briefed

---

## 📁 FILE STRUCTURE

```
autolumiku/
├── src/
│   ├── lib/
│   │   ├── services/
│   │   │   └── aimeow/
│   │   │       ├── aimeow-client.service.ts       NEW
│   │   │       └── webhook-handler.service.ts     NEW
│   │   └── ai/
│   │       ├── whatsapp-ai-orchestrator.service.ts  NEW
│   │       ├── intent-classifier.service.ts         NEW
│   │       ├── customer-assistant.service.ts        NEW
│   │       ├── command-parser.service.ts            NEW
│   │       ├── conversation-state.service.ts        NEW
│   │       └── commands/
│   │           ├── upload-vehicle.handler.ts        NEW
│   │           ├── update-status.handler.ts         NEW
│   │           ├── check-inventory.handler.ts       NEW
│   │           └── stats.handler.ts                 NEW
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── webhooks/
│   │   │   │   └── aimeow/route.ts                  NEW
│   │   │   ├── whatsapp-ai/
│   │   │   │   ├── accounts/route.ts                NEW
│   │   │   │   ├── accounts/[id]/route.ts           NEW
│   │   │   │   ├── qr/route.ts                      NEW
│   │   │   │   └── conversations/route.ts           NEW
│   │   │   └── staff-auth/route.ts                  NEW
│   │   └── dashboard/
│   │       └── whatsapp-ai/
│   │           ├── page.tsx                         NEW
│   │           ├── setup/page.tsx                   NEW
│   │           ├── configuration/page.tsx           NEW
│   │           ├── conversations/page.tsx           NEW
│   │           └── analytics/page.tsx               NEW
│   └── components/
│       ├── catalog/
│       │   └── VehicleCard.tsx                  MODIFY
│       └── whatsapp-ai/
│           ├── QRCodeDisplay.tsx                    NEW
│           ├── ConversationList.tsx                 NEW
│           ├── ConversationView.tsx                 NEW
│           ├── AIConfigForm.tsx                     NEW
│           └── StaffAuthManager.tsx                 NEW
├── prisma/
│   ├── schema.prisma                            MODIFY
│   └── migrations/
│       └── [timestamp]_add_whatsapp_ai_models/  NEW
├── docs/
│   ├── sprint-artifacts/
│   │   ├── epic-8-whatsapp-ai-implementation-plan.md  NEW
│   │   └── epic-8.md                                  NEW
│   └── features/
│       ├── whatsapp-ai-admin-guide.md                 NEW
│       ├── whatsapp-ai-staff-guide.md                 NEW
│       └── whatsapp-ai-technical.md                   NEW
└── .env                                         UPDATE
    AIMEOW_API_URL=https://meow.lumiku.com
    AIMEOW_API_KEY=your-api-key
    AIMEOW_WEBHOOK_SECRET=your-webhook-secret
```

**File Stats:**
- New Files: ~25
- Modified Files: ~3
- New Lines of Code: ~3,500-4,000
- Documentation Pages: 5

---

## 💰 COST ESTIMATE

### Development Time:
```
Fase 0: Preparation         =   4 hari
Fase 1: Infrastructure      =   9 hari
Fase 2: AI Customer         =  12 hari
Fase 3: Staff Commands      =  12 hari
Fase 4: Advanced Features   =   9 hari
Fase 5: Testing             =   6 hari
Fase 6: Documentation       =   4 hari
────────────────────────────────────
TOTAL:                      =  56 hari (~2.5 months)
```

### Operational Costs (per showroom/month):
```
1. Aimeow WhatsApp API:
   Estimate: $10-30/showroom

2. Z.ai (GLM-4) API:
   Estimate: $0.01/message
   1000 msgs = $10

3. Infrastructure:
   Minimal (database storage)

TOTAL: ~$20-50/showroom/month
```

### ROI per Showroom:
```
Customer Inquiries: 200/month
Conversion without AI: 10% = 20 sales
Conversion with AI: 15% = 30 sales

Additional Sales: 10 sales
Profit per Sale: Rp 5,000,000
Additional Revenue: Rp 50,000,000/month

Cost: ~Rp 700,000/month
Net Benefit: Rp 49,300,000/month

ROI: 7,000%+ 🚀
```

---

## ⚠️ RISKS & MITIGATIONS

### Risk 1: Aimeow Service Downtime
- **Mitigation:** Health monitoring, auto-reconnect, fallback to wa.me

### Risk 2: AI Response Quality
- **Mitigation:** Prompt engineering, confidence scoring, human escalation

### Risk 3: WhatsApp Policy Violations
- **Mitigation:** Follow WhatsApp Business Policy, no spam, rate limiting

### Risk 4: Staff Command Misuse
- **Mitigation:** Authentication, authorization, audit logs, rate limiting

### Risk 5: Data Privacy
- **Mitigation:** Encryption, HTTPS only, UU PDP compliance, audit logs

---

## 📊 SUCCESS METRICS

### Customer Metrics:
- Response Time: < 3 seconds (target: 2s)
- AI Resolution Rate: > 70%
- Customer Satisfaction: > 4.0/5.0
- Escalation Rate: < 30%
- Lead Conversion: +5% (10% → 15%)

### Staff Metrics:
- Upload Time: 5 min (vs 15 min manual)
- Command Success Rate: > 95%
- Staff Adoption: > 80%
- Time Saved: 2 hours/day per staff

### Business Metrics:
- Showroom Adoption: > 80%
- Message Volume: 1000+/showroom/month
- Revenue Impact: +Rp 50M/month per showroom

### Technical Metrics:
- Uptime: 99.5%
- API Response: < 500ms (p95)
- AI Latency: < 3 seconds
- Error Rate: < 1%

---

## 🚀 NEXT STEPS

### Immediate Actions:
1. ✅ Review & approve this plan
2. ✅ Setup Aimeow account (get API credentials)
3. ✅ Create Epic 8 stories in BMad
4. ✅ Update workflow-status.yaml
5. ✅ Start Fase 0 implementation

### Phase Kickoff:
- **Fase 0 Start:** Ready to begin
- **Target Launch:** ~2.5 months
- **First Pilot:** 1 showroom after Fase 3

---

## 📝 REVISION HISTORY

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-27 | Initial plan with image detection | Claude |
| 2.0 | 2025-11-27 | **SIMPLIFIED:** Removed image detection, text-only upload | Claude & Yoppi |

---

**Status:** ✅ Ready for Implementation
**Next:** Create Epic 8 stories & update BMad tracking
