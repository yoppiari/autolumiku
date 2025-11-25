# Vehicle Upload with AI Feature

## Overview

Fitur upload kendaraan menggunakan AI z.ai GLM-4.6 untuk membantu showroom dalam membuat listing kendaraan dengan cepat dan akurat, termasuk **analisis harga market**.

## Key Features

### 1. AI-Powered Vehicle Identification
- Input minimal: "Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt"
- AI akan mengidentifikasi:
  - Make (Toyota)
  - Model (Avanza)
  - Variant (1.3 G AT)
  - Year, Transmission Type, Fuel Type, Color, Mileage

### 2. **Price Analysis** (Fitur Unggulan!)
- AI membandingkan harga user dengan market price Indonesia
- Memberikan AI Suggested Price
- Market Range (min-max price)
- Price Confidence Score
- Detailed Recommendation dengan color-coded alert:
  - 🟢 **Green**: Harga sesuai market (±10%)
  - 🔴 **Red**: Harga terlalu rendah (>10% di bawah market)
  - 🟠 **Orange**: Harga terlalu tinggi (>10% di atas market)

### 3. Auto-Generated Descriptions
- Deskripsi Bahasa Indonesia (100+ kata)
- Deskripsi English (100+ words)
- SEO-friendly dan menarik

### 4. Feature Extraction
- AI extract fitur-fitur standar berdasarkan model dan variant
- Contoh: AC, Power Window, Airbag, ABS, dll.

### 5. Specifications
- Engine Capacity
- Seating Capacity
- Drive Type

### 6. Review & Edit
- User dapat review semua data
- Edit sebelum save
- AI Confidence Score
- AI Reasoning

## Technical Implementation

### Architecture

```
User Input → AI API → Parse & Validate → Review UI → Save as DRAFT
```

### Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: z.ai GLM-4.6 (text) & GLM-4.5V (vision)
- **Database**: PostgreSQL + Prisma ORM

### Files Structure

```
src/
├── lib/ai/
│   ├── zai-client.ts              # Z.AI API client wrapper
│   └── vehicle-ai-service.ts      # Vehicle AI business logic
├── app/api/v1/vehicles/
│   ├── route.ts                   # GET & POST vehicles
│   └── ai-identify/route.ts       # AI identification endpoint
└── app/dashboard/vehicles/
    └── page.tsx                   # Upload UI with price analysis
```

### API Endpoints

#### POST /api/v1/vehicles/ai-identify
Generate vehicle data from user description

**Request:**
```json
{
  "userDescription": "Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt",
  "photos": []  // Optional: base64 images
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "make": "Toyota",
    "model": "Avanza",
    "year": 2020,
    "variant": "1.3 G AT",
    "price": 13000000000,
    "aiSuggestedPrice": 23500000000,
    "priceConfidence": 95,
    "priceAnalysis": {
      "marketRange": {
        "min": 23000000000,
        "max": 24500000000
      },
      "factors": ["Tahun 2020", "KM rendah", ...],
      "recommendation": "Harga terlalu rendah..."
    },
    "descriptionId": "...",
    "descriptionEn": "...",
    "features": [...],
    "aiConfidence": 90
  }
}
```

#### POST /api/v1/vehicles
Save vehicle to database

**Request:**
```json
{
  "tenantId": "uuid",
  "userId": "uuid",
  "make": "Toyota",
  "model": "Avanza",
  "year": 2020,
  "price": 13000000000,
  "status": "DRAFT",
  // ... other fields
}
```

## Configuration

### Environment Variables (.env.local)

```env
# Z.AI API Configuration
ZAI_API_KEY="your-api-key"
ZAI_BASE_URL="https://api.z.ai/api/coding/paas/v4/"
ZAI_TEXT_MODEL="glm-4.6"
ZAI_VISION_MODEL="glm-4.5v"
API_TIMEOUT_MS="300000"

# Vehicle Upload Settings
MAX_PHOTOS_PER_VEHICLE=30
```

## Usage Flow

### 1. Upload Photos & Input Description
User navigates to `/dashboard/vehicles`:

