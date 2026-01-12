
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

                for (const item of pageListings) {
                    if (parsedCount >= targetCount) break;
                    results.push(item);
                    parsedCount++;
                }

                if (parsedCount >= targetCount) break;

                // Pagination: Caroline uses "Load More" or numbered pagination?
                // Analysis shows it seems to load all via "Lihat Semua" or grid. 
                // We'll try to find a "Next" button or click a "Load More" button if it exists.
                // For now, if we scraped one page and it's infinite scroll, the autoScroll above handles view.
                // If there's pagination buttons:
                const nextBtn = await page.$('li.next a, button[aria-label="Next"], button:contains("Selanjutnya")');
                if (nextBtn) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => null),
                        nextBtn.click()
                    ]);
                    pageNum++;
                } else {
                    // Assume single page or infinite scroll handled
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
