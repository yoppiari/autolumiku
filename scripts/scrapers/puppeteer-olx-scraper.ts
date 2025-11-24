/**
 * OLX Puppeteer Scraper (LITE VERSION)
 *
 * Fast scraper using Puppeteer to bypass anti-bot protection
 * Usage: npx tsx scripts/scrapers/puppeteer-olx-scraper.ts
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface ScrapedVehicle {
  source: string;
  make: string;
  model: string;
  year: number;
  price: number; // IDR cents
  priceDisplay: string;
  variant?: string;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  color?: string;
  location?: string;
  url?: string;
  scrapedAt: string;
}

class PuppeteerOLXScraper {
  private browser?: Browser;
  private results: ScrapedVehicle[] = [];

  /**
   * Parse price string to IDR cents
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;

    // Handle "Juta" format
    if (priceStr.toLowerCase().includes('juta')) {
      const millions = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
      return isNaN(millions) ? 0 : millions * 100000000;
    }

    // Handle full number format
    const cleaned = priceStr.replace(/[Rp\s.]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? 0 : value * 100;
  }

  /**
   * Extract make and model from title
   */
  private extractMakeModel(title: string): { make: string; model: string } {
    const makes = [
      'Toyota', 'Honda', 'Daihatsu', 'Mitsubishi', 'Suzuki',
      'Nissan', 'Mazda', 'Isuzu', 'Wuling', 'Hyundai',
      'Kia', 'BMW', 'Mercedes', 'Audi', 'Volkswagen'
    ];

    const titleLower = title.toLowerCase();
    for (const make of makes) {
      if (titleLower.includes(make.toLowerCase())) {
        const afterMake = title.substring(titleLower.indexOf(make.toLowerCase()) + make.length).trim();
        const words = afterMake.split(/\s+/);
        let model = words[0] || '';
        if (words[1] && words[1].length <= 3) {
          model += ' ' + words[1];
        }
        return { make, model: model.trim() };
      }
    }
    return { make: 'Unknown', model: 'Unknown' };
  }

  /**
   * Extract year from title and URL
   */
  private extractYear(title: string, url: string): number {
    // Try URL first (more reliable as it's often in URL slug)
    const urlYearMatch = url.match(/-(19|20)\d{2}-/);
    if (urlYearMatch) {
      return parseInt(urlYearMatch[0].replace(/-/g, ''), 10);
    }

    // Fallback to title
    const titleYearMatch = title.match(/\b(19|20)\d{2}\b/);
    if (titleYearMatch) {
      return parseInt(titleYearMatch[0], 10);
    }

    // Try to find year pattern in title (e.g., "Tahun 2020")
    const tahunMatch = title.match(/tahun\s+(19|20)\d{2}/i);
    if (tahunMatch) {
      return parseInt(tahunMatch[1], 10);
    }

    return 0;
  }

  /**
   * Extract transmission from title/URL
   */
  private extractTransmission(text: string): string | undefined {
    const lower = text.toLowerCase();
    // Check for AT/Automatic - must have space or dash around it
    if (lower.match(/[\s-]at[\s-]/) || lower.includes('-at-') || lower.includes(' at ') ||
        lower.includes('automatic') || lower.includes('matic')) {
      return 'Automatic';
    }
    // Check for MT/Manual
    if (lower.match(/[\s-]mt[\s-]/) || lower.includes('-mt-') || lower.includes(' mt ') ||
        lower.includes('manual')) {
      return 'Manual';
    }
    if (lower.includes('cvt')) {
      return 'CVT';
    }
    return undefined;
  }

  /**
   * Extract fuel type from title/URL
   */
  private extractFuelType(text: string): string | undefined {
    const lower = text.toLowerCase();
    if (lower.includes('bensin') || lower.includes('gasoline')) {
      return 'Bensin';
    }
    if (lower.includes('diesel') || lower.includes('solar')) {
      return 'Diesel';
    }
    if (lower.includes('hybrid')) {
      return 'Hybrid';
    }
    if (lower.includes('electric') || lower.includes('listrik')) {
      return 'Electric';
    }
    return undefined;
  }

  /**
   * Extract mileage from title
   */
  private extractMileage(text: string): number | undefined {
    const lower = text.toLowerCase();

    // Pattern: "50rb km", "50 rb", "50ribu"
    const rbMatch = lower.match(/(\d+)\s*(rb|ribu)/);
    if (rbMatch) {
      return parseInt(rbMatch[1], 10) * 1000;
    }

    // Pattern: "50.000 km", "50000km"
    const kmMatch = lower.match(/(\d+[\.,]?\d*)\s*km/);
    if (kmMatch) {
      const km = parseInt(kmMatch[1].replace(/[.,]/g, ''), 10);
      if (km < 500) { // Probably in thousands
        return km * 1000;
      }
      return km;
    }

    return undefined;
  }

  /**
   * Extract variant from title (words after model, before year)
   */
  private extractVariant(title: string, make: string, model: string): string | undefined {
    // Find position after make and model
    const makeIndex = title.toLowerCase().indexOf(make.toLowerCase());
    if (makeIndex === -1) return undefined;

    const afterMake = title.substring(makeIndex + make.length).trim();
    const modelIndex = afterMake.toLowerCase().indexOf(model.toLowerCase());
    if (modelIndex === -1) return undefined;

    const afterModel = afterMake.substring(modelIndex + model.length).trim();

    // Extract words before year (variant usually here)
    const yearMatch = afterModel.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const variant = afterModel.substring(0, yearMatch.index).trim();
      // Clean up common words
      const cleaned = variant
        .replace(/^[-\s]+/, '')
        .replace(/\b(tipe|type|tahun)\b/gi, '')
        .trim();

      if (cleaned && cleaned.length > 0 && cleaned.length < 30) {
        return cleaned;
      }
    }

    return undefined;
  }

  /**
   * Initialize browser
   */
  private async initBrowser(): Promise<void> {
    console.log('🚀 Launching browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-http2',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    console.log('✅ Browser launched\n');
  }

  /**
   * Extract detail specs from detail page
   */
  private async extractDetailSpecs(page: Page): Promise<Partial<ScrapedVehicle>> {
    try {
      // Wait for specs section to load
      await page.waitForSelector('[data-aut-id="itemParams"]', { timeout: 5000 }).catch(() => {});

      const specs = await page.evaluate(() => {
        const result: any = {};

        // Extract specs from params section
        const paramsSection = document.querySelector('[data-aut-id="itemParams"]');
        if (paramsSection) {
          const params = paramsSection.querySelectorAll('li');

          params.forEach((param) => {
            const label = param.querySelector('[class*="label"]')?.textContent?.trim().toLowerCase() || '';
            const value = param.querySelector('[class*="value"]')?.textContent?.trim() || '';

            if (!value) return;

            // Match Indonesian spec labels
            if (label.includes('tahun') || label.includes('year')) {
              const yearMatch = value.match(/\d{4}/);
              if (yearMatch) result.year = parseInt(yearMatch[0], 10);
            } else if (label.includes('km') || label.includes('mileage') || label.includes('jarak')) {
              // Parse mileage: "50.000 km" or "50 rb km"
              if (value.toLowerCase().includes('rb') || value.toLowerCase().includes('ribu')) {
                const thousands = parseFloat(value.replace(/[^0-9.]/g, ''));
                result.mileage = isNaN(thousands) ? 0 : thousands * 1000;
              } else {
                const km = parseInt(value.replace(/[^0-9]/g, ''), 10);
                result.mileage = isNaN(km) ? 0 : km;
              }
            } else if (label.includes('transmisi') || label.includes('transmission')) {
              result.transmission = value;
            } else if (label.includes('bahan bakar') || label.includes('fuel') || label.includes('bensin') || label.includes('diesel')) {
              result.fuelType = value;
            } else if (label.includes('warna') || label.includes('color')) {
              result.color = value;
            } else if (label.includes('tipe') || label.includes('variant') || label.includes('model')) {
              result.variant = value;
            }
          });
        }

        // Try alternative selector for specs (OLX sometimes changes structure)
        if (Object.keys(result).length === 0) {
          const specsList = document.querySelectorAll('[class*="spec"]');
          specsList.forEach((spec) => {
            const text = spec.textContent?.toLowerCase() || '';

            if (text.includes('km') && !result.mileage) {
              const kmMatch = text.match(/(\d+[\.,]?\d*)\s*(rb|ribu|km)/i);
              if (kmMatch) {
                if (kmMatch[2].toLowerCase().includes('rb') || kmMatch[2].toLowerCase().includes('ribu')) {
                  result.mileage = parseFloat(kmMatch[1].replace(/[.,]/g, '')) * 1000;
                } else {
                  result.mileage = parseInt(kmMatch[1].replace(/[.,]/g, ''), 10);
                }
              }
            }

            if ((text.includes('manual') || text.includes('automatic') || text.includes('matic')) && !result.transmission) {
              if (text.includes('automatic') || text.includes('matic')) {
                result.transmission = 'Automatic';
              } else if (text.includes('manual')) {
                result.transmission = 'Manual';
              }
            }
          });
        }

        return result;
      });

      return specs;
    } catch (error) {
      console.log('⚠️  Could not extract detail specs:', error);
      return {};
    }
  }

  /**
   * Scrape OLX listings with optional detail page extraction
   * @param limit Number of vehicles to scrape
   * @param visitDetailPages If true, visits each detail page for full specs (slower but more complete)
   */
  async scrape(limit: number = 20, visitDetailPages: boolean = false): Promise<ScrapedVehicle[]> {
    try {
      await this.initBrowser();

      const page = await this.browser!.newPage();

      // Stealth tactics
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });

      // Remove webdriver flag
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      console.log('🚗 Navigating to OLX mobil bekas...');
      const url = 'https://www.olx.co.id/mobil-bekas_c198';

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      console.log('✅ Page loaded, waiting for listings...\n');

      // Wait for listings to load
      await page.waitForSelector('[data-aut-id="itemBox"]', { timeout: 10000 });

      // Scroll to load more items (for 50+ vehicles)
      if (limit > 20) {
        console.log('📜 Scrolling to load more listings...');
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 500;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight || totalHeight >= 5000) {
                clearInterval(timer);
                resolve();
              }
            }, 200);
          });
        });

        // Wait for new items to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ Scrolling complete\n');
      }

      // Extract listings data
      console.log('📦 Extracting vehicle data...\n');

      const vehicles = await page.evaluate((limitNum) => {
        const listings = document.querySelectorAll('[data-aut-id="itemBox"]');
        const results: any[] = [];

        for (let i = 0; i < Math.min(listings.length, limitNum); i++) {
          const listing = listings[i];

          // Extract title (contains make, model, year)
          const titleEl = listing.querySelector('[data-aut-id="itemTitle"]');
          const title = titleEl?.textContent?.trim() || '';

          // Extract price
          const priceEl = listing.querySelector('[data-aut-id="itemPrice"]');
          const priceDisplay = priceEl?.textContent?.trim() || '';

          // Extract location - try multiple selectors
          let location = '';
          // Try to find location in the metadata section
          const metaSection = listing.querySelector('[data-aut-id="itemDetails"]');
          if (metaSection) {
            // Location is usually in span elements within the details
            const spans = metaSection.querySelectorAll('span');
            for (const span of spans) {
              const text = span.textContent?.trim() || '';
              // Location patterns: contains city names or "Kab.", "Kota"
              if (text && (text.includes('Kab.') || text.includes('Kota') || text.includes(',') ||
                  /Jakarta|Surabaya|Bandung|Medan|Semarang|Bekasi|Tangerang|Depok|Bogor|Yogyakarta/i.test(text))) {
                location = text;
                break;
              }
            }
          }

          // Fallback: try data-aut-id
          if (!location) {
            const locationEl = listing.querySelector('[data-aut-id="item-location"]');
            location = locationEl?.textContent?.trim() || '';
          }

          // Extract URL
          const linkEl = listing.querySelector('a[href]');
          const url = linkEl?.getAttribute('href') || '';

          if (title && priceDisplay) {
            results.push({
              title,
              priceDisplay,
              location,
              url: url.startsWith('http') ? url : `https://www.olx.co.id${url}`
            });
          }
        }

        return results;
      }, limit);

      console.log(`✅ Found ${vehicles.length} raw listings\n`);

      // Process and parse the data
      let processedCount = 0;
      for (const raw of vehicles) {
        const { make, model } = this.extractMakeModel(raw.title);
        const year = this.extractYear(raw.title, raw.url);

        // Extract specs from title (fast, no page visit needed)
        const titleWithUrl = `${raw.title} ${raw.url}`;

        const vehicle: ScrapedVehicle = {
          source: 'OLX (Puppeteer)',
          make,
          model,
          year,
          price: this.parsePrice(raw.priceDisplay),
          priceDisplay: raw.priceDisplay,
          location: raw.location,
          url: raw.url,
          // Extract from title/URL (LITE mode - no detail page visits)
          variant: this.extractVariant(raw.title, make, model),
          transmission: this.extractTransmission(titleWithUrl),
          fuelType: this.extractFuelType(titleWithUrl),
          mileage: this.extractMileage(raw.title),
          scrapedAt: new Date().toISOString(),
        };

        // Optional: Visit detail page to enhance data (disabled by default for speed)
        if (visitDetailPages && raw.url) {
          try {
            processedCount++;
            console.log(`[${processedCount}/${vehicles.length}] Visiting detail page: ${make} ${model}`);

            await page.goto(raw.url, {
              waitUntil: 'networkidle2',
              timeout: 15000
            });

            // Extract detail specs
            const detailSpecs = await this.extractDetailSpecs(page);

            // Merge with vehicle data (detail page specs override if available)
            Object.assign(vehicle, detailSpecs);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error) {
            console.log(`⚠️  Failed to get details for ${make} ${model}:`, error);
          }
        }

        this.results.push(vehicle);
      }

      console.log(`\n✅ Parsed ${this.results.length} vehicles successfully\n`);

      await this.browser!.close();

      return this.results;

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  /**
   * Save results to JSON
   */
  async saveResults(filename: string = 'olx-puppeteer-results.json'): Promise<void> {
    const outputDir = path.join(process.cwd(), 'scripts', 'scrapers', 'output');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);

    const output = {
      source: 'OLX (Puppeteer)',
      scrapedAt: new Date().toISOString(),
      totalVehicles: this.results.length,
      vehicles: this.results,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`💾 Results saved to: ${outputPath}\n`);
  }

  /**
   * Print summary
   */
  printSummary(): void {
    console.log('📊 SCRAPING SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total vehicles: ${this.results.length}`);

    if (this.results.length > 0) {
      const makes = new Set(this.results.map(v => v.make));
      const validPrices = this.results.filter(v => v.price > 0);

      console.log(`Unique makes: ${makes.size}`);
      console.log(`Makes: ${Array.from(makes).join(', ')}`);

      if (validPrices.length > 0) {
        const avgPrice = validPrices.reduce((sum, v) => sum + v.price, 0) / validPrices.length;
        console.log(`Average price: Rp ${(avgPrice / 100000000).toFixed(0)} juta`);

        const prices = validPrices.map(v => v.price).sort((a, b) => a - b);
        console.log(`Price range: Rp ${(prices[0] / 100000000).toFixed(0)} - ${(prices[prices.length - 1] / 100000000).toFixed(0)} juta`);
      }

      // Sample data
      console.log('\n📋 Sample vehicles:');
      this.results.slice(0, 3).forEach((v, i) => {
        console.log(`${i + 1}. ${v.make} ${v.model} ${v.year} - ${v.priceDisplay} (${v.location})`);
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   OLX PUPPETEER SCRAPER (LITE)');
  console.log('═══════════════════════════════════════════\n');

  const scraper = new PuppeteerOLXScraper();

  try {
    // Scrape 5 vehicles for quick test
    await scraper.scrape(5);

    // Print summary
    scraper.printSummary();

    // Save results
    await scraper.saveResults();

    console.log('✅ Scraping completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Scraping failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { PuppeteerOLXScraper };
