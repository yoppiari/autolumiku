
import puppeteer from 'puppeteer';

export class PuppeteerCarmudiScraper {
    async scrape(targetCount: number = 50): Promise<any[]> {
        console.log(`🚗 [CARMUDI] Starting scraper for target: ${targetCount} listings...`);
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1366,768'
            ]
        });

        const results: any[] = [];

        try {
            const page = await browser.newPage();

            // MANUAL STEALTH: Hide WebDriver and spoof features
            await page.evaluateOnNewDocument(() => {
                // @ts-ignore
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                // @ts-ignore
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                // @ts-ignore
                Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });
            });

            // Set Headers to force Indonesian language
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Upgrade-Insecure-Requests': '1'
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set viewport to desktop to ensure all elements are visible
            await page.setViewport({ width: 1366, height: 768 });

            // Navigate to Carmudi used cars page
            // Filter can be adjusted later, but for now we scrape general Used Cars in Indonesia
            const baseUrl = 'https://www.carmudi.co.id/mobil-bekas-dijual/indonesia';
            console.log(`🔗 [CARMUDI] Navigating to ${baseUrl}...`);

            await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            let parsedCount = 0;
            let pageNum = 1;

            while (parsedCount < targetCount) {
                console.log(`📄 [CARMUDI] Scraping page ${pageNum}...`);

                // Wait for listings to appear (try multiple selectors)
                const selectorFound = await Promise.race([
                    page.waitForSelector('.listing', { timeout: 10000 }),
                    page.waitForSelector('article', { timeout: 10000 }),
                    page.waitForSelector('[data-listing-id]', { timeout: 10000 })
                ]).catch(() => null);

                if (!selectorFound) console.log("⚠️ No main listing selector found on this page");

                // Evaluate page content
                const pageListings = await page.evaluate(() => {
                    const items: any[] = [];
                    // Try multiple strategies to find listings
                    const listingNodes = document.querySelectorAll('.listing, article[data-listing-id], .c-listing');

                    listingNodes.forEach((node) => {
                        try {
                            // 1. Title (Make Model Year)
                            // Try multiple title selectors
                            const titleEl = node.querySelector('.listing__title a') || node.querySelector('h2 a') || node.querySelector('h3 a');
                            const fullTitle = titleEl ? titleEl.textContent?.trim() || '' : '';

                            // 2. Price
                            const priceEl = node.querySelector('.listing__price') || node.querySelector('.price span');
                            const priceText = priceEl ? priceEl.textContent?.trim() || '' : '';
                            // Clean price: "Rp 150.000.000" -> 150000000
                            const priceMatch = priceText.match(/Rp\s*([\d\.]+)/);
                            const priceClean = priceMatch ? priceMatch[1].replace(/\./g, '') : priceText.replace(/[^0-9]/g, '');
                            const price = parseInt(priceClean) || 0;

                            // 3. URLs
                            const linkEl = titleEl as HTMLAnchorElement; // Usually title is the link
                            const url = linkEl ? linkEl.href : '';

                            const imgEl = node.querySelector('img.listing__img') || node.querySelector('img');
                            // Check data-src first (lazy load), then src
                            const imageUrl = imgEl ? (imgEl.getAttribute('data-src') || (imgEl as HTMLImageElement).src) : '';

                            // 4. Specs (Location, Transmission, Mileage) from icons
                            let location = '';
                            let transmission = '';
                            let mileage = '';
                            let year = 0;

                            // Parse title for Year
                            const yearMatch = fullTitle.match(/(\d{4})/);
                            if (yearMatch) {
                                year = parseInt(yearMatch[0], 10);
                            }

                            // Specs Container
                            const specContainer = node.querySelector('.listing__specs');
                            if (specContainer) {
                                // Specs often in .listing__specs .item
                                const items = specContainer.querySelectorAll('.item');
                                items.forEach((item: any) => {
                                    const text = item.textContent?.trim() || '';
                                    const icon = item.querySelector('i');
                                    if (icon) {
                                        if (icon.className.includes('icon--location')) location = text;
                                        if (icon.className.includes('icon--transmission')) transmission = text;
                                        if (icon.className.includes('icon--meter')) mileage = text;
                                    } else {
                                        // Fallback by text content
                                        if (text.includes('KM') || text.includes('km')) mileage = text;
                                        else if (text.match(/AT|MT|Manual|Auto/)) transmission = text;
                                        else if (text.length > 3 && !text.match(/\d/)) location = text;
                                    }
                                });
                            }

                            // Extract Make/Model from Title
                            // "Toyota Avanza G MPV 2018"
                            let titleClean = fullTitle.replace(year.toString(), '').trim();
                            // If title starts with year "2018 Toyota...", remove it
                            if (/^\d{4}\s/.test(titleClean)) titleClean = titleClean.substring(5).trim();

                            const titleParts = titleClean.split(' ');
                            const make = titleParts[0] || 'Unknown';
                            const model = titleParts.slice(1, 3).join(' '); // Take next 2 words as model

                            // Try to find engine capacity (e.g. 1.5, 2.0, 2400cc)
                            const engineMatch = fullTitle.match(/(\d\.\d)L?|(\d{4})\s*cc/i);
                            const engineCapacity = engineMatch ? (engineMatch[1] || engineMatch[2]) : '';

                            // Try to detect color from title if common names appear
                            const colors = ['Putih', 'Hitam', 'Silver', 'Abu', 'Merah', 'Biru', 'Kuning', 'Hijau', 'Coklat', 'Orange'];
                            const colorMatch = colors.find(c => fullTitle.includes(c));
                            const color = colorMatch || 'Unknown';

                            if (fullTitle && price > 0) {
                                items.push({
                                    source: 'CARMUDI',
                                    make,
                                    model,
                                    year,
                                    price,
                                    priceDisplay: priceText,
                                    location,
                                    url,
                                    imageUrl,
                                    transmission,
                                    mileageDisplay: mileage,
                                    // Parse "50.000 - 55.000 KM" -> take 50000
                                    mileage: parseInt(mileage.split('-')[0].replace(/[^0-9]/g, '')) || 0,
                                    engineCapacity,
                                    color,
                                    title: fullTitle
                                });
                            }
                        } catch (err) {
                            // Ignore single item error
                        }
                    });

                    return items;
                });

                if (pageListings.length === 0) {
                    console.log(`⚠️ [CARMUDI] No items found on page ${pageNum}. Stopping.`);
                    break;
                }

                console.log(`✅ [CARMUDI] Found ${pageListings.length} listings on page ${pageNum}`);

                // Add valid listings to results
                for (const item of pageListings) {
                    if (parsedCount >= targetCount) break;

                    // Visit detail page for rich specifications (Color, Engine, etc.)
                    // This creates a new page for each item to be safe/independent
                    if (item.url) {
                        const details = await this.extractDetailSpecs(item.url, browser);
                        // Merge details: favor detail page data over listing card data
                        if (details.color) item.color = details.color;
                        if (details.engineCapacity) item.engineCapacity = details.engineCapacity;
                        if (details.transmission) item.transmission = details.transmission;
                        if (details.mileageDisplay) item.mileageDisplay = details.mileageDisplay;
                        if (details.description) item.description = details.description;

                        // Re-parse mileage if it changed
                        if (details.mileageDisplay) {
                            const mStr = details.mileageDisplay.split('-')[0].replace(/[^0-9]/g, '');
                            item.mileage = parseInt(mStr) || 0;
                        }
                    }

                    results.push(item);
                    parsedCount++;
                }

                if (parsedCount >= targetCount) {
                    console.log(`🏁 [CARMUDI] Goal reached (${parsedCount}/${targetCount}).`);
                    break;
                }

                // Next Page
                // Check for "Next" button pagination
                // Carmudi usually has a .pagination .next or similar
                const hasNextPage = await page.evaluate(() => {
                    const nextBtn = document.querySelector('.pagination a[rel="next"]');
                    return !!nextBtn;
                });

                if (hasNextPage) {
                    pageNum++;
                    console.log(`➡️ [CARMUDI] Navigating to page ${pageNum}...`);
                    try {
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
                            page.click('.pagination a[rel="next"]')
                        ]);
                    } catch (e) {
                        console.log(`❌ [CARMUDI] Failed to navigate to next page: ${e}`);
                        break;
                    }
                } else {
                    console.log(`🛑 [CARMUDI] No more pages.`);
                    break;
                }
            }

        } catch (error) {
            console.error(`❌ [CARMUDI] Scraper Error:`, error);
        } finally {
            await browser.close();
        }

        console.log(`📦 [CARMUDI] Finished. Total scraped: ${results.length}`);
        return results;
    }

    /**
     * Extracts detailed specifications from a specific car listing page.
     * This addresses the user's need to get full specs like "Warna", "Kapasitas Mesin", etc.
     */
    async extractDetailSpecs(url: string, browser: any): Promise<any> {
        let page;
        try {
            page = await browser.newPage();
            // Stealth / Viewport settings
            await page.setViewport({ width: 1366, height: 768 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            console.log(`🕵️ [CARMUDI-DETAIL] Inspecting: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Extract data using the selectors found during manual inspection
            const details = await page.evaluate(() => {
                const data: any = {};

                // Helper to find spec value by label text
                // Specs are often in: .c-card__body -> title (label) + text (value)
                const findSpec = (labelPart: string) => {
                    // Strategy 1: Look for common spec containers
                    const containers = document.querySelectorAll('.c-card__body, .u-margin-bottom-none, .listing__stats-item');

                    for (let n = 0; n < containers.length; n++) {
                        const c = containers[n];
                        const text = c.textContent || '';
                        if (text.toLowerCase().includes(labelPart.toLowerCase())) {
                            // Try to get the clean value. Usually the structure is Label ... Value or Value ... Label
                            // For Carmudi new design (cards):
                            // <span>Kilometer</span> <span>50.000 KM</span>
                            const spans = c.querySelectorAll('span, div');
                            // If we find the label in a span, the next span might be the value
                            for (let i = 0; i < spans.length; i++) {
                                if (spans[i].textContent?.toLowerCase().includes(labelPart.toLowerCase())) {
                                    // Return the NEXT element's text if exists
                                    if (spans[i + 1]) return spans[i + 1].textContent?.trim();
                                }
                            }
                            // Fallback: just return the whole text minus the label
                            return text.replace(new RegExp(labelPart, 'qi'), '').trim();
                        }
                    }
                    return null;
                };

                // 1. Color
                const color = findSpec('Warna');
                if (color) data.color = color;

                // 2. Engine Capacity (cc)
                const engine = findSpec('Kapasitas mesin') || findSpec('Cakupan mesin');
                if (engine) data.engineCapacity = engine;

                // 3. Transmission (verify)
                const trans = findSpec('Transmisi');
                if (trans) data.transmission = trans;

                // 4. Mileage (verify)
                const mile = findSpec('Jarak tempuh') || findSpec('Kilometer');
                if (mile) data.mileageDisplay = mile;

                // 5. Description
                const descEl = document.querySelector('#tab-seller-notes, .c-seller-notes');
                if (descEl) data.description = descEl.textContent?.trim();

                return data;
            });

            if (details) {
                console.log(`   ✅ Details found: Color=${details.color}, Engine=${details.engineCapacity}`);
            }

            return details;

        } catch (err) {
            console.error(`   ⚠️ Failed to extract details: ${err}`);
            return {};
        } finally {
            if (page) await page.close();
        }
    }
}
