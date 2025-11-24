# Vehicle Scraper Test Tools

Simple scraping tools to test data extraction from Mobil123 and OLX Indonesia for feeding the AI system with accurate vehicle data.

## Purpose

These tools are designed to:
1. **Test scraping methods** from Mobil123 and OLX
2. **Extract vehicle data** (make, model, year, price, specs)
3. **Feed accurate data** to the AI identification system
4. **Compare data quality** between sources

## Structure

```
scripts/scrapers/
├── test-mobil123-scraper.ts    # Mobil123 scraper
├── test-olx-scraper.ts         # OLX Indonesia scraper
├── analyze-results.ts          # Compare & analyze results
├── output/                     # Generated results (JSON)
│   ├── mobil123-results.json
│   ├── olx-results.json
│   └── analysis-report.json
└── README.md                   # This file
```

## Installation

No additional dependencies needed. Uses Node.js built-in `fetch` API.

## Usage

### 1. Run Mobil123 Scraper

```bash
npx tsx scripts/scrapers/test-mobil123-scraper.ts
```

**Output:**
- Fetches vehicle listings from Mobil123
- Saves results to `output/mobil123-results.json`
- Prints summary statistics

### 2. Run OLX Scraper

```bash
npx tsx scripts/scrapers/test-olx-scraper.ts
```

**Output:**
- Fetches vehicle listings from OLX Indonesia
- Attempts both HTML and API endpoints
- Saves results to `output/olx-results.json`
- Prints summary statistics

### 3. Analyze & Compare Results

```bash
npx tsx scripts/scrapers/analyze-results.ts
```

**Output:**
- Analyzes data quality from both sources
- Compares completeness, accuracy, diversity
- Generates recommendation on which source to use
- Saves report to `output/analysis-report.json`

## What Gets Scraped

Each scraper extracts:

| Field | Description | Example |
|-------|-------------|---------|
| `make` | Manufacturer | Toyota, Honda |
| `model` | Model name | Avanza, Xpander |
| `year` | Production year | 2020 |
| `price` | Price in IDR cents | 15000000000 (150 juta) |
| `variant` | Trim/variant | 1.3 G AT |
| `mileage` | Odometer (km) | 20000 |
| `transmission` | Transmission type | Automatic, Manual |
| `fuelType` | Fuel type | Bensin, Diesel |
| `color` | Vehicle color | Hitam, Putih |
| `location` | Seller location | Jakarta, Surabaya |

## Data Quality Metrics

The analyzer evaluates:

### Completeness Score (40% weight)
- **Basic Info**: % with make, model, year, price
- **Specs**: % with transmission, fuel type, mileage
- **Extras**: % with color, location, variant

### Data Quality (40% weight)
- **Valid Years**: 1980-2025
- **Valid Prices**: > 0 and reasonable
- **Recognized Makes**: Known Indonesian brands
- **Avg Fields**: Number of filled fields per vehicle

### Diversity (20% weight)
- Number of unique makes
- Number of unique models
- Year range coverage
- Price range spread

## Important Notes

### ⚠️ Initial Setup Required

Both scrapers are **skeleton implementations** that need adjustment based on actual website structure:

1. **Inspect HTML/API structure** of target websites
2. **Adjust parsing logic** in `parseListingPage()` methods
3. **Test with small samples** before scaling up

### Rate Limiting

Both scrapers include:
- 3-second delay between requests
- Respectful user-agent headers
- Error handling for failed requests

### Legal & Ethical Considerations

- ✅ For internal use only (feeding AI)
- ✅ Rate-limited to avoid server overload
- ✅ No personal data collection
- ⚠️ Check websites' Terms of Service
- ⚠️ Consider using official APIs if available

## Example Output

### Mobil123 Results
```json
{
  "source": "Mobil123",
  "scrapedAt": "2025-11-24T10:30:00.000Z",
  "totalVehicles": 20,
  "vehicles": [
    {
      "source": "Mobil123",
      "make": "Toyota",
      "model": "Avanza",
      "year": 2020,
      "price": 15000000000,
      "priceDisplay": "Rp 150.000.000",
      "transmission": "Automatic",
      "mileage": 20000,
      "location": "Jakarta",
      "scrapedAt": "2025-11-24T10:30:00.000Z"
    }
  ]
}
```

### Analysis Report
```json
{
  "analyzedAt": "2025-11-24T10:35:00.000Z",
  "sources": [
    {
      "source": "Mobil123",
      "totalVehicles": 20,
      "overallScore": 75,
      "completeness": {
        "score": 80,
        "hasBasicInfo": 100,
        "hasSpecs": 75,
        "hasExtras": 60
      }
    },
    {
      "source": "OLX",
      "totalVehicles": 20,
      "overallScore": 68,
      "completeness": {
        "score": 70,
        "hasBasicInfo": 95,
        "hasSpecs": 60,
        "hasExtras": 55
      }
    }
  ],
  "recommendation": "Mobil123 is recommended as primary source with overall score 75/100"
}
```

## Next Steps

After testing these scrapers:

1. **Adjust parsing logic** based on actual HTML/API structure
2. **Choose primary data source** based on analysis results
3. **Integrate with Popular Vehicle Database**:
   - Create admin UI for running scrapers
   - Implement duplicate detection
   - Auto-update database with new listings
4. **Scale up** to scrape 500+ vehicles

## Troubleshooting

### No results found
- Check if websites changed their HTML structure
- Inspect network requests in browser DevTools
- Look for JSON data embedded in HTML or API endpoints

### HTTP errors (403, 429)
- Website may be blocking scrapers
- Increase delay between requests
- Consider using proxies or official APIs

### Invalid data
- Adjust regex patterns in parsing methods
- Add more validation rules
- Check if websites use different formats

## Integration with AI

Once data is collected, feed to AI system:

```typescript
import { popularVehicleService } from '@/lib/services/popular-vehicle-service';

// Import scraped data to database
const vehicles = JSON.parse(fs.readFileSync('output/mobil123-results.json'));

for (const vehicle of vehicles.vehicles) {
  await popularVehicleService.create({
    make: vehicle.make,
    model: vehicle.model,
    // ... map fields
  });
}
```

The AI will then use this data for:
- Faster vehicle identification
- Price validation
- Auto-complete suggestions
- Blog content generation

---

**Created**: 2025-11-24
**Purpose**: Test scraping methodology for AI data feeding
**Status**: Skeleton implementation - needs adjustment based on actual website structure
