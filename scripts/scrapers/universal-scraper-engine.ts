import { PuppeteerUniversalScraper } from './puppeteer-universal-scraper';
import { Page } from 'puppeteer';

/**
 * Universal Scraper Engine
 * Uses Puppeteer to scrape car listing pages with CSS selectors
 */
export class UniversalScraperEngine {
    private puppeteerScraper = new PuppeteerUniversalScraper();

    // Source configurations with selectors
    private sourceConfigs: Record<string, {
        url: string;
        cardSelector: string;
        titleSelector: string;
        priceSelector: string;
        locationSelector?: string;
        linkSelector: string;
    }> = {
            OLX: {
                url: 'https://www.olx.co.id/mobil-bekas_c198',
                cardSelector: '[data-aut-id="itemBox"]',
                titleSelector: '[data-aut-id="itemTitle"]',
                priceSelector: '[data-aut-id="itemPrice"]',
                locationSelector: '[data-aut-id="item-location"]',
                linkSelector: 'a[href*="/item/"]'
            },
            CARRO: {
                url: 'https://www.carro.id/beli-mobil',
                cardSelector: '.car-card, [class*="CarCard"]',
                titleSelector: 'h3, .car-title, [class*="Title"]',
                priceSelector: '.price, [class*="Price"]',
                linkSelector: 'a[href*="/mobil/"]'
            },
            MOBIL88: {
                url: 'https://www.mobil88.com/car',
                cardSelector: '.car-item, .product-card',
                titleSelector: '.car-name, .product-title',
                priceSelector: '.car-price, .product-price',
                linkSelector: 'a'
            },
            AUTO2000: {
                url: 'https://auto2000.co.id/bekas',
                cardSelector: '.car-card, .vehicle-item',
                titleSelector: '.car-title, h3',
                priceSelector: '.price',
                linkSelector: 'a'
            },
            CARSOME: {
                url: 'https://www.carsome.id/buy-car',
                cardSelector: '[class*="CarCard"], .car-item',
                titleSelector: 'h3, .title',
                priceSelector: '[class*="Price"], .price',
                linkSelector: 'a'
            },
            CARMUDI: {
                url: 'https://www.carmudi.co.id/mobil-bekas/',
                cardSelector: '.listing-item, .car-item',
                titleSelector: '.title, h2',
                priceSelector: '.price',
                linkSelector: 'a'
            },
            OTO: {
                url: 'https://www.oto.com/mobil-bekas',
                cardSelector: '.car-card, .item',
                titleSelector: '.title, h3',
                priceSelector: '.price',
                linkSelector: 'a'
            },
            MOBIL123: {
                url: 'https://www.mobil123.com/mobil-dijual/indonesia',
                cardSelector: '.listing__item',
                titleSelector: '.listing__title',
                priceSelector: '.listing__price',
                linkSelector: 'a'
            }
        };

    /**
     * Scrape a source and extract vehicles from listing page
     */
    async scrape(
        source: string,
        targetCount: number = 50,
        onProgress?: (vehicle: any) => Promise<void>
    ): Promise<void> {
        const config = this.sourceConfigs[source.toUpperCase()];
        if (!config) {
            throw new Error(`Unknown source: ${source}`);
        }

        console.log(`🔍 Scraping ${source} from ${config.url}...`);

        // Scrape the listing page
        const result = await this.puppeteerScraper.scrape(config.url);

        if (!result.success) {
            throw new Error(`Failed to scrape ${source}: ${result.error}`);
        }

        console.log(`🤖 Parsing listings from ${source}...`);

        // Parse HTML to extract vehicle data
        const vehicles = this.parseListings(result.html, config, source.toUpperCase(), result.url);

        if (vehicles.length === 0) {
            console.warn(`⚠️ No vehicles found from ${source}`);
            return;
        }

        console.log(`✅ Found ${vehicles.length} vehicles from ${source}`);

        // Call progress callback for each vehicle
        if (onProgress) {
            for (const vehicle of vehicles.slice(0, targetCount)) {
                await onProgress(vehicle);
            }
        }
    }

