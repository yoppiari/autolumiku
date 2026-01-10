/**
 * SEVA Puppeteer Scraper
 * 
 * Scrapes new vehicle data from seva.id
 * Usage: npx tsx scripts/scrapers/puppeteer-seva-scraper.ts
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface ScrapedVehicle {
    source: string;
    make: string;
    model: string;
    year: number;
    price: number;
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

export class PuppeteerSevaScraper {
    private browser?: Browser;
    private results: ScrapedVehicle[] = [];

    private async initBrowser(): Promise<void> {
        console.log('🚀 Launching browser for SEVA...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
    }

    /**
     * Parse price string to IDR
     * Format: "Rp 140,3 - 196,2 juta" or "Rp191.400.000"
     */
    private parsePrice(priceStr: string): number {
        // Check if "juta" exists in the original string
        const isJuta = priceStr.toLowerCase().includes('juta');

        // Remove "Rp", "juta" and spaces
        let clean = priceStr.replace(/Rp\s*/gi, '').replace(/juta/gi, '').trim();

        // If range, take first price
        if (clean.includes('-')) {
            clean = clean.split('-')[0].trim();
        }

        // Apply multiplier if it was "juta"
        if (isJuta) {
            // "140,3" -> "140.3"
            const numStr = clean.replace(/,/g, '.');
            const num = parseFloat(numStr);
            return Math.round(num * 1000000);
        }

        // If full format (e.g., "191.400.000")
        // Remove dots if they exist as thousands separators (standard IDR)
        // But be careful not to confuse with decimal points if any
        const fullNum = clean.replace(/\./g, '').replace(/,/g, '');
        return parseInt(fullNum, 10) || 0;
    }

    async scrape(limit: number = 20): Promise<ScrapedVehicle[]> {
        try {
            await this.initBrowser();
            const page = await this.browser!.newPage();

            console.log('🚗 Navigating to SEVA Mobil Baru...');
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.goto('https://www.seva.id/mobil-baru', {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Wait for vehicle cards to load
            await page.waitForSelector('a[href^="/mobil-baru/"]', { timeout: 10000 });

            // Scroll to load more via infinite scroll
            if (limit > 20) {
                console.log('📜 Scrolling to load more vehicles...');
                await page.evaluate(async () => {
                    await new Promise<void>((resolve) => {
                        let totalHeight = 0;
                        const distance = 500;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;

                            if (totalHeight >= scrollHeight || totalHeight >= 3000) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 200);
                    });
                });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Extract vehicle data
            console.log('📦 Extracting vehicle data from SEVA...');

            const vehicles = await page.evaluate((limitNum) => {
                const cards = Array.from(document.querySelectorAll('a[href^="/mobil-baru/"]'));
                const results: any[] = [];

                for (let i = 0; i < Math.min(cards.length, limitNum); i++) {
                    const card = cards[i] as HTMLAnchorElement;

                    try {
                        // Get URL
                        const url = card.href;

                        // Parse URL to get brand and model
                        // Format: /mobil-baru/toyota/all-new-hilux-rangga/jakarta-pusat
                        const urlParts = url.split('/').filter(p => p);
                        const brandIdx = urlParts.indexOf('mobil-baru') + 1;

                        if (brandIdx <= 0 || urlParts.length <= brandIdx + 1) continue;

                        const brand = urlParts[brandIdx];
                        const modelSlug = urlParts[brandIdx + 1];

                        // Get title from h2
                        const titleEl = card.querySelector('h2');
                        const fullTitle = titleEl?.textContent?.trim() || '';

                        // Extract model name from title
                        const model = fullTitle || modelSlug.replace(/-/g, ' ');

                        // Get price
                        const priceEl = card.querySelector('span');
                        let priceDisplay = '';

                        // Look for price pattern "Rp X - Y juta"
                        const textContent = card.textContent || '';
                        const priceMatch = textContent.match(/Rp\s*[\d,.]+ - [\d,.]+\s*juta/i) ||
                            textContent.match(/Rp\s*[\d,.]+\s*juta/i);

                        if (priceMatch) {
                            priceDisplay = priceMatch[0].trim();
                        }

                        if (!priceDisplay || !model) continue;

                        results.push({
                            brand,
                            model,
                            priceDisplay,
                            url,
                        });

                    } catch (err) {
                        console.error('Error parsing card:', err);
                        continue;
                    }
                }

                return results;
            }, limit);

            console.log(`✅ Found ${vehicles.length} vehicles from SEVA\n`);

            console.log(`✅ Found ${vehicles.length} vehicles from SEVA listing. Now fetching details...\n`);

            // Process and fetch details for results
            for (let i = 0; i < vehicles.length; i++) {
                const raw = vehicles[i];
                console.log(`🔍 [${i + 1}/${vehicles.length}] Fetching details for ${raw.model}...`);

                let detailData: any = {};
                try {
                    // Construct Detail URL: insert '/eksterior/spesifikasi' before location segment
                    // URL: https://www.seva.id/mobil-baru/brand/model/jakarta-pusat
                    // Target: https://www.seva.id/mobil-baru/brand/model/eksterior/spesifikasi/jakarta-pusat
                    const urlParts = raw.url.split('/');
                    const location = urlParts.pop() || ''; // jakarta-pusat
                    // Re-assemble
                    const detailUrl = [...urlParts, 'eksterior', 'spesifikasi', location].join('/');

                    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    // Extract Specs
                    detailData = await page.evaluate(() => {
                        const specs: any = {};

                        // Inline logic to find value by label text
                        const allElements = Array.from(document.querySelectorAll('div, span, p, label'));

                        // 1. Fuel Type
                        const fuelLabel = allElements.find(el => {
                            const txt = el.textContent?.trim() || '';
                            return txt === 'Jenis Bahan Bakar' || txt === 'Bahan Bakar';
                        });
                        if (fuelLabel) {
                            const sibling = fuelLabel.nextElementSibling;
                            if (sibling && sibling.textContent) specs.fuelType = sibling.textContent.trim();
                            else {
                                const parentSibling = fuelLabel.parentElement?.nextElementSibling;
                                if (parentSibling && parentSibling.textContent) specs.fuelType = parentSibling.textContent.trim();
                            }
                        }

                        // 2. Engine
                        const engineLabel = allElements.find(el => {
                            const txt = el.textContent?.trim() || '';
                            return txt === 'Isi Silinder' || txt === 'Kapasitas Mesin';
                        });
                        if (engineLabel) {
                            const sibling = engineLabel.nextElementSibling;
                            if (sibling && sibling.textContent) specs.engine = sibling.textContent.trim();
                            else {
                                const parentSibling = engineLabel.parentElement?.nextElementSibling;
                                if (parentSibling && parentSibling.textContent) specs.engine = parentSibling.textContent.trim();
                            }
                        }

                        // 3. Transmission
                        // Often masked in "Mesin & Transmisi" section or model name
                        // Look for keywords in whole page if specific label not found
                        const pageText = document.body.innerText.toLowerCase();
                        if (pageText.includes('manual') && !pageText.includes('otomatis')) specs.transmission = 'Manual';
                        else if (pageText.includes('otomatis') || pageText.includes('cvt') || pageText.includes('a/t')) specs.transmission = 'Automatic';
                        else specs.transmission = 'Manual'; // Default fallback

                        return specs;
                    });

                } catch (err) {
                    console.warn(`⚠️ Failed to fetch details for ${raw.model}:`, err);
                    // Fallback values
                    detailData = { fuelType: 'Bensin', transmission: 'Manual', engine: '' };
                }

                this.results.push({
                    source: 'SEVA',
                    make: raw.brand.charAt(0).toUpperCase() + raw.brand.slice(1),
                    model: raw.model,
                    year: new Date().getFullYear(),
                    price: this.parsePrice(raw.priceDisplay),
                    priceDisplay: raw.priceDisplay,
                    url: raw.url,
                    location: 'Indonesia',
                    // Detailed fields
                    fuelType: detailData.fuelType || 'Bensin',
                    transmission: detailData.transmission || 'Manual',
                    features: detailData.engine ? `Engine: ${detailData.engine}` : undefined,
                    scrapedAt: new Date().toISOString(),
                });

                // Small delay to be polite
                await new Promise(r => setTimeout(r, 1000));
            }

            console.log(`✅ Parsed ${this.results.length} vehicles successfully\n`);

            await this.browser!.close();
            return this.results;

        } catch (error) {
            console.error('Scraping failed:', error);
            if (this.browser) await this.browser.close();
            throw error;
        }
    }
}

// Standalone execution
if (require.main === module) {
    (async () => {
        const scraper = new PuppeteerSevaScraper();
        const results = await scraper.scrape(10);
        console.log('Results:', JSON.stringify(results, null, 2));
    })();
}
