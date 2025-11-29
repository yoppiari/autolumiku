/**
 * Scraper Service
 *
 * Wraps the Puppeteer scraper and integrates with database for job tracking,
 * duplicate detection, and staging data before import to production.
 *
 * Story 2.10: Super Admin Vehicle Data Scraper
 */

import { PrismaClient, Prisma, ScraperJob, ScraperResult } from '@prisma/client';

const prisma = new PrismaClient();

// Dynamic imports for scrapers (only loaded at runtime, not during build)
async function loadOLXScraper() {
  const { PuppeteerOLXScraper } = await import('../../../scripts/scrapers/puppeteer-olx-scraper');
  return new PuppeteerOLXScraper();
}

async function loadCarsomeScraper() {
  const { PuppeteerCarsomeScraper } = await import('../../../scripts/scrapers/puppeteer-carsome-scraper');
  return new PuppeteerCarsomeScraper();
}

export interface ScraperJobOptions {
  source: 'OLX' | 'CARSOME' | 'ALL';
  targetCount?: number;
  executedBy: string;
}

export interface DuplicateMatch {
  isDuplicate: boolean;
  confidence: number;
  matchedVehicleId?: string;
}

export interface ImportOptions {
  autoApproveThreshold?: number; // Auto-approve if confidence > threshold
  overwritePrices?: boolean;
}

export class ScraperService {
  /**
   * Start a new scraper job
   */
  async startJob(options: ScraperJobOptions): Promise<ScraperJob> {
    // Create job record
    const job = await prisma.scraperJob.create({
      data: {
        status: 'running',
        source: options.source,
        targetCount: options.targetCount || 50,
        executedBy: options.executedBy,
      },
    });

    // Run scraper in background (don't await)
    this.runScraper(job.id, options).catch((error) => {
      console.error(`Scraper job ${job.id} failed:`, error);
    });

    return job;
  }

  /**
   * Run the actual scraper
   */
  private async runScraper(jobId: string, options: ScraperJobOptions): Promise<void> {
    const startTime = Date.now();

    try {
      let vehicles: any[] = [];

      // Run scraper based on source
      if (options.source === 'ALL') {
        // Run both scrapers
        console.log('Running ALL scrapers...');

        const olxScraper = await loadOLXScraper();
        const carsomeScraper = await loadCarsomeScraper();

        const [olxVehicles, carsomeVehicles] = await Promise.all([
          olxScraper.scrape(Math.floor((options.targetCount || 50) / 2), true),
          carsomeScraper.scrape(Math.floor((options.targetCount || 50) / 2)),
        ]);

        vehicles = [...olxVehicles, ...carsomeVehicles];

      } else if (options.source === 'OLX') {
        // Run OLX scraper with detail page visits
        const scraper = await loadOLXScraper();
        vehicles = await scraper.scrape(options.targetCount || 50, true);

      } else if (options.source === 'CARSOME') {
        // Run CARSOME scraper
        const scraper = await loadCarsomeScraper();
        vehicles = await scraper.scrape(options.targetCount || 50);

      } else {
        throw new Error(`Source ${options.source} not supported`);
      }

      // Store results in database
      let newCount = 0;
      let duplicateCount = 0;
      const errors: string[] = [];

      for (const vehicle of vehicles) {
        try {
          // Check for duplicates
          const duplicateMatch = await this.detectDuplicate(vehicle);

          // Create scraper result
          await prisma.scraperResult.create({
            data: {
              jobId,
              source: vehicle.source || options.source, // Use vehicle.source (OLX/CARSOME) from scraper
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              price: BigInt(vehicle.price),
              priceDisplay: vehicle.priceDisplay,
              location: vehicle.location || null,
              url: vehicle.url || '',
              variant: vehicle.variant || null,
              transmission: vehicle.transmission || null,
              fuelType: vehicle.fuelType || null,
              bodyType: vehicle.bodyType || null,
              features: vehicle.features || null,
              description: vehicle.description || null,
              status: duplicateMatch.isDuplicate ? 'duplicate' : 'pending',
              matchedVehicleId: duplicateMatch.matchedVehicleId,
              confidence: duplicateMatch.confidence,
            },
          });

          if (duplicateMatch.isDuplicate) {
            duplicateCount++;
          } else {
            newCount++;
          }
        } catch (error) {
          errors.push(`Failed to process ${vehicle.make} ${vehicle.model}: ${error}`);
        }
      }

      // Update job with results
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await prisma.scraperJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          vehiclesFound: vehicles.length,
          vehiclesNew: newCount,
          duplicates: duplicateCount,
          duration,
          errors: errors.length > 0 ? errors : Prisma.JsonNull,
        },
      });
    } catch (error) {
      // Mark job as failed
      await prisma.scraperJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      });
    }
  }

  /**
   * Detect if vehicle is duplicate of existing PopularVehicle
   */
  private async detectDuplicate(vehicle: any): Promise<DuplicateMatch> {
    // Get duplicate threshold from config
    const config = await this.getConfig('duplicate_threshold');
    const threshold = config?.value as number || 80;

    // Find similar vehicles in PopularVehicle table
    const existingVehicles = await prisma.popularVehicle.findMany({
      where: {
        make: { equals: vehicle.make, mode: 'insensitive' },
      },
    });

    for (const existing of existingVehicles) {
      let confidence = 0;

      // Exact make match (case insensitive)
      if (existing.make.toLowerCase() === vehicle.make.toLowerCase()) {
        confidence += 40;
      }

      // Model similarity
      const modelSimilarity = this.calculateStringSimilarity(
        existing.model.toLowerCase(),
        vehicle.model.toLowerCase()
      );
      confidence += modelSimilarity * 30;

      // Year match
      if (vehicle.year > 0 && existing.productionYears) {
        const years = existing.productionYears as number[];
        if (years.includes(vehicle.year)) {
          confidence += 20;
        }
      }

      // Price similarity (within 10%)
      if (vehicle.year > 0 && existing.usedCarPrices) {
        const prices = existing.usedCarPrices as any;
        const yearPrices = prices[vehicle.year.toString()];
        if (yearPrices) {
          const avgPrice = (yearPrices.min + yearPrices.max) / 2;
          const priceDiff = Math.abs(vehicle.price - avgPrice) / avgPrice;
          if (priceDiff < 0.1) {
            confidence += 10;
          }
        }
      }

      // If confidence exceeds threshold, it's a duplicate
      if (confidence >= threshold) {
        return {
          isDuplicate: true,
          confidence: Math.round(confidence),
          matchedVehicleId: existing.id,
        };
      }
    }

    return { isDuplicate: false, confidence: 0 };
  }

  /**
   * Calculate string similarity (0-1)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    // Levenshtein distance
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get job status
   */
  async getJob(jobId: string): Promise<ScraperJob | null> {
    return await prisma.scraperJob.findUnique({
      where: { id: jobId },
      include: {
        results: {
          take: 5, // Preview only
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Get all jobs (with pagination)
   */
  async getJobs(page: number = 1, pageSize: number = 20): Promise<{
    jobs: ScraperJob[];
    total: number;
  }> {
    const skip = (page - 1) * pageSize;

    const [jobs, total] = await Promise.all([
      prisma.scraperJob.findMany({
        skip,
        take: pageSize,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.scraperJob.count(),
    ]);

    return { jobs, total };
  }

  /**
   * Get results for a job
   */
  async getResults(jobId: string, filters?: {
    status?: string;
    make?: string;
  }): Promise<ScraperResult[]> {
    return await prisma.scraperResult.findMany({
      where: {
        jobId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.make && { make: { contains: filters.make, mode: 'insensitive' } }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approve a result (mark ready for import)
   */
  async approveResult(resultId: string, userId: string): Promise<ScraperResult> {
    return await prisma.scraperResult.update({
      where: { id: resultId },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: userId,
      },
    });
  }

  /**
   * Reject a result
   */
  async rejectResult(resultId: string, userId: string): Promise<ScraperResult> {
    return await prisma.scraperResult.update({
      where: { id: resultId },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: userId,
      },
    });
  }

  /**
   * Import approved results to PopularVehicle table
   */
  async importResults(jobId: string, options?: ImportOptions): Promise<{
    imported: number;
    updated: number;
    skipped: number;
  }> {
    const results = await prisma.scraperResult.findMany({
      where: {
        jobId,
        status: 'approved',
      },
    });

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const result of results) {
      // Skip if duplicate (unless overwrite enabled)
      if (result.matchedVehicleId && !options?.overwritePrices) {
        // Update existing vehicle's price if changed
        const existing = await prisma.popularVehicle.findUnique({
          where: { id: result.matchedVehicleId },
        });

        if (existing && result.year > 0) {
          const prices = (existing.usedCarPrices as any) || {};
          const yearKey = result.year.toString();
          const currentPrice = prices[yearKey];

          // Update if price changed significantly (>5%)
          if (!currentPrice ||
              Math.abs(Number(result.price) - currentPrice.min) > currentPrice.min * 0.05) {
            prices[yearKey] = {
              min: Number(result.price),
              max: Number(result.price),
            };

            await prisma.popularVehicle.update({
              where: { id: result.matchedVehicleId },
              data: {
                usedCarPrices: prices,
                updatedAt: new Date(),
              },
            });

            updated++;
          } else {
            skipped++;
          }
        }
        continue;
      }

      // Create new vehicle
      try {
        await prisma.popularVehicle.create({
          data: {
            make: result.make,
            model: result.model,
            category: 'Unknown', // Will be categorized manually later
            bodyType: 'Unknown',
            variants: [],
            productionYears: result.year > 0 ? [result.year] : [],
            engineOptions: [],
            engineCapacity: {},
            transmissionTypes: [],
            fuelTypes: [],
            seatingCapacity: [],
            driveType: [],
            usedCarPrices: result.year > 0 ? {
              [result.year]: {
                min: Number(result.price),
                max: Number(result.price),
              },
            } : {},
            popularityScore: 10, // Default low score
            commonInRegions: [],
            targetMarket: [],
            standardFeatures: {},
            commonKeywords: [],
            commonMisspellings: [],
            isActive: true,
          },
        });

        imported++;
      } catch (error) {
        console.error(`Failed to import ${result.make} ${result.model}:`, error);
        skipped++;
      }
    }

    // Mark job as imported
    await prisma.scraperJob.update({
      where: { id: jobId },
      data: { vehiclesUpdated: updated },
    });

    return { imported, updated, skipped };
  }

  /**
   * Get or create config
   */
  async getConfig(key: string): Promise<any> {
    return await prisma.scraperConfig.findUnique({
      where: { key },
    });
  }

  /**
   * Update config
   */
  async updateConfig(key: string, value: any, userId: string): Promise<void> {
    await prisma.scraperConfig.upsert({
      where: { key },
      update: {
        value,
        updatedBy: userId,
      },
      create: {
        key,
        value,
        updatedBy: userId,
      },
    });
  }

  /**
   * Get dashboard stats
   */
  async getStats(): Promise<{
    lastRun: Date | null;
    totalVehicles: number;
    pendingReview: number;
    todayImported: number;
  }> {
    const lastJob = await prisma.scraperJob.findFirst({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });

    const pendingResults = await prisma.scraperResult.count({
      where: { status: 'pending' },
    });

    const totalVehicles = await prisma.popularVehicle.count();

    // Count today's imports (results approved today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayImported = await prisma.scraperResult.count({
      where: {
        status: 'approved',
        reviewedAt: { gte: todayStart },
      },
    });

    return {
      lastRun: lastJob?.completedAt || null,
      totalVehicles,
      pendingReview: pendingResults,
      todayImported,
    };
  }
}

// Export singleton
export const scraperService = new ScraperService();
