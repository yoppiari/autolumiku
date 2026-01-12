
import puppeteer from 'puppeteer';

export class PuppeteerCarolineScraper {
    async scrape(targetCount: number = 50): Promise<any[]> {
        console.log(`🟡 [CAROLINE] Starting scraper for target: ${targetCount} listings...`);
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080'
            ]
        });

        const results: any[] = [];

        try {
            const page = await browser.newPage();

            // Stealth settings
            await page.evaluateOnNewDocument(() => {
                // @ts-ignore
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });

            // Navigate to Caroline Beli Mobil page
            const baseUrl = 'https://www.caroline.id/beli-mobil';
            console.log(`🔗 [CAROLINE] Navigating to ${baseUrl}...`);

            await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            let parsedCount = 0;
            let pageNum = 1;

            while (parsedCount < targetCount) {
                console.log(`📄 [CAROLINE] Scraping page ${pageNum}...`);

                // Wait for listings
                // Based on analysis: Card is div.group.mb-3 (inside grid)
                try {
                    await page.waitForSelector('div.group.mb-3, h2[title]', { timeout: 15000 });
                } catch (e) {
                    console.log("⚠️ Timeout waiting for selectors. Page structure might have changed or no results.");
                }

                // Auto-scroll to trigger lazy loads
                await this.autoScroll(page);

                // Extract Listings
                const pageListings = await page.evaluate(() => {
                    const items: any[] = [];
                    // Select all card containers
                    // The site uses a grid, cards usually have 'group' and 'mb-3' classes or are inside anchors
                    const cards = Array.from(document.querySelectorAll('div.group.mb-3'));

                    if (cards.length === 0) {
                        // Fallback strategy: look for images with specific classes or H2 titles
                        const h2s = Array.from(document.querySelectorAll('h2[title]'));
                        // Map back to parent containers if needed, or just extract from h2 context
                        // For now, let's stick to the card selector identified: div.group.mb-3
                    }

                    cards.forEach(card => {
                        try {
                            // 1. Title & URL & ID
                            const titleEl = card.querySelector('h2[title]');
                            const linkEl = card.querySelector('a');

                            const title = titleEl ? titleEl.getAttribute('title')?.trim() || titleEl.textContent?.trim() || '' : '';
                            const url = linkEl ? linkEl.href : '';

                            if (!title) return;

                            // 2. Price
                            // Selector: p[data-component="renderCarPrice"]
                            const priceEl = card.querySelector('p[data-component="renderCarPrice"]');
                            const priceText = priceEl ? priceEl.textContent?.trim() || '' : '';
                            // "Rp 150.000.000" -> 150000000
                            const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

                            // 3. Image
                            const imgEl = card.querySelector('img');
                            const imageUrl = imgEl ? (imgEl.src || imgEl.getAttribute('srcset')?.split(' ')[0] || '') : '';

                            // 4. Details (Mileage, Trans, Location)
                            // Usually found next to icons
                            let mileage = 0;
                            let transmission = 'Unknown';
                            let location = '';
                            let year = 0;

                            // Location often in p[title]
                            const locEl = card.querySelector('p[title]');
                            if (locEl) location = locEl.getAttribute('title') || locEl.textContent || '';

                            // Specs rows: Look for text nodes or siblings of specific icons/images
                            // Caroline uses img icons for "Kilometer", "Transmisi"
                            const allText = card.innerText;

                            // Year is often in title "Toyota Avanza G 2019"
                            const yearMatch = title.match(/\b(20\d{2})\b/);
                            if (yearMatch) year = parseInt(yearMatch[1]);

                            // Transmission: often "AT" or "MT" isolated
                            if (allText.match(/\b(AT|MT|Manual|Automatic)\b/i)) {
                                transmission = allText.match(/\b(AT|MT|Manual|Automatic)\b/i)![0];
                            }

                            // Mileage: Look for "KM"
                            // Can't easily use XPath here, so we iterate all paragraphs/spans
                            const spans = Array.from(card.querySelectorAll('span, p'));
                            for (const s of spans) {
                                const t = s.textContent || '';
                                if (t.includes('KM') && t.length < 20) {
                                    mileage = parseInt(t.replace(/[^0-9]/g, '')) || 0;
                                }
                            }

                            // Explicit checks for Transmission/Fuel via images if possible
                            // (Simplified for cheerio-like extraction)

                            if (title && price > 0) {
                                // Parse Make/Model from Title
                                // "Toyota Avanza 1.3 G"
                                const parts = title.split(' ');
                                const make = parts[0] || 'Unknown';
                                const model = parts.slice(1).join(' '); // Simple approx

                                items.push({
                                    source: 'CAROLINE',
                                    make,
                                    model,
                                    year,
                                    price,
                                    priceDisplay: priceText,
                                    location,
                                    url,
                                    imageUrl,
                                    transmission,
                                    mileage,
                                    mileageDisplay: `${mileage} KM`,
                                    title,
                                    status: 'AVAILABLE' // Default
                                });
                            }

                        } catch (err) {
                            // ignore faulty card
                        }
                    });

                    return items;
                });

                if (pageListings.length === 0) {
                    console.log(`⚠️ [CAROLINE] No items found on page ${pageNum}.`);
                    break;
                }

                console.log(`✅ [CAROLINE] Found ${pageListings.length} listings on page ${pageNum}`);

                // Add valid listings to results
                for (const item of pageListings) {
                    if (parsedCount >= targetCount) break;

                    // Visit detail page for rich specifications (Color, Engine, etc.)
                    if (item.url) {
                        try {
                            const details = await this.extractDetailSpecs(item.url, browser);
                            // Merge details: favor detail page data
                            if (details.color) item.color = details.color;
                            if (details.engineCapacity) item.engineCapacity = details.engineCapacity;
                            if (details.transmission && details.transmission !== 'Unknown') item.transmission = details.transmission;
                            if (details.fuelType) item.fuelType = details.fuelType;
                            if (details.mileage > 0) item.mileage = details.mileage;
                            if (details.mileageDisplay) item.mileageDisplay = details.mileageDisplay;
                            if (details.details) item.description = JSON.stringify(details.details); // Store extra specs as string if needed
                        } catch (err) {
                            console.error(`⚠️ Failed to scrape details for ${item.url}:`, err);
                        }
                    }

                    results.push(item);
                    parsedCount++;
                }

                if (parsedCount >= targetCount) break;

                // Pagination logic...
                // (Existing pagination logic remains here)
                const nextBtn = await page.$('li.next a, button[aria-label="Next"], button:contains("Selanjutnya")');
                if (nextBtn) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => null),
                        nextBtn.click()
                    ]);
                    pageNum++;
                } else {
                    console.log("🛑 [CAROLINE] No next page button found.");
                    break;
                }
            }
        } catch (error) {
            console.error(`❌ [CAROLINE] Scraper Error:`, error);
        } finally {
            await browser.close();
        }

        console.log(`📦 [CAROLINE] Finished. Total scraped: ${results.length}`);
        return results;
    }

    /**
     * Extracts detailed specifications from a specific car detail page.
     */
    async extractDetailSpecs(url: string, browser: any): Promise<any> {
        let page;
        try {
            page = await browser.newPage();
            // Stealth / Viewport settings
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            console.log(`🕵️ [CAROLINE-DETAIL] Inspecting: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

            // SCROLL DOWN to trigger lazy loading of specs section
            await this.autoScroll(page);

            // Extract data using the selectors found during manual inspection
            const details = await page.evaluate(() => {
                const data: any = {};

                // Helper to find spec value by label text
                // Structure: div.flex.justify-between -> span (Label) + span (Value)
                const getSpecValue = (labelPart: string) => {
                    // Try to find the label span
                    const spans = Array.from(document.querySelectorAll('span'));
                    const labelSpan = spans.find(s => s.textContent?.trim().toLowerCase().includes(labelPart.toLowerCase()));

                    if (labelSpan) {
                        // The value is usually the next sibling or inside the next element
                        const nextSpan = labelSpan.nextElementSibling;
                        if (nextSpan) return nextSpan.textContent?.trim();

                        // Sometimes it might be in a parent row structure
                        const row = labelSpan.closest('.flex.justify-between');
                        if (row) {
                            const valueSpan = row.lastElementChild;
                            if (valueSpan && valueSpan !== labelSpan) return valueSpan.textContent?.trim();
                        }
                    }
                    return null;
                };

                // 1. Color
                const color = getSpecValue('Warna');
                if (color) data.color = color;

                // 2. Transmission
                const trans = getSpecValue('Transmisi');
                if (trans) data.transmission = trans;

                // 3. Fuel Type
                const fuel = getSpecValue('Bahan Bakar');
                if (fuel) data.fuelType = fuel;

                // 4. Mileage (Kilometer)
                const km = getSpecValue('Kilometer');
                if (km) {
                    data.mileageDisplay = km;
                    data.mileage = parseInt(km.replace(/[^0-9]/g, '')) || 0;
                }

                // 5. Engine Capacity
                // Usually not in table, check Title or other location
                // "Toyota Yaris S TRD 1.5" -> 1.5
                const title = document.querySelector('h1')?.textContent || '';
                const engineMatch = title.match(/(\d\.\d)/);
                if (engineMatch) {
                    // Convert 1.5 -> 1500cc approx logic if needed, or keep as string
                    data.engineCapacity = engineMatch[1] + 'L';
                }

                // 6. Plate & Tax
                const plate = getSpecValue('No Polisi');
                const tax = getSpecValue('Masa Berlaku STNK');

                data.details = {
                    plate: plate || 'Unknown',
                    tax: tax || 'Unknown'
                };

                return data;
            });

            if (details) {
                console.log(`   ✅ Details found: Color=${details.color}, Trans=${details.transmission}`);
            }

            return details;

        } catch (err) {
            console.error(`   ⚠️ Failed to extract details: ${err}`);
            return {};
        } finally {
            if (page) await page.close();
        }
    }

    private async autoScroll(page: any) {
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }
}
