# Epic 2: AI-Powered Vehicle Upload - Implementation Plan

**Epic Goal:** Deliver the core "magic moment" where showroom staff upload vehicle photos and receive a professional, AI-generated web catalog in under 90 seconds.

**Created:** 2025-11-20
**Status:** 🎯 Ready for Implementation
**Coverage:** FR16-21 (AI Upload System), FR49-52 (Content Management)

---

## Overview

Epic 2 transforms manual vehicle catalog creation from hours to minutes through AI-powered automation. This is **autolumiku's key differentiator** - the magic moment that delivers immediate value to showroom staff.

**User Journey:**
1. Staff member drags 5-20 vehicle photos to upload area
2. System validates photo quality in real-time
3. AI identifies vehicle make/model/year/variant (10-15 seconds)
4. AI generates comprehensive description and features (20-30 seconds)
5. AI suggests competitive pricing based on market analysis (15-20 seconds)
6. Staff reviews and edits AI-generated content
7. One-click publish to live website
8. **Total time: < 90 seconds** from photo upload to published listing

---

## Epic 2 Stories (8 Total)

### Story 2.1: Drag-and-Drop Photo Upload Interface ⭐️ **FOUNDATION**
- **Priority:** CRITICAL (foundation for all other stories)
- **Effort:** 8 hours
- **Dependencies:** File storage service (S3/R2)
- **Deliverables:**
  - React component with drag-drop interface
  - Multi-file upload with progress tracking
  - Preview thumbnails
  - File type and size validation
  - Upload to S3/R2 with signed URLs

### Story 2.2: Real-Time Photo Validation
- **Priority:** HIGH
- **Effort:** 6 hours
- **Dependencies:** Story 2.1
- **Deliverables:**
  - Image quality analysis (resolution, clarity, size)
  - Client-side pre-validation
  - Server-side validation with Sharp
  - Quality feedback UI with improvement suggestions
  - Validation status indicators

### Story 2.3: AI Vehicle Identification ⭐️ **CORE AI**
- **Priority:** CRITICAL
- **Effort:** 12 hours
- **Dependencies:** Story 2.1, AI API setup
- **Deliverables:**
  - OpenAI GPT-4 Vision integration
  - Vehicle identification service (make/model/year/variant)
  - Confidence scoring
  - Manual correction UI
  - Fallback to manual entry

### Story 2.4: Comprehensive AI Description Generation ⭐️ **VALUE DELIVERY**
- **Priority:** CRITICAL
- **Effort:** 10 hours
- **Dependencies:** Story 2.3
- **Deliverables:**
  - GPT-4 description generation
  - Feature extraction from photos
  - Specification lookup integration
  - Multi-paragraph descriptions (Indonesian + English)
  - Tone customization (formal, casual, promotional)
  - Edit interface for AI-generated content

### Story 2.5: Intelligent Pricing Suggestions
- **Priority:** HIGH
- **Effort:** 10 hours
- **Dependencies:** Story 2.3
- **Deliverables:**
  - Market analysis service
  - Comparable vehicle pricing lookup
  - Price range suggestions with confidence scores
  - Market trend analysis
  - Price adjustment recommendations
  - Manual price override

### Story 2.6: Vehicle Listing Review & Publishing
- **Priority:** CRITICAL
- **Effort:** 8 hours
- **Dependencies:** Stories 2.1, 2.3, 2.4, 2.5
- **Deliverables:**
  - Complete review interface
  - Side-by-side preview
  - Edit all AI-generated fields
  - One-click publish workflow
  - Draft saving
  - Status management (draft → published)

### Story 2.7: Photo Organization and Management
- **Priority:** MEDIUM
- **Effort:** 6 hours
- **Dependencies:** Story 2.1
- **Deliverables:**
  - Drag-drop photo reordering
  - Set main display photo
  - Feature photo highlighting
  - Photo deletion
  - Replace photos
  - Photo metadata management

### Story 2.8: CDN Optimization for Photo Delivery
- **Priority:** HIGH
- **Effort:** 6 hours
- **Dependencies:** Story 2.1
- **Deliverables:**
  - Cloudflare R2 + CDN setup
  - Image optimization pipeline
  - Responsive image variants (thumbnail, medium, large, original)
  - Lazy loading implementation
  - Progressive image loading
  - Indonesian geo-optimization

---

## Technical Architecture

### File Storage Strategy: Cloudflare R2 + CDN

