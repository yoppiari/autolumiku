# 🚗 Popular Vehicle Database - Implementation Plan

## Overview

Implementasi database kendaraan populer Indonesia untuk meningkatkan akurasi AI identification, memberikan auto-suggestions, validasi harga, dan mendukung content generation untuk blog.

**Epic:** Epic 2 - AI-Powered Vehicle Upload
**Story:** Story 2.9 - Popular Vehicle Reference Database
**Priority:** High
**Estimated Effort:** 2-3 days

---

## Business Value

### Problems Solved
1. ❌ **AI identification lambat** (20-30 detik) untuk kendaraan populer
2. ❌ **User harus ketik manual** semua detail kendaraan
3. ❌ **Tidak ada validasi harga** - risk overpricing/underpricing
4. ❌ **Blog content generation** butuh research manual
5. ❌ **AI tokens mahal** untuk kendaraan yang sama berulang kali

### Benefits
1. ✅ **60-70% faster identification** untuk kendaraan populer
2. ✅ **Auto-complete suggestions** - better UX
3. ✅ **Price validation** - prevent pricing mistakes
4. ✅ **Rich data for blog** - auto-generate comparisons, reviews
5. ✅ **40-50% cost reduction** on AI tokens

---

## Technical Architecture

### 1. Database Schema

```prisma
model PopularVehicle {
  id                String   @id @default(uuid())

  // Basic Information
  make              String   // Toyota, Honda, Mitsubishi, etc
  model             String   // Avanza, Xpander, CR-V, etc
  category          String   // MPV, SUV, Sedan, Hatchback, Pickup
  bodyType          String   // 5-seater, 7-seater, etc

  // Variants & Years
  variants          Json     // ["1.3 E MT", "1.3 G MT", "1.5 G AT"]
  productionYears   Json     // { start: 2019, end: 2024, current: true }

  // Technical Specifications
  engineOptions     String[] // ["1.3L", "1.5L"]
  engineCapacity    Json     // { "1.3L": "1329cc", "1.5L": "1496cc" }
  transmissionTypes String[] // ["Manual 5-speed", "CVT", "Automatic 4-speed"]
  fuelTypes         String[] // ["Bensin"]
  fuelConsumption   Json?    // { city: "13 km/L", highway: "16 km/L" }
  seatingCapacity   Int[]    // [7] for MPV
  driveType         String[] // ["FWD", "RWD", "4WD"]

  // Dimensions & Weight
  dimensions        Json?    // { length: 4395, width: 1730, height: 1665 } in mm
  groundClearance   Int?     // in mm
  curbWeight        Json?    // { min: 1070, max: 1150 } in kg

  // Market Data & Pricing
  newCarPrice       Json?    // { "2024": { min: 233300000, max: 282600000 } }
  usedCarPrices     Json     // { "2023": {min: 200000000, max: 240000000}, "2022": {...} }
  depreciation      Json?    // { yearlyRate: 0.15, resaleValue3Years: 0.65 }

  // Popularity Metrics
  popularityScore   Int      @default(50) // 1-100 based on market share
  marketShare       Float?   // 0.0-1.0
  salesVolume       Json?    // { "2023": 15000, "2024": 18000 }
  commonInRegions   String[] // ["Jakarta", "Surabaya", "Bandung"]
  targetMarket      String[] // ["Family", "First-time buyer", "Urban"]

  // Features & Equipment
  standardFeatures  Json     // { safety: [], comfort: [], technology: [] }
  commonOptions     String[] // ["Sunroof", "Leather seats", "Navigation"]

  // AI Helper Data
  commonKeywords    String[] // ["avanza", "avy", "grand avanza", "veloz"]
  commonMisspellings String[] // ["avansa", "afanza", "avanza"]
  searchAliases     String[] // Alternative names

  // Competition & Comparison
  directCompetitors String[] // ["Mitsubishi Xpander", "Suzuki Ertiga"]
  competitiveAdvantages String[] // ["Best resale value", "Lowest maintenance"]

  // Content Generation Support
  prosAndCons       Json?    // { pros: [], cons: [] }
  expertReview      String?  // Short expert opinion
  commonIssues      Json?    // { "2020": ["AC compressor"], "2021": [] }
  maintenanceCost   Json?    // { yearly: 5000000, per10k: 500000 }

  // SEO & Marketing
  seoKeywords       String[] // For blog content generation
  metaDescription   String?
  popularComparisons String[] // ["Avanza vs Xpander", "Avanza vs Ertiga"]

  // Metadata
  isActive          Boolean  @default(true)
  dataSource        String?  // "Manual", "OLX API", "OtoDriver"
  lastVerified      DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([make, model])
  @@index([make, model])
  @@index([category])
  @@index([popularityScore])
  @@index([isActive])
  @@map("popular_vehicles")
}
```

