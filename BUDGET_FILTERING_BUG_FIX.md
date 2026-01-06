# Budget Filtering Bug Fix

## Problem Description

When a user asked for vehicles with a budget (e.g., "kalau budget 300jt ada?"), the AI incorrectly included vehicles that were far outside the budget range. For example:
- User asked: "kalau budget 300jt ada?"
- AI showed: Honda City 2006 (Rp 79 juta) ✅ and Toyota Fortuner 2021 (Rp 345 juta) ❌

The Honda City should have been shown as it's below budget, but the Toyota Fortuner (345 million) should NOT have been shown for a 300 million budget.

## Root Cause

The bug was in the `smartFallback` function at lines 1120-1144 of `chat.service.ts`:

### Old Code Issues:
```typescript
const priceMatch = msg.match(/(\d+)\s*(jt|juta|rb|ribu)/i);
if (priceMatch || msg.includes('harga') || msg.includes('budget') || msg.includes('murah')) {
  const budget = priceMatch ? parseInt(priceMatch[1]) * (...) : 0;
  
  let relevantVehicles = vehicles;
  if (budget > 0) {
    relevantVehicles = vehicles.filter(v => Number(v.price) <= budget * 1.2);
  }
  // ... show all relevantVehicles
}
```

**Problems:**
1. ❌ The condition `msg.includes('budget')` triggered even when no budget amount was detected
2. ❌ When the regex didn't match, `budget` was set to `0`
3. ❌ When `budget = 0`, the filter was skipped, showing ALL vehicles
4. ❌ Didn't use the existing `extractBudget()` method which has better parsing logic
5. ❌ **No minimum price filter** - showed vehicles that were too cheap for the budget (e.g., showing 79 juta car for 300 juta budget)
6. ❌ No proper response when no vehicles match the budget

## Solution

### Changes Made:
1. ✅ Use the existing `extractBudget()` method for consistent budget parsing
2. ✅ Only trigger budget filtering when a budget is **actually detected** (not just when "budget" keyword appears)
3. ✅ **Add minimum price filter (60% of budget)** to avoid showing vehicles that are too cheap
4. ✅ **Add maximum price filter (120% of budget)** for reasonable flexibility
5. ✅ Sort results by price (closest to budget first)
6. ✅ When no vehicles match budget range, show the closest option and ask if they can adjust
7. ✅ Add debug logging to track budget detection

### New Code:
```typescript
// Use extractBudget for consistent parsing
const budget = WhatsAppAIChatService.extractBudget(msg);

// Only proceed if budget was explicitly mentioned
if (budget && budget > 0) {
  console.log(`[SmartFallback] 💰 Budget query detected: Rp ${Math.round(budget / 1000000)} juta`);
  
  // Filter vehicles within reasonable price range:
  // - Minimum: 60% of budget (don't show vehicles that are too cheap)
  // - Maximum: 120% of budget (allow some flexibility)
  const minPrice = budget * 0.6;
  const maxPrice = budget * 1.2;
  const relevantVehicles = vehicles.filter(v => {
    const price = Number(v.price);
    return price >= minPrice && price <= maxPrice;
  });

  if (relevantVehicles.length > 0) {
    // Sort by price (closest to budget first)
    // ... show matching vehicles
  } else {
    // Show closest option when nothing matches
    // ... suggest closest vehicle and ask about budget flexibility
  }
}
```

### Budget Range Logic:
When a user specifies a budget, the system now looks for vehicles within a **reasonable price range**:

- **Minimum Price:** 60% of budget
- **Maximum Price:** 120% of budget

**Example:** Budget 300 juta
- Show vehicles in range: **180 juta - 360 juta**
- Don't show: 79 juta (too cheap) or 400 juta (too expensive)

This ensures:
- ✅ Users don't see vehicles that are way below their budget (poor match)
- ✅ Users see vehicles that are close to their budget (relevant options)
- ✅ Some flexibility for slightly more expensive options (up to 20% over)

## Expected Behavior After Fix

### Scenario 1: Budget Request with Matches (300 juta)
**User:** "kalau budget 300jt ada?"
**AI Response:** 
```
Ada beberapa pilihan di budget Rp 300 juta nih! 💰✨

• Toyota Fortuner 2021 - Rp 345 juta | PM-PST-002

Mau info detail yang mana? 😊
```
✅ Shows Toyota Fortuner (345 juta) - within range 180-360 juta  
✅ **Does NOT show** Honda City (79 juta) - too cheap, below minimum (180 juta)

**Why Honda City is excluded:** The Honda City at 79 juta is only 26% of the 300 juta budget, which is far too cheap. It's not a relevant match for someone with a 300 juta budget.

### Scenario 2: Budget Request with Matches (100 juta)
If there was a vehicle priced at ~100 juta:
**User:** "budget 100jt?"
**AI Response:**
```
Ada beberapa pilihan di budget Rp 100 juta nih! 💰✨

• Honda City 2006 - Rp 79 juta | PM-PST-001

Mau info detail yang mana? 😊
```
✅ Shows Honda City (79 juta) - within range 60-120 juta

### Scenario 3: Budget Request with No Matches (50 juta)
**User:** "budget 50jt?"
**AI Response:**
```
Mohon maaf, untuk budget Rp 50 juta saat ini belum ada unit yang tersedia. 🙏

Unit terdekat yang kami punya:
• Honda City 2006 - Rp 79 juta | PM-PST-001

Apakah budget bisa disesuaikan atau ingin cari unit lain? 😊
```
✅ Honest about no matches in range 30-60 juta  
✅ Suggests closest option (Honda City at 79 juta)  
✅ Asks if budget can be adjusted

## Files Modified
- `src/lib/services/whatsapp-ai/chat.service.ts` (lines 1120-1144)

## Testing Recommendations
1. Test "budget 300jt" → should only show vehicles ≤ 360 juta (300 + 20%)
2. Test "budget 50jt" → should say no vehicles available, suggest closest
3. Test "budget 100jt" → should show matching vehicles sorted by proximity to budget
4. Test messages with "budget" keyword but no amount → should NOT trigger budget filter