**Why Cloudflare R2?**
- ✅ Zero egress fees (critical for image-heavy platform)
- ✅ S3-compatible API (easy migration path)
- ✅ Built-in CDN integration
- ✅ Indonesian PoP availability (Jakarta, Singapore)
- ✅ Cost-effective for high-traffic image delivery
- ✅ Automatic image optimization

**Alternative:** AWS S3 + CloudFront (higher cost, proven reliability)

### AI Services Strategy

**Primary:** OpenAI GPT-4 Vision + GPT-4
- **Vehicle Identification:** GPT-4 Vision analyzes photos
- **Description Generation:** GPT-4 creates compelling descriptions
- **Pricing Analysis:** GPT-4 analyzes market data

**Fallback:** Google Cloud Vision API
- For redundancy and cost optimization
- Switching based on accuracy/cost metrics

### Database Schema Extensions

```prisma
model Vehicle {
  id                String   @id @default(uuid())
  tenantId          String

  // Basic Information (AI-identified)
  make              String
  model             String
  year              Int
  variant           String?

  // AI-Generated Content
  descriptionId     String?   // Indonesian description
  descriptionEn     String?   // English description
  features          Json?     // Extracted features array
  specifications    Json?     // Technical specs object

  // Pricing
  price             Int       // In IDR cents
  aiSuggestedPrice  Int?      // AI recommendation
  priceConfidence   Float?    // 0-100 confidence score

  // Status
  status            VehicleStatus @default(DRAFT)
  publishedAt       DateTime?

  // Relations
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  photos            VehiclePhoto[]

  // Metadata
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdBy         String

  @@index([tenantId])
  @@index([status])
  @@index([make, model, year])
}

model VehiclePhoto {
  id                String   @id @default(uuid())
  vehicleId         String
  tenantId          String

  // Storage
  storageKey        String   // R2/S3 key
  originalUrl       String   // Full resolution
  thumbnailUrl      String   // 300x200
  mediumUrl         String   // 800x600
  largeUrl          String   // 1920x1080

  // Metadata
  filename          String
  fileSize          Int      // bytes
  mimeType          String
  width             Int
  height            Int

  // Organization
  displayOrder      Int      @default(0)
  isMainPhoto       Boolean  @default(false)
  isFeatured        Boolean  @default(false)

  // Quality Validation
  qualityScore      Float?   // 0-100
  validationStatus  PhotoValidationStatus @default(PENDING)
  validationMessage String?

  // Relations
  vehicle           Vehicle  @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([vehicleId])
  @@index([tenantId])
  @@index([displayOrder])
}

enum VehicleStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  ARCHIVED
  SOLD
}

enum PhotoValidationStatus {
  PENDING
  VALID
  LOW_QUALITY
  REJECTED
}
```

### API Endpoints

```typescript
// Vehicle Upload Flow
POST   /api/v1/vehicles/upload-photos         // Upload photos to R2
POST   /api/v1/vehicles/validate-photos       // Validate photo quality
POST   /api/v1/vehicles/identify              // AI vehicle identification
POST   /api/v1/vehicles/generate-description  // AI description
POST   /api/v1/vehicles/suggest-pricing       // AI pricing
POST   /api/v1/vehicles                        // Create vehicle listing
PATCH  /api/v1/vehicles/:id                   // Update vehicle
POST   /api/v1/vehicles/:id/publish           // Publish to website
DELETE /api/v1/vehicles/:id                   // Delete vehicle

// Photo Management
GET    /api/v1/vehicles/:id/photos            // Get all photos
PATCH  /api/v1/vehicles/:id/photos/reorder    // Reorder photos
PATCH  /api/v1/vehicles/:id/photos/:photoId   // Update photo
DELETE /api/v1/vehicles/:id/photos/:photoId   // Delete photo
```

---

## Implementation Order (Optimized for Parallel Work)

### Phase 1: Foundation (Stories 2.1, 2.2) - Days 1-2
**Parallel Stream 1:** File Upload Infrastructure
- Setup Cloudflare R2 bucket
- Configure CDN
- Implement upload API with signed URLs
- Create drag-drop React component

**Parallel Stream 2:** Database & Validation
- Extend Prisma schema (Vehicle, VehiclePhoto models)
- Run migrations
- Implement photo validation service
- Create validation UI

**Deliverable:** Working photo upload system with validation

### Phase 2: AI Integration (Stories 2.3, 2.4, 2.5) - Days 3-5
**Sequential (AI services depend on each other):**

