/**
 * OLX Puppeteer Scraper (LITE VERSION)
 *
 * Fast scraper using Puppeteer to bypass anti-bot protection
 * Usage: npx tsx scripts/scrapers/puppeteer-olx-scraper.ts
 */

import { loadEnvConfig } from '@next/env';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { VehicleDataExtractorService } from '../../src/lib/ai/vehicle-data-extractor.service';

// Load environment variables for AI service
loadEnvConfig(process.cwd());

interface ScrapedVehicle {
  source: string;
  make: string;
  model: string;
  year: number;
  price: number; // IDR cents
  priceDisplay: string;
  variant?: string;
  transmission?: string;
  fuelType?: string;
  bodyType?: string;
  features?: string;
  description?: string;
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
      'Kia', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Volkswagen',
      'Mini', 'Land Rover', 'Range Rover', 'Lexus', 'Subaru',
      'Porsche', 'Jaguar', 'Volvo', 'Peugeot', 'Renault',
      'Chevrolet', 'Ford', 'Jeep', 'Chery', 'MG', 'DFSK'
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
   * Extract body type from make and model
   * Returns: SUV, MPV, Sedan, Hatchback, Pickup, Wagon, Coupe, Convertible
   */
  private extractBodyType(make: string, model: string): string | undefined {
    const modelLower = model.toLowerCase();
    const makeLower = make.toLowerCase();

    // SUV patterns
    const suvModels = [
      'fortuner', 'pajero', 'crv', 'cr-v', 'hrv', 'hr-v', 'brv', 'br-v',
      'xpander cross', 'terios', 'rush', 'outlander', 'cx', 'rocky',
      'raize', 'tiguan', 'x-trail', 'rav4', 'tucson', 'sportage',
      'vitara', 'sx4', 'jimny', 'escudo', 'ertiga cross', 'wrangler',
      'cherokee', 'compass', 'renegade', 'evoque', 'defender'
    ];

    // MPV patterns
    const mpvModels = [
      'avanza', 'xenia', 'innova', 'ertiga', 'mobilio', 'freed',
      'expander', 'xpander', 'livina', 'grand livina', 'serena',
      'alphard', 'vellfire', 'sienta', 'calya', 'sigra', 'kijang',
      'cortez', 'confero', 'formo', 'luxio', 'apv', 'grand max',
      'mvp', 'air ev', 'carnival', 'staria', 'h-1', 'odyssey'
    ];

    // Sedan patterns
    const sedanModels = [
      'camry', 'corolla', 'altis', 'vios', 'accord', 'civic', 'city',
      'mazda 3', 'mazda 6', 'mazda2', 'teana', 'almera', 'lancer',
      'galant', 'baleno', 'ciaz', 'ertiga', 'mercy', 'c-class',
      'e-class', 's-class', 'bmw 3', 'bmw 5', 'bmw 7', 'a4', 'a6',
      'passat', 'jetta', 'camaro', 'mustang', 'soluto', '5', '6', '7'
    ];

    // Hatchback patterns
    const hatchbackModels = [
      'yaris', 'agya', 'ayla', 'brio', 'jazz', 'ignis', 'swift',
      'karimun', 'wagon r', 'celerio', 'march', 'fiesta', 'focus',
      'i20', 'rio', 'picanto', 'polo', 'golf', 'mazda 2', 'mini cooper',
      'mirage'
    ];

    // Pickup/Truck patterns
    const pickupModels = [
      'hilux', 'ranger', 'triton', 'navara', 'd-max', 'strada',
      'bt-50', 'colorado', 'amarok', 'toro', 't60', 'poer'
    ];

    // Check SUV
    for (const pattern of suvModels) {
      if (modelLower.includes(pattern)) return 'SUV';
    }

    // Check MPV
    for (const pattern of mpvModels) {
      if (modelLower.includes(pattern)) return 'MPV';
    }

    // Check Sedan
    for (const pattern of sedanModels) {
      if (modelLower.includes(pattern)) return 'Sedan';
    }

    // Check Hatchback
    for (const pattern of hatchbackModels) {
      if (modelLower.includes(pattern)) return 'Hatchback';
    }

    // Check Pickup
    for (const pattern of pickupModels) {
      if (modelLower.includes(pattern)) return 'Pickup';
    }

    // If unable to determine, return undefined
    return undefined;
  }