---

## 2. Initial Data: 30 Mobil Populer Indonesia (2024)

### MPV (Multi-Purpose Vehicle) - 10 mobil

1. **Toyota Avanza** ⭐ #1 Best Seller
   - Variants: E MT, G MT, G AT, Veloz MT, Veloz AT
   - Price: Rp 233-282 juta (baru), Rp 150-240 juta (bekas 2020-2023)

2. **Mitsubishi Xpander**
   - Variants: Sport MT, Exceed MT, Exceed AT, Ultimate AT, Cross AT
   - Price: Rp 258-303 juta (baru), Rp 200-270 juta (bekas)

3. **Suzuki Ertiga**
   - Variants: GL MT, GX MT, GX AT, Sport MT, Sport AT
   - Price: Rp 229-274 juta (baru), Rp 160-230 juta (bekas)

4. **Toyota Veloz**
   - Variants: 1.5 M/T, 1.5 A/T, Q A/T TSS
   - Price: Rp 291-333 juta (baru), Rp 240-300 juta (bekas)

5. **Daihatsu Xenia**
   - Variants: X MT, X AT, R MT, R AT
   - Price: Rp 220-270 juta (baru), Rp 140-220 juta (bekas)

6. **Suzuki XL7**
   - Variants: Beta MT, Alpha MT, Alpha AT, Zeta AT
   - Price: Rp 245-284 juta (baru), Rp 190-250 juta (bekas)

7. **Wuling Confero**
   - Variants: S, L, C (Minibus)
   - Price: Rp 179-239 juta (baru), Rp 130-190 juta (bekas)

8. **Toyota Rush**
   - Variants: S MT, S AT, G MT, G AT
   - Price: Rp 270-310 juta (baru), Rp 200-280 juta (bekas)

9. **Daihatsu Terios**
   - Variants: X MT, X AT, R MT, R AT
   - Price: Rp 255-295 juta (baru), Rp 180-260 juta (bekas)

10. **Mitsubishi Xpander Cross**
    - Variants: Premium MT, Premium AT, Ultimate AT
    - Price: Rp 303-338 juta (baru), Rp 270-320 juta (bekas)

### SUV (Sport Utility Vehicle) - 10 mobil

11. **Toyota Fortuner**
    - Variants: 2.4 G MT, 2.4 VRZ AT, 2.8 VRZ AT Diesel
    - Price: Rp 560-730 juta (baru), Rp 400-650 juta (bekas)

12. **Honda CR-V**
    - Variants: 1.5 Turbo CVT, 1.5 Turbo Prestige CVT
    - Price: Rp 740-810 juta (baru), Rp 450-700 juta (bekas)

13. **Mitsubishi Pajero Sport**
    - Variants: Exceed 4x2 AT, Dakar 4x2 AT, Dakar 4x4 AT
    - Price: Rp 560-712 juta (baru), Rp 380-600 juta (bekas)

14. **Toyota Raize**
    - Variants: 1.0 M/T, 1.0 CVT, 1.0 Turbo CVT
    - Price: Rp 229-280 juta (baru), Rp 190-250 juta (bekas)

15. **Daihatsu Rocky**
    - Variants: X MT, X CVT, ADS CVT
    - Price: Rp 225-275 juta (baru), Rp 185-245 juta (bekas)

16. **Honda HR-V**
    - Variants: S CVT, E CVT, SE CVT, RS CVT
    - Price: Rp 383-571 juta (baru), Rp 280-480 juta (bekas)

17. **Suzuki Jimny**
    - Variants: All Grip MT, All Grip AT
    - Price: Rp 435-466 juta (baru), Rp 400-550 juta (bekas)

18. **Wuling Almaz**
    - Variants: Exclusive 5-Seater, Exclusive 7-Seater, RS Pro
    - Price: Rp 298-405 juta (baru), Rp 220-350 juta (bekas)

19. **MG ZS**
    - Variants: Excite AT, Exclusive AT
    - Price: Rp 319-365 juta (baru), Rp 230-310 juta (bekas)