**Option A: With Photos**
- Drag & drop atau click upload (max 30 photos)
- AI akan analisis 5 foto pertama
- Masukkan deskripsi tambahan (opsional)

**Option B: Text Only**
- Masukkan deskripsi lengkap:
```
"Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt"
```

### 2. AI Processing (20-30 seconds)
- Parsing input
- Identifying vehicle details
- **Analyzing market price**
- Generating descriptions
- Extracting features

### 3. Review with Price Analysis
UI menampilkan:
- ⚠️ **Price Analysis Alert** (color-coded)
  - Harga User vs AI Suggested
  - Percentage difference
  - Market Range
  - Detailed recommendation
  - Factors yang mempengaruhi harga

- **Basic Information** (editable)
  - Make, Model, Year, Variant
  - Transmission, Fuel Type, Color
  - Mileage, Price

- **Descriptions** (editable)
  - Indonesian description
  - English description

- **Features & Specifications**
  - Auto-extracted features
  - Engine, seating, drive type

- **AI Metadata**
  - Confidence score
  - AI reasoning

### 4. Save as DRAFT
User dapat:
- Edit data sebelum save
- Save sebagai DRAFT
- Atau cancel dan input ulang

## Price Analysis Example

### Case 1: Harga Terlalu Rendah
```
Input: "Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt"

⚠️ Analisis Harga
Harga Anda: Rp 130 juta (-44.7%)
Harga AI Recommended: Rp 235 juta (Confidence: 95%)
Market Range: Rp 230 - 245 juta

Recommendation:
Harga yang dimasukkan (Rp 130jt) jauh di bawah harga pasar
untuk model tahun 2020. Harga ini mungkin cocok untuk unit
tahun 2013-2015. Disarankan untuk menyesuaikan harga ke
kisaran Rp 230-245 juta agar sesuai dengan nilai pasar.

Factors:
• Tahun kendaraan masih muda (2020)
• Kilometer sangat rendah (20.000 KM)
• Model paling laku (Toyota Avanza)
• Varian populer (1.3 G AT)
```

### Case 2: Harga Sesuai Market
```
Input: "Avanza 2020 AT, KM 20.000, Hitam, Rp 235jt"

✅ Analisis Harga
Harga Anda: Rp 235 juta (+0.0%)
Harga AI Recommended: Rp 235 juta (Confidence: 95%)
Market Range: Rp 230 - 245 juta

Recommendation:
Harga sangat kompetitif dan sesuai dengan market price
untuk kendaraan dengan kondisi ini.
```

## Testing

### Test Script
```bash
npx tsx scripts/test-zai-vehicle-upload.ts
```

### Manual Testing
1. Login ke showroom dashboard: http://localhost:3000/login
2. Login dengan `user@showroom.com` / `password123`
3. Navigate to `/dashboard/vehicles`
4. Input: "Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt"
5. Click "Generate dengan AI"
6. Review price analysis dan data
7. Edit jika perlu
8. Save as draft

## Performance

- **AI Response Time**: 20-30 seconds
- **API Timeout**: 5 minutes (configurable)
- **Model**: GLM-4.6 (4000 max tokens)
- **Confidence Score**: Typically 85-95%

## Future Enhancements

1. ✅ **Photo Upload** - COMPLETED
   - Drag & drop interface
   - Support up to 30 photos
   - AI analyzes first 5 photos
   - Preview grid with delete functionality
   - Vision-based identification with GLM-4.5V (when photos provided)

2. **Bulk Upload** (Priority 2)
   - Upload multiple vehicles at once
   - CSV import

3. **Price History Tracking** (Priority 3)
   - Track price changes over time
   - Market trend analysis

4. **Competitive Analysis** (Priority 4)
   - Compare with competitor prices
   - Market positioning

## Known Limitations

1. AI pricing based on Indonesia market only
2. Text-only identification currently (vision coming soon)
3. Requires manual review before publish
4. Price analysis accuracy depends on AI training data

## Support

For issues or questions, check:
- BMad workflow status: `docs/bmm-workflow-status.yaml`
- Architecture: `docs/architecture.md`
- Test script: `scripts/test-zai-vehicle-upload.ts`