  /**
   * Extract features from title
   * Common features: Sunroof, Leather Seats, ABS, Airbag, Parking Sensor, etc.
   */
  private extractFeatures(title: string): string | undefined {
    const titleLower = title.toLowerCase();
    const features: string[] = [];

    // Common features mapping (Indonesian + English)
    const featurePatterns: { [key: string]: string[] } = {
      'Sunroof': ['sunroof', 'sun roof', 'panoramic', 'atap terbuka'],
      'Leather Seats': ['leather', 'kulit', 'jok kulit', 'seat leather'],
      'Electric Seats': ['electric seat', 'power seat', 'jok elektrik'],
      'Cruise Control': ['cruise control', 'cruise'],
      'Parking Sensor': ['parking sensor', 'sensor parkir', 'pdc', 'parkir sensor'],
      'Parking Camera': ['camera', 'kamera', 'rear camera', 'backup camera', 'kamera mundur'],
      'Keyless Entry': ['keyless', 'smart key', 'push start', 'start stop', 'start-stop', 'push button'],
      'Airbags': ['airbag', 'srs', 'air bag'],
      'ABS': ['abs', 'anti lock'],
      'Traction Control': ['traction control', 'tcs', 'vsc', 'esp', 'stability'],
      'Alloy Wheels': ['alloy', 'velg racing', 'velg sport', 'racing wheels'],
      'Fog Lamp': ['fog lamp', 'lampu kabut', 'foglamp'],
      'LED Lights': ['led', 'led lamp', 'lampu led'],
      'Audio System': ['audio', 'speaker', 'sound system', 'sound'],
      'Navigation': ['navigation', 'gps', 'navi'],
      'Bluetooth': ['bluetooth'],
      'USB': ['usb'],
      'Climate Control': ['climate', 'dual zone', 'ac digital', 'auto ac'],
      'Turbo': ['turbo', 'turbocharged'],
      'Warranty': ['warranty', 'garansi'],
      'Service Record': ['service record', 'book service', 'buku service'],
      'Low KM': ['low km', 'km rendah', 'km sedikit'],
    };

    // Check for each feature
    for (const [feature, patterns] of Object.entries(featurePatterns)) {
      for (const pattern of patterns) {
        if (titleLower.includes(pattern)) {
          features.push(feature);
          break; // Only add once per feature
        }
      }
    }

    // Return comma-separated features or undefined if none
    return features.length > 0 ? features.join(', ') : undefined;
  }

  /**
   * Extract description from title (cleaned up version for AI)
   * Keep useful information like condition, special features, seller notes
   */
  private extractDescription(title: string, make: string, model: string, year: number): string | undefined {
    let desc = title;

    // Remove URL-style hyphens and clean up
    desc = desc.replace(/-/g, ' ');

    // Remove make and model (but keep variant info)
    desc = desc.replace(new RegExp(`\\b${make}\\b`, 'gi'), '').trim();
    desc = desc.replace(new RegExp(`\\b${model}\\b`, 'gi'), '').trim();

    // Remove year
    if (year > 0) {
      desc = desc.replace(new RegExp(`\\b${year}\\b`, 'g'), '').trim();
    }

    // Remove minimal noise words (only very common ones)
    const minimalNoiseWords = ['dp', 'tdp', 'iid'];
    for (const word of minimalNoiseWords) {
      desc = desc.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    }

    // Clean up extra spaces
    desc = desc.replace(/\s+/g, ' ').trim();
    desc = desc.replace(/^[-,\s]+|[-,\s]+$/g, '');

    // Keep it if there's meaningful content (variant, condition, features, etc)
    // Examples: "1.5 Veloz Q", "Low KM", "Tangan Pertama", "Full Original"
    if (desc && desc.length > 5) {
      return desc;
    }

    return undefined;
  }

  /**
   * Extract variant from title and URL (words after model, before year)
   */
  private extractVariant(title: string, url: string, make: string, model: string): string | undefined {
    // Try from title first
    const makeIndex = title.toLowerCase().indexOf(make.toLowerCase());
    if (makeIndex !== -1) {
      const afterMake = title.substring(makeIndex + make.length).trim();
      const modelIndex = afterMake.toLowerCase().indexOf(model.toLowerCase());
      if (modelIndex !== -1) {
        const afterModel = afterMake.substring(modelIndex + model.length).trim();

        // Extract words before year (variant usually here)
        const yearMatch = afterModel.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          const variant = afterModel.substring(0, yearMatch.index).trim();
          // Clean up common words
          const cleaned = variant
            .replace(/^[-\s]+/, '')
            .replace(/\b(tipe|type|tahun|low|dp|km)\b/gi, '')
            .trim();

          if (cleaned && cleaned.length > 0 && cleaned.length < 40) {
            return cleaned;
          }
        }
      }
    }

    // Try extracting from URL slug (between model and fuel/transmission)
    // Example: "suzuki-ertiga-15-gx-bensin-mt-2022"
    // Example: "wuling-cortez-15-lt-lux-bensin-at-2019"
    const urlLower = url.toLowerCase();
    const modelInUrl = model.toLowerCase().replace(/\s+/g, '-');
    const modelIdx = urlLower.indexOf(modelInUrl);

