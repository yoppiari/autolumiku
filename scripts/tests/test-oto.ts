
import { PuppeteerOtoScraper } from './puppeteer-oto-scraper';

async function run() {
    console.log("🚀 Starting OTO Scraper Test...");
    const scraper = new PuppeteerOtoScraper();
    try {
        const results = await scraper.scrape(5); // Try scrape 5 items
        console.log("✅ Scrape Complete!");
        console.log(`Found ${results.length} items.`);

        if (results.length > 0) {
            console.log("Sample Item:", JSON.stringify(results[0], null, 2));
        } else {
            console.error("❌ No items found. Possible selector issue.");
        }
    } catch (error) {
        console.error("❌ Scraper Fatal Error:", error);
    }
}

run();