20. **Mazda CX-5**
    - Variants: GT AT, Elite AT
    - Price: Rp 590-730 juta (baru), Rp 400-650 juta (bekas)

### Sedan & Hatchback - 5 mobil

21. **Honda Brio**
    - Variants: S MT, E MT, E CVT, RS CVT
    - Price: Rp 167-251 juta (baru), Rp 120-200 juta (bekas)

22. **Toyota Yaris**
    - Variants: 1.5 S CVT, 1.5 G CVT, 1.5 TRD Sportivo CVT
    - Price: Rp 298-348 juta (baru), Rp 220-310 juta (bekas)

23. **Honda City**
    - Variants: S CVT, E CVT, RS CVT
    - Price: Rp 337-392 juta (baru), Rp 250-350 juta (bekas)

24. **Honda Civic**
    - Variants: 1.5 Turbo CVT, RS CVT
    - Price: Rp 610-665 juta (baru), Rp 450-580 juta (bekas)

25. **Toyota Corolla Altis**
    - Variants: 1.8 G CVT, 1.8 V CVT, Hybrid
    - Price: Rp 565-720 juta (baru), Rp 400-630 juta (bekas)

### Pickup & Commercial - 5 mobil

26. **Toyota Hilux**
    - Variants: Single Cabin, Double Cabin 4x2, Double Cabin 4x4
    - Price: Rp 280-650 juta (baru), Rp 250-550 juta (bekas)

27. **Mitsubishi Triton**
    - Variants: HDX DC 4x4, GLX DC 4x4, Ultimate DC 4x4
    - Price: Rp 450-610 juta (baru), Rp 350-520 juta (bekas)

28. **Isuzu D-Max**
    - Variants: 4x2 Single Cabin, 4x2 Double Cabin, 4x4 Double Cabin
    - Price: Rp 280-550 juta (baru), Rp 240-480 juta (bekas)

29. **Ford Ranger**
    - Variants: XL+ 4x2, XLT 4x4, Raptor
    - Price: Rp 500-950 juta (baru), Rp 400-850 juta (bekas)

30. **Suzuki Carry Pickup**
    - Variants: 1.5 Deck, 1.5 Box, 1.5 FD
    - Price: Rp 150-190 juta (baru), Rp 100-160 juta (bekas)

---

## 3. Implementation Steps

### Phase 1: Database Setup (Day 1)

**Tasks:**
1. ✅ Add PopularVehicle model to `prisma/schema.prisma`
2. ✅ Create migration: `npx prisma migrate dev --name add_popular_vehicles`
3. ✅ Create seed file: `scripts/seed-popular-vehicles.ts`
4. ✅ Populate 30 vehicles with comprehensive data
5. ✅ Run seed: `npx ts-node scripts/seed-popular-vehicles.ts`

**Deliverables:**
- Schema migration file
- Seed script with 30 vehicles
- Database populated with data

---

### Phase 2: API Layer (Day 1-2)

**Tasks:**
1. Create service: `src/lib/services/popular-vehicle-service.ts`
   - `searchVehicles(query: string)` - Auto-complete
   - `findVehicle(make: string, model: string)` - Exact match
   - `getVariants(vehicleId: string)` - Get variants
   - `getPriceRange(vehicleId: string, year: number)` - Market prices
   - `getSimilarVehicles(vehicleId: string)` - Competitors

2. Create API endpoints:
   - `GET /api/v1/popular-vehicles/search?q={query}` - Search
   - `GET /api/v1/popular-vehicles/{id}` - Get by ID
   - `GET /api/v1/popular-vehicles/suggest?make={make}&model={model}` - Suggestions
   - `GET /api/v1/popular-vehicles/compare?ids={id1,id2}` - Comparison

**Deliverables:**
- Service layer with helper functions
- REST API endpoints
- API documentation

---

### Phase 3: AI Integration (Day 2)

**Tasks:**
1. Update `vehicle-ai-service.ts`:
   - Add `searchReferenceDatabase()` before AI call
   - Enhance prompt with reference data
   - Add price validation logic

2. Modify identification flow:
   ```typescript
   async identifyFromText(input: string) {
     // Step 1: Search reference database
     const matches = await popularVehicleService.search(input);

     if (matches.length > 0) {
       // Step 2: AI confirms & refines with context
       const prompt = this.buildPromptWithReference(input, matches);
       const result = await this.client.generateText(prompt);

       // Step 3: Validate price against database
       result.priceAnalysis = this.validatePrice(result, matches[0]);

       return result;
     }

     // Fallback: Full AI identification
     return await this.identifyFromScratch(input);
   }
   ```