**Day 3:** Story 2.3 - Vehicle Identification
- OpenAI GPT-4 Vision integration
- Vehicle identification service
- Confidence scoring
- Manual correction UI

**Day 4:** Story 2.4 - Description Generation
- GPT-4 description service
- Feature extraction
- Bilingual content generation
- Edit interface

**Day 5:** Story 2.5 - Pricing Intelligence
- Market analysis service
- Price suggestion algorithm
- Confidence scoring
- Price comparison UI

**Deliverable:** Complete AI pipeline from photos → vehicle listing

### Phase 3: Publishing & Management (Stories 2.6, 2.7, 2.8) - Days 6-7
**Parallel Stream 1:** Publishing Workflow (Story 2.6)
- Review interface
- Preview functionality
- Edit workflow
- Publish API

**Parallel Stream 2:** Photo Management (Story 2.7)
- Drag-drop reordering
- Photo organization UI
- Metadata management

**Parallel Stream 3:** CDN Optimization (Story 2.8)
- Image optimization pipeline
- Responsive variants
- Lazy loading
- Performance testing

**Deliverable:** Complete end-to-end vehicle upload and publishing system

---

## Technical Dependencies

### External Services Required

**1. Cloudflare R2 (File Storage)**
```bash
# Environment variables needed
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="autolumiku-vehicle-photos"
R2_PUBLIC_URL="https://photos.autolumiku.com"
```

**2. OpenAI API (AI Services)**
```bash
# Environment variables needed
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4-vision-preview"  # For vehicle identification
OPENAI_TEXT_MODEL="gpt-4-turbo"      # For descriptions & pricing
```

**3. Google Cloud Vision API (Fallback)**
```bash
# Optional fallback
GOOGLE_CLOUD_PROJECT_ID="your-project"
GOOGLE_CLOUD_VISION_API_KEY="your-key"
```

### NPM Packages Required

```bash
# File Upload & Processing
npm install sharp              # Image processing
npm install @aws-sdk/client-s3 # S3-compatible R2 client
npm install @aws-sdk/s3-request-presigner # Signed URLs

# AI Integration
npm install openai             # OpenAI SDK

# File Upload UI
npm install react-dropzone     # Drag-drop file upload
npm install @uppy/core @uppy/react @uppy/dashboard # Advanced upload UI

# Image optimization
npm install next-cloudinary    # Cloudinary integration (optional)
```

---

## Database Migration Plan

### Step 1: Create Migration

```bash
# Create new migration for Vehicle and VehiclePhoto models
npx prisma migrate dev --name add_vehicle_photo_models
```

### Step 2: Seed Test Data (Optional)

Create test vehicles for development:

```typescript
// prisma/seed-vehicles.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedVehicles() {
  // Create test tenant if needed
  const tenant = await prisma.tenant.findFirst();

  // Create test vehicle
  const vehicle = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      make: 'Toyota',
      model: 'Avanza',
      year: 2023,
      variant: 'G 1.5 MT',
      descriptionId: 'Toyota Avanza G 1.5 MT 2023 - Mobil keluarga terbaik...',
      price: 25000000, // 250 juta IDR
      status: 'DRAFT',
      createdBy: 'seed-script'
    }
  });

  console.log('Test vehicle created:', vehicle.id);
}

seedVehicles();
```

---

## File Structure

```
src/
├── services/
│   ├── vehicle-service/
│   │   ├── index.ts                    # Vehicle CRUD service
│   │   ├── upload-service.ts           # Photo upload to R2
│   │   ├── validation-service.ts       # Photo quality validation
│   │   └── ai-service.ts               # AI integration wrapper
│   ├── ai-services/
│   │   ├── vehicle-identification.ts   # Story 2.3
│   │   ├── description-generator.ts    # Story 2.4
│   │   └── pricing-intelligence.ts     # Story 2.5
│   └── storage-service/
│       ├── r2-client.ts                # Cloudflare R2 client
│       └── image-optimizer.ts          # Sharp image processing
├── components/
│   ├── vehicle-upload/
│   │   ├── PhotoUploader.tsx           # Story 2.1 - Drag-drop UI
│   │   ├── PhotoValidation.tsx         # Story 2.2 - Validation UI
│   │   ├── VehicleIdentification.tsx   # Story 2.3 - AI results
│   │   ├── DescriptionEditor.tsx       # Story 2.4 - Edit AI content
│   │   ├── PricingSuggestion.tsx       # Story 2.5 - Pricing UI
│   │   ├── VehicleReview.tsx           # Story 2.6 - Review & publish
│   │   └── PhotoManager.tsx            # Story 2.7 - Photo organization
│   └── shared/
│       ├── ImageGallery.tsx            # Optimized gallery
│       └── LazyImage.tsx               # Lazy loading wrapper
└── app/
    └── api/
        └── v1/
            └── vehicles/
                ├── route.ts                      # GET, POST /vehicles
                ├── [id]/route.ts                 # GET, PATCH, DELETE
                ├── upload-photos/route.ts        # POST upload
                ├── validate-photos/route.ts      # POST validate
                ├── identify/route.ts             # POST AI identify
                ├── generate-description/route.ts # POST AI description
                └── suggest-pricing/route.ts      # POST AI pricing
```