    if (modelIdx !== -1) {
      const afterModelUrl = urlLower.substring(modelIdx + modelInUrl.length);

      // Match everything between model and (bensin|diesel|at|mt|year)
      // Pattern: -15-gx- or -15-lt-lux- or -20-
      const variantMatch = afterModelUrl.match(/^-([^-]+(?:-[^-]+)*)(?=-(?:bensin|diesel|at|mt|gasoline|solar|\d{4}|iid))/);

      if (variantMatch && variantMatch[1]) {
        let urlVariant = variantMatch[1]
          .replace(/[-_]/g, ' ')
          .replace(/\b(low|dp|km|iid|pajak|panjang|rendah|tdp|bensin|diesel|gasoline|solar|putih|hitam|abu|merah|biru|silver|grey)\b/gi, '')
          .replace(/\s+(at|mt|cvt)(\s+\d{4})?.*/gi, '') // Remove transmission and everything after
          .trim()
          .toUpperCase();

        // Clean up extra spaces
        urlVariant = urlVariant.replace(/\s+/g, ' ').trim();

        if (urlVariant && urlVariant.length > 0 && urlVariant.length < 40) {
          return urlVariant;
        }
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
  /**
   * Extract detail specs using AI Skill 5.0
   * This provides "Self-Healing" capabilities as it reads natural language/HTML
   * instead of relying on fixed CSS selectors.
   */
  private async extractDetailSpecs(page: Page): Promise<Partial<ScrapedVehicle>> {
    console.log('🤖 Invoking AI 5.0 for detailed analysis...');
    try {
      // 1. Get raw content (Text/HTML)
      // Capturing the full body ensures we don't miss specifications even if layout shifts
      const htmlContent = await page.content();

      // 2. Call AI Extractor
      const aiResult = await VehicleDataExtractorService.extractFromHTML(htmlContent);

      if (aiResult.success && aiResult.data) {
        console.log(`✅ AI Analysis Complete: ${aiResult.data.make} ${aiResult.data.model} (${(aiResult.confidence * 100).toFixed(0)}% confidence)`);

        // Return structured data from AI
        return {
          // AI inferred data (superior to regex)
          make: aiResult.data.make,
          model: aiResult.data.model,
          year: aiResult.data.year,
          price: aiResult.data.price,

          transmission: aiResult.data.transmission,
          fuelType: aiResult.data.fuelType,
          variant: aiResult.data.variant || undefined,
          // Note: engineCapacity is available in aiResult but not strictly in ScrapedVehicle interface?
          // We can map it to features string or description if needed.

          // Let's create a rich description if AI didn't provide one, using reasoning
          description: aiResult.reasoning || `Extracted by AI: ${aiResult.data.make} ${aiResult.data.model} ${aiResult.data.variant || ''}`
        };
      } else {
        console.warn(`⚠️  AI Extraction low confidence: ${aiResult.error}. Fallback to legacy selectors.`);
        return this.extractDetailSpecsLegacy(page);
      }
    } catch (error) {
      console.log('⚠️  AI Process Error:', error);
      return this.extractDetailSpecsLegacy(page);
    }
  }

  /**
   * Legacy selector-based extraction (Fallback)
   */
  private async extractDetailSpecsLegacy(page: Page): Promise<Partial<ScrapedVehicle>> {
    try {
      // Wait for specs section to load
      await page.waitForSelector('[data-aut-id="itemParams"]', { timeout: 5000 }).catch(() => { });

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
            } else if (label.includes('transmisi') || label.includes('transmission')) {
              result.transmission = value;
            } else if (label.includes('bahan bakar') || label.includes('fuel') || label.includes('bensin') || label.includes('diesel')) {
              result.fuelType = value;
            } else if (label.includes('tipe') || label.includes('variant') || label.includes('model')) {
              result.variant = value;
            }
          });
        }

        // Extract full description from listing
        const descElement = document.querySelector('[data-aut-id="itemDescriptionContent"]');
        if (descElement) {
          const fullDesc = descElement.textContent?.trim() || '';
          if (fullDesc && fullDesc.length > 10) {
            result.description = fullDesc;
          }
        }

        return result;
      });

      return specs;
    } catch (error) {
      console.log('⚠️  Legacy extraction failed:', error);
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
            const spans = Array.from(metaSection.querySelectorAll('span'));
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
          variant: this.extractVariant(raw.title, raw.url, make, model),
          transmission: this.extractTransmission(titleWithUrl),
          fuelType: this.extractFuelType(titleWithUrl),
          bodyType: this.extractBodyType(make, model),
          features: this.extractFeatures(raw.title),
          description: this.extractDescription(raw.title, make, model, year),
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

            // Extract features from description if available
            if (detailSpecs.description && !vehicle.features) {
              vehicle.features = this.extractFeatures(detailSpecs.description);
            }

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
    // Scrape 5 vehicles with detail pages (slower but richer data)
    await scraper.scrape(5, true);  // visitDetailPages = true

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