    /**
     * Parse listing HTML using regex (simpler than full DOM parsing)
     */
    private parseListings(html: string, config: any, source: string, baseUrl: string): any[] {
        const vehicles: any[] = [];

        // Extract all card sections
        const cardRegex = new RegExp(`<[^>]*class="[^"]*${config.cardSelector.replace('.', '')}[^"]*"[^>]*>([\\s\\S]*?)</(?:div|li|article)>`, 'gi');
        const cards = html.match(cardRegex) || [];

        for (const card of cards.slice(0, 50)) {
            try {
                // Extract title
                const titleMatch = card.match(new RegExp(`>${config.titleSelector.replace('.', '[^<]*')}[^<]*<[^>]*>([^<]+)<`, 'i')) ||
                    card.match(/>([^<]*(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|BMW|Mercedes)[^<]*)</i);
                const title = titleMatch ? titleMatch[1].trim() : '';

                // Extract price
                const priceMatch = card.match(/Rp\s?([\d.,]+)\s?(?:juta|jt|ribu)?/i);
                const priceStr = priceMatch ? priceMatch[0] : '';
                const price = this.parsePrice(priceStr);

                // Extract location
                const locationMatch = card.match(/(?:Kota|Kab\.|Jakarta|Bandung|Surabaya|Medan|Makassar|Semarang|Tangerang|Depok|Bekasi|Palembang|Bogor)[^<]*/i);
                const location = locationMatch ? locationMatch[0].trim() : null;

                // Extract URL
                const urlMatch = card.match(/href="([^"]+)"/i);
                const url = urlMatch ? (urlMatch[1].startsWith('http') ? urlMatch[1] : baseUrl + urlMatch[1]) : baseUrl;

                if (!title || price === 0) continue;

                // Parse make/model/year from title
                const parsed = this.parseTitle(title);

                vehicles.push({
                    source,
                    make: parsed.make,
                    model: parsed.model,
                    year: parsed.year,
                    price,
                    priceDisplay: priceStr || `Rp ${price.toLocaleString('id-ID')}`,
                    location,
                    url,
                    variant: parsed.variant,
                    transmission: parsed.transmission,
                    fuelType: parsed.fuelType,
                });
            } catch (e) {
                // Skip failed cards
                continue;
            }
        }

        return vehicles;
    }

    /**
     * Parse price string to number
     */
    private parsePrice(priceStr: string): number {
        if (!priceStr) return 0;

        // Remove "Rp" and clean
        let cleaned = priceStr.replace(/Rp\.?/gi, '').replace(/\s/g, '').replace(/,/g, '');

        // Handle "juta" (million) and "ribu" (thousand)
        if (/juta|jt/i.test(priceStr)) {
            const num = parseFloat(cleaned.replace(/[^\d.]/g, ''));
            return Math.floor(num * 1000000);
        } else if (/ribu|rb/i.test(priceStr)) {
            const num = parseFloat(cleaned.replace(/[^\d.]/g, ''));
            return Math.floor(num * 1000);
        }

        return parseInt(cleaned.replace(/[^\d]/g, '')) || 0;
    }

    /**
     * Parse title to extract make, model, year, variant, etc.
     */
    private parseTitle(title: string): any {
        const makes = ['Toyota', 'Honda', 'Suzuki', 'Daihatsu', 'Mitsubishi', 'Nissan', 'Mazda', 'BMW', 'Mercedes', 'Audi', 'Hyundai', 'KIA', 'Ford', 'Chevrolet', 'Wuling', 'DFSK', 'Chery'];

        let make = '';
        for (const m of makes) {
            if (new RegExp(m, 'i').test(title)) {
                make = m;
                break;
            }
        }

        // Extract year
        const yearMatch = title.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // Extract model (word after make)
        const modelMatch = title.match(new RegExp(`${make}\\s+([A-Za-z0-9-]+)`, 'i'));
        const model = modelMatch ? modelMatch[1] : '';

        // Extract variant
        const variantMatch = title.match(/\b(E|G|S|RS|GLS|GLX|MT|AT|CVT|Turbo|Hybrid)\b/i);
        const variant = variantMatch ? variantMatch[0] : undefined;

        // Extract transmission
        const transmission = /\b(MT|Manual|Matic|AT|Automatic|CVT)\b/i.test(title)
            ? (/MT|Manual/i.test(title) ? 'Manual' : 'Automatic')
            : undefined;

        // Extract fuel type
        const fuelType = /\b(Bensin|Diesel|Hybrid|Electric)\b/i.test(title)
            ? title.match(/\b(Bensin|Diesel|Hybrid|Electric)\b/i)![0]
            : undefined;

        return { make, model, year, variant, transmission, fuelType };
    }
}