---

## Story Implementation Details

### Story 2.1: Drag-and-Drop Photo Upload Interface

**Acceptance Criteria:**
- ✅ Drag photos from computer to upload area
- ✅ 20 photo limit with clear messaging
- ✅ Reject unsupported file types (only JPG, PNG, WEBP)
- ✅ Preview thumbnails immediately

**Technical Implementation:**

**Frontend Component:** `src/components/vehicle-upload/PhotoUploader.tsx`
```typescript
import { useDropzone } from 'react-dropzone';
import { useState } from 'react';

interface UploadedPhoto {
  file: File;
  preview: string;
  uploadProgress: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploadedUrl?: string;
}

export function PhotoUploader() {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const MAX_PHOTOS = 20;

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxFiles: MAX_PHOTOS,
    onDrop: async (acceptedFiles) => {
      if (photos.length + acceptedFiles.length > MAX_PHOTOS) {
        alert(`Maksimal ${MAX_PHOTOS} foto`);
        return;
      }

      // Create previews
      const newPhotos = acceptedFiles.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        uploadProgress: 0,
        status: 'pending' as const
      }));

      setPhotos([...photos, ...newPhotos]);

      // Upload to R2
      for (const photo of newPhotos) {
        await uploadPhoto(photo);
      }
    }
  });

  const uploadPhoto = async (photo: UploadedPhoto) => {
    // Get signed upload URL
    const { uploadUrl, key } = await fetch('/api/v1/vehicles/upload-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: photo.file.name,
        contentType: photo.file.type,
        fileSize: photo.file.size
      })
    }).then(r => r.json());

    // Upload directly to R2 with progress
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100;
        setPhotos(prev => prev.map(p =>
          p.file === photo.file ? { ...p, uploadProgress: progress, status: 'uploading' } : p
        ));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        setPhotos(prev => prev.map(p =>
          p.file === photo.file ? { ...p, status: 'uploaded', uploadedUrl: key } : p
        ));
      }
    });

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', photo.file.type);
    xhr.send(photo.file);
  };

  return (
    <div>
      <div {...getRootProps()} className="border-2 border-dashed p-8 text-center">
        <input {...getInputProps()} />
        <p>Drag foto kendaraan ke sini atau klik untuk pilih</p>
        <p className="text-sm text-gray-500">
          Maksimal {MAX_PHOTOS} foto (JPG, PNG, WEBP)
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-4">
        {photos.map((photo, index) => (
          <div key={index} className="relative">
            <img src={photo.preview} className="w-full h-32 object-cover rounded" />
            {photo.status === 'uploading' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"
                   style={{ width: `${photo.uploadProgress}%` }} />
            )}
            {photo.status === 'uploaded' && (
              <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                ✓
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Backend API:** `src/app/api/v1/vehicles/upload-photos/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { r2Client } from '@/services/storage-service/r2-client';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType, fileSize } = await request.json();

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'Tipe file tidak didukung' },
        { status: 400 }
      );
    }

    if (fileSize > 10 * 1024 * 1024) { // 10MB max
      return NextResponse.json(
        { error: 'File terlalu besar (max 10MB)' },
        { status: 400 }
      );
    }

    // Generate unique key
    const key = `vehicles/${uuidv4()}/${filename}`;

    // Generate signed upload URL
    const uploadUrl = await r2Client.getSignedUploadUrl(key, contentType);

    return NextResponse.json({ uploadUrl, key });
  } catch (error) {
    return NextResponse.json(
      { error: 'Upload gagal' },
      { status: 500 }
    );
  }
}
```

---

### Story 2.3: AI Vehicle Identification

**Acceptance Criteria:**
- ✅ AI identifies make, model, year, variant from photos
- ✅ Progress indicator during processing
- ✅ Confidence scores displayed
- ✅ Manual editing available

**Backend Service:** `src/services/ai-services/vehicle-identification.ts`
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface VehicleIdentification {
  make: string;
  model: string;
  year: number;
  variant?: string;
  confidence: number; // 0-100
  reasoning: string;
}

export async function identifyVehicle(
  photoUrls: string[]
): Promise<VehicleIdentification> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert automotive identifier. Analyze the vehicle photos and identify:
1. Make (manufacturer)
2. Model
3. Year (estimate if not visible)
4. Variant/trim level
5. Confidence score (0-100)
6. Reasoning for your identification

Return JSON format:
{
  "make": "Toyota",
  "model": "Avanza",
  "year": 2023,
  "variant": "G 1.5 MT",
  "confidence": 95,
  "reasoning": "Identified by front grille design, headlight shape, and body style"
}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identify this vehicle from the photos:' },
            ...photoUrls.map(url => ({
              type: 'image_url' as const,
              image_url: { url }
            }))
          ]
        }
      ],
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      make: result.make || 'Unknown',
      model: result.model || 'Unknown',
      year: result.year || new Date().getFullYear(),
      variant: result.variant,
      confidence: result.confidence || 50,
      reasoning: result.reasoning || ''
    };
  } catch (error) {
    console.error('Vehicle identification error:', error);
    throw new Error('AI vehicle identification failed');
  }
}
```

