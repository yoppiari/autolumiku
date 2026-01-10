import { PuppeteerOLXScraper } from './puppeteer-olx-scraper';

/**
 * Universal Scraper Engine
 * Wrapper for existing proven scrapers
 */
export class UniversalScraperEngine {
    /**
     * Scrape a source
     */
    async scrape(
        source: string,
        targetCount: number = 50,
        onProgress?: (vehicle: any) => Promise<void>
    ): Promise<void> {
        const sourceUpper = source.toUpperCase();

        console.log(`🔍 Starting scrape for ${sourceUpper}, target: ${targetCount}`);

        try {
            // For now, use OLX scraper as it's proven to work
            // Other sources can be added later when we have their scrapers ready
            if (sourceUpper === 'OLX' || sourceUpper === 'ALL') {
                const scraper = new PuppeteerOLXScraper();
                const results = await scraper.scrape(targetCount, false);

                console.log(`✅ OLX scraper returned ${results.length} results`);

                if (onProgress) {
                    for (const vehicle of results) {
                        await onProgress(vehicle);
                    }
                }
            } else {
                // For other sources, return empty for now
                console.warn(`⚠️ Source ${sourceUpper} not yet implemented, returning 0 results`);
            }
        } catch (error) {
            console.error(`❌ Scraper error for ${sourceUpper}:`, error);
            throw error;
        }
    }
}
