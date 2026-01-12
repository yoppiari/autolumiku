
import puppeteer from 'puppeteer';

export class PuppeteerOtoScraper {
    async scrape(targetCount: number = 50): Promise<any[]> {
        console.log(`🔴 [OTO] Starting scraper for target: ${targetCount} listings...`);
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

            // Navigate to Oto.com Used Cars
            const baseUrl = 'https://www.oto.com/mobil-bekas';
            console.log(`🔗 [OTO] Navigating to ${baseUrl}...`);

            await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            let parsedCount = 0;
            let attempts = 0;
            const maxAttempts = 20; // Prevent infinite loops

            while (parsedCount < targetCount && attempts < maxAttempts) {
                console.log(`📄 [OTO] Scraping batch loop ${attempts + 1}...`);

                // Wait for listings to appear
                try {
                    await page.waitForSelector('.used-car-card, .listing-card, li.card', { timeout: 10000 });
                } catch (e) {
                    console.log("⚠️ No listings found or timeout.");
                }

                // Extract Listings currently on page
                const pageListings = await page.evaluate(() => {
                    const items: any[] = [];
                    // Verified selectors: .used-car-card or .listing-card
                    const cards = Array.from(document.querySelectorAll('.used-car-card, .listing-card, li.card'));

                    cards.forEach(card => {
                        try {
                            // 1. Title & Year
                            const nameLink = card.querySelector('.vh-name, .title, a[href*="detail-mobil-bekas"]');
                            const rawTitle = nameLink ? nameLink.textContent?.trim() || '' : '';

                            // "2019 Honda Jazz RS CVT"
                            let year = 0;
                            const yearMatch = rawTitle.match(/^(\d{4})/);
                            if (yearMatch) {
                                year = parseInt(yearMatch[1]);
                            }

                            // Remove year from title for Make/Model parsing
                            let titleClean = rawTitle.replace(/^\d{4}\s+/, '');

                            // 2. Price
                            // Price can be in .price, .vh-price, or .card-price
                            const priceEl = card.querySelector('.price, .vh-price, .card-price, [class*="price"]');
                            const priceText = priceEl ? priceEl.textContent?.trim() || '' : '';

                            // Parse "Rp 265 Juta" -> 265000000
                            let price = 0;
                            const digitMatch = priceText.match(/([\d\.,]+)/);
                            if (digitMatch) {
                                let rawNum = parseFloat(digitMatch[1].replace(/,/g, '.')); // Handle comma decimals if any, usually OTO uses dot or comma
                                if (priceText.toLowerCase().includes('juta')) {
                                    price = rawNum * 1000000;
                                } else if (priceText.toLowerCase().includes('milyar') || priceText.toLowerCase().includes('miliar')) {
                                    price = rawNum * 1000000000;
                                } else {
                                    // Raw Format "Rp 265.000.000"
                                    price = parseInt(priceText.replace(/[^0-9]/g, ''));
                                }
                            }

                            // 3. URL & Image
                            const url = nameLink ? (nameLink as HTMLAnchorElement).href : '';
                            const imgEl = card.querySelector('img');
                            const imageUrl = imgEl ? (imgEl.dataset.src || imgEl.src) : '';

                            // 4. Specs (Location, KM, Transmission)
                            // Usually in tags (ul li or span)
                            const tags = Array.from(card.querySelectorAll('ul li, span, .item-list')).map(t => t.textContent?.trim() || '');

                            let location = '';
                            let mileageDisplay = '';
                            let transmission = 'Unknown';
                            let engineCapacity = '';

                            // Heuristic to assign tags
                            tags.forEach(tag => {
                                if (tag.match(/\d+\s*(?:km|rb|ribu)/i)) {
                                    mileageDisplay = tag;
                                } else if (tag.match(/Manual|Automatic|CVT|Otomatis|Matic/i)) {
                                    transmission = tag.replace(/Otomatis/i, 'Automatic');
                                } else if (tag.match(/cc$/i)) {
                                    engineCapacity = tag;
                                } else if (tag.length > 3 && !tag.match(/\d/) && location === '' && !tag.match(/bensin|diesel/i)) {
                                    // First non-digit text usually location (e.g. "Jakarta Selatan") -> Exclude fuel
                                    location = tag;
                                }
                            });

                            let mileage = 0;
                            if (mileageDisplay) {
                                mileage = parseInt(mileageDisplay.replace(/[^0-9]/g, '')) || 0;
                            }

                            // Make/Model inference
                            const parts = titleClean.split(' ');
                            const make = parts[0] || 'Unknown';
                            const model = parts.slice(1, 3).join(' ');

                            if (rawTitle && price > 0) {
                                items.push({
                                    source: 'OTO',
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
                                    mileageDisplay,
                                    engineCapacity,
                                    title: rawTitle,
                                    status: 'AVAILABLE'
                                });
                            }

                        } catch (e) {
                            // ignore faulty card
                        }
                    });

                    return items;
                });

                // Add NEW items only
                let newItemsCount = 0;
                for (const item of pageListings) {
                    // Check if already in our local results (simple dedupe by URL)
                    if (!results.find(r => r.url === item.url)) {
                        results.push(item);
                        newItemsCount++;
                        parsedCount++;
                    }
                    if (parsedCount >= targetCount) break;
                }

                console.log(`   + Added ${newItemsCount} new items (Total: ${parsedCount}/${targetCount})`);

                if (parsedCount >= targetCount) break;

                // Load More Strategy
                // Click "Load More" button if available
                const loadMoreBtn = await page.$('#btn-view-all, .load-more-btn, button:contains("Muat Lebih")');
                if (loadMoreBtn && await loadMoreBtn.isVisible()) {
                    console.log("   ⬇️ Clicking 'Load More'...");
                    try {
                        await loadMoreBtn.click();
                        // Wait for new items to load
                        await new Promise(r => setTimeout(r, 3000));
                    } catch (e) {
                        console.log("   ⚠️ Failed to click Load More.");
                        break;
                    }
                } else {
                    // Try simple scrolling if no button
                    console.log("   ⬇️ Scrolling down...");
                    const previousHeight = await page.evaluate('document.body.scrollHeight');
                    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                    await new Promise(r => setTimeout(r, 3000));
                    const newHeight = await page.evaluate('document.body.scrollHeight');

                    if (newHeight === previousHeight) {
                        console.log("🛑 End of infinite scroll/pagination.");
                        break;
                    }
                }

                attempts++;
            }

        } catch (error) {
            console.error(`❌ [OTO] Scraper Error:`, error);
        } finally {
            await browser.close();
        }

        console.log(`📦 [OTO] Finished. Total scraped: ${results.length}`);
        return results;
    }
}