---

## Testing Strategy

### Unit Tests
- Photo upload service
- Image validation
- AI service responses
- Database models

### Integration Tests
- End-to-end upload flow
- AI pipeline (identification → description → pricing)
- Publishing workflow

### Performance Tests
- Upload speed for 20 photos
- AI processing time
- CDN delivery speed
- Indonesian network simulation (2G, 3G, 4G)

**Target Performance Metrics:**
- ✅ Photo upload: < 30 seconds for 20 photos (3G network)
- ✅ AI identification: < 15 seconds
- ✅ Description generation: < 30 seconds
- ✅ Pricing analysis: < 20 seconds
- ✅ **Total time: < 90 seconds** (goal met)

---

## Risk Mitigation

### Risk 1: AI Accuracy Issues
**Mitigation:**
- Always allow manual correction
- Show confidence scores
- Fallback to manual entry
- Log low-confidence identifications for improvement

### Risk 2: Upload Performance on Slow Networks
**Mitigation:**
- Progressive upload (upload as you select)
- Chunked uploads for large files
- Client-side compression before upload
- Clear progress indicators

### Risk 3: AI API Rate Limits
**Mitigation:**
- Implement request queuing
- Cache common vehicle identifications
- Fallback to Google Vision API
- Clear error messages with retry

### Risk 4: Storage Costs
**Mitigation:**
- Use Cloudflare R2 (zero egress fees)
- Automatic image optimization
- Lifecycle policies (archive old photos)
- Photo count limits per plan

---

## Success Metrics

### User Experience Metrics
- ✅ Time from upload to published: < 90 seconds
- ✅ AI identification accuracy: > 85%
- ✅ Description quality rating: > 4/5 stars
- ✅ User edits required: < 20% of AI content

### Technical Metrics
- ✅ Photo upload success rate: > 99%
- ✅ CDN cache hit ratio: > 90%
- ✅ Image load time (3G): < 3 seconds
- ✅ AI API response time: < 30 seconds

### Business Metrics
- ✅ Photos uploaded per day
- ✅ Vehicles published per showroom
- ✅ Time saved vs manual catalog creation
- ✅ User satisfaction score

---

## Post-Epic 2 Cleanup

After completing all 8 stories:
- [ ] Update sprint-status.yaml (mark all Epic 2 stories as done)
- [ ] Run Epic 2 retrospective
- [ ] Document lessons learned
- [ ] Performance optimization review
- [ ] Update user documentation
- [ ] Create video tutorial for vehicle upload

---

## Ready to Start?

**Epic 2 Implementation Plan Complete** ✅

**Next Steps:**
1. Setup Cloudflare R2 account and bucket
2. Configure OpenAI API access
3. Run database migrations (add Vehicle and VehiclePhoto models)
4. Start with Story 2.1 (Photo Upload Foundation)

**Estimated Timeline:** 7 days (1 week)
**Team Size:** 1-2 developers
**Parallel Work:** Yes (after Phase 1 foundation)

---

**Plan Created:** 2025-11-20
**Ready for:** Implementation Phase 4
**Status:** 🚀 **APPROVED - START BUILDING**
