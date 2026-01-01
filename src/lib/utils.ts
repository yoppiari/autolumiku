import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Create a SEO-friendly slug for a vehicle
 * Format: {make}-{model}-{year}-{displayId}
 * Example: honda-city-2006-PM-PST-001
 */
export function createVehicleSlug(vehicle: {
  make: string;
  model: string;
  year: number;
  displayId?: string | null;
  id: string;
}): string {
  // Use displayId if available, otherwise fall back to first 8 chars of UUID
  const idPart = vehicle.displayId || vehicle.id.substring(0, 8);

  // Clean and format parts
  const cleanMake = vehicle.make.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const cleanModel = vehicle.model.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `${cleanMake}-${cleanModel}-${vehicle.year}-${idPart}`;
}

/**
 * Parse a vehicle slug to extract the identifier (displayId or UUID)
 * Returns the identifier to search for in the database
 */
export function parseVehicleSlug(slug: string): { id: string; isUuid: boolean } {
  // Handle empty
  if (!slug) return { id: '', isUuid: false };

  // Check if it's a UUID (legacy/direct access)
  if (isValidUUID(slug)) {
    return { id: slug, isUuid: true };
  }

  // Handle existing full slug format: make-model-year-displayId
  // The displayId is always at the end. It might contain hyphens (e.g. PM-PST-001)

  // Strategy: Try to find the year pattern (4 digits surrounded by hyphens)
  // The ID is everything AFTER the year
  const yearMatch = slug.match(/-(\d{4})-/);

  if (yearMatch) {
    const yearIndex = (yearMatch.index ?? 0) + yearMatch[0].length;
    // Extract everything after year and assume it's the displayId
    // Remove query params or file extensions if present (though rare in ID usage)
    const possibleId = slug.substring(yearIndex).split('?')[0].split('#')[0];
    return { id: possibleId.toUpperCase(), isUuid: false };
  }

  // Fallback: If no year pattern found, assume it might be just an ID or
  // the format is unexpected. Return the whole thing or last segment?
  // Let's assume the last segment if split by hyphens, but displayIds can have hyphens.
  // Safer to return the original input if we can't parse it structurely, 
  // but let the API try to find it as a direct Display ID.
  return { id: slug, isUuid: false };
}