**Deliverables:**
- Enhanced AI service with database lookup
- Price validation logic
- Faster identification for popular vehicles

---

### Phase 4: UI Integration (Day 2-3)

**Tasks:**
1. Add auto-complete to upload form:
   ```tsx
   <input
     type="text"
     placeholder="Cari kendaraan..."
     onChange={handleSearch}
     // Shows suggestions dropdown
   />
   <SuggestionsList
     suggestions={suggestions}
     onSelect={handleSelect}
   />
   ```

2. Add price validation indicator:
   ```tsx
   {priceAnalysis && (
     <div className={getPriceAlertClass()}>
       {priceAnalysis.recommendation}
     </div>
   )}
   ```

3. Show variant selector after vehicle selected:
   ```tsx
   <select name="variant">
     {selectedVehicle.variants.map(v => (
       <option key={v}>{v}</option>
     ))}
   </select>
   ```

**Deliverables:**
- Auto-complete UI component
- Price validation alerts
- Variant selector dropdown

---

### Phase 5: Blog Content Support (Day 3)

**Tasks:**
1. Create blog helper: `src/lib/blog/vehicle-content-generator.ts`
   - `generateReview(vehicleId: string)` - Blog post
   - `generateComparison(vehicleIds: string[])` - Comparison article
   - `generateBuyingGuide(vehicleId: string)` - How-to guide

2. Add templates:
   - Review template
   - Comparison template
   - Buying guide template

**Deliverables:**
- Content generation helpers
- Blog post templates
- SEO optimization utilities

---

## 4. Testing Strategy

### Unit Tests
- PopularVehicle service methods
- Search and filtering logic
- Price validation calculations

### Integration Tests
- API endpoints
- AI integration with database
- Price validation flow

### E2E Tests
- Auto-complete functionality
- Upload flow with suggestions
- Price validation alerts

---

## 5. Success Metrics

### Performance
- ✅ Identification time: 20-30s → 5-10s (popular vehicles)
- ✅ AI token usage: -40-50% for common vehicles
- ✅ Price accuracy: 90%+ alignment with market

### User Experience
- ✅ Auto-complete suggestions < 200ms
- ✅ Price validation instant feedback
- ✅ Reduced manual data entry by 60%

### Content Generation
- ✅ Blog post generation: < 30s
- ✅ Comparison articles: < 60s
- ✅ SEO-optimized content

---

## 6. Future Enhancements

### Phase 2 (Future)
1. **Auto-update from market data**
   - Scrape OLX, OtoDriver, Mobil123
   - Update prices monthly
   - Track market trends

2. **Regional pricing variations**
   - Jakarta vs Surabaya prices
   - Regional demand patterns

3. **User contribution**
   - Allow showrooms to report actual prices
   - Crowdsource data accuracy

4. **ML-based pricing predictions**
   - Predict depreciation
   - Forecast market trends
   - Suggest optimal pricing

---

## 7. Data Sources

### Initial Data Collection
- **OtoDriver** - Specs & reviews
- **OLX** - Used car prices
- **Carmudi** - Market insights
- **Official manufacturer websites** - New car prices
- **Auto2000, Honda, Mitsubishi dealers** - Official price lists

### Update Frequency
- **Prices:** Monthly
- **Specs:** When new model launched
- **Market share:** Quarterly
- **Reviews:** As available

---

## Dependencies

- Prisma ORM
- z.ai API (already integrated)
- Next.js API routes
- React (auto-complete UI)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Outdated pricing data | High | Monthly automated updates |
| Incomplete vehicle data | Medium | Fallback to full AI identification |
| Database performance | Low | Proper indexing, caching |
| Data accuracy | High | Multiple source verification |

---

## Timeline

- **Day 1 AM:** Schema + migration + seed script
- **Day 1 PM:** Populate data + API service layer
- **Day 2 AM:** AI integration + price validation
- **Day 2 PM:** UI components (auto-complete)
- **Day 3 AM:** Blog content helpers
- **Day 3 PM:** Testing + documentation

**Total: 2-3 days**

---

## Next Steps

1. ✅ Update BMad (Epic 2, Story 2.9)
2. ⏳ Review & approve implementation plan
3. ⏳ Create Prisma schema
4. ⏳ Build seed data
5. ⏳ Implement Phase 1-5

**Status:** Ready for implementation
**Assigned to:** Development team
**Priority:** High
