import { PuppeteerUniversalScraper } from './puppeteer-universal-scraper';
import { VehicleDataExtractorService } from '../../src/lib/ai/vehicle-data-extractor.service';

/**
 * Universal Scraper Engine
 * Wraps PuppeteerUniversalScraper and adds multi-source support with AI extraction
 */
export class UniversalScraperEngine {
    private puppeteerScraper = new PuppeteerUniversalScraper();

    // Source URL mappings
    private sourceUrls: Record<string, string> = {
        OLX: 'https://www.olx.co.id/mobil-bekas_c198',
        CARSOME: 'https://www.carsome.id/buy-car',
        MOBIL123: 'https://www.mobil123.com/mobil-dijual/indonesia',
        SEVA: 'https://www.seva.id/mobil-bekas',
        CARMUDI: 'https://www.carmudi.co.id/mobil-bekas/',
        OTO: 'https://www.oto.com/mobil-bekas',
        CAROLINE: 'https://www.caroline.id/mobil-bekas',
        AUTO2000: 'https://auto2000.co.id/bekas',
        MOBIL88: 'https://www.mobil88.com/car',
        CARRO: 'https://www.carro.id/beli-mobil',
    };

    /**
     * Scrape a source and extract vehicles
     * @param source Source name
     * @param targetCount Target number of vehicles
     * @param onProgress Callback for each vehicle found
     */
    async scrape(
        source: string,
        targetCount: number = 50,
        onProgress?: (vehicle: any) => Promise<void>
    ): Promise<void> {
        const url = this.sourceUrls[source.toUpperCase()];
        if (!url) {
            throw new Error(`Unknown source: ${source}`);
        }

        console.log(`🔍 Scraping ${source} from ${url}...`);

        // Scrape the page HTML
        const result = await this.puppeteerScraper.scrape(url);

        if (!result.success) {
            throw new Error(`Failed to scrape ${source}: ${result.error}`);
        }

        // Extract vehicles using AI
        console.log(`🤖 Extracting vehicles from ${source} HTML...`);
        const vehicles = await VehicleDataExtractorService.extractFromHTML(result.html, url);

        console.log(`✅ Extracted ${vehicles.length} vehicles from ${source}`);

        // Call progress callback for each vehicle
        if (onProgress) {
            for (const vehicle of vehicles.slice(0, targetCount)) {
                await onProgress(vehicle);
            }
        }
    }
}
