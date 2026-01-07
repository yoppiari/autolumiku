/**
 * Vehicle URL Slug Generator
 * Creates SEO-friendly URLs for vehicles
 */

/**
 * Generate SEO-friendly vehicle slug
 * Format: [make]-[model]-[year]-[displayId]
 * Example: honda-city-2006-pm-pst-001
 */
export function generateVehicleSlug(vehicle: {
  make: string;
  model: string;
  year: number;
  displayId: string;
}): string {
  const { make, model, year, displayId } = vehicle;

  // Clean and format each part
  const cleanMake = make.toLowerCase().replace(/\s+/g, '-');
  const cleanModel = model.toLowerCase().replace(/\s+/g, '-');
  const cleanYear = year.toString();
  const cleanDisplayId = displayId.toLowerCase().replace(/_/g, '-');

  // Combine with hyphens
  return `${cleanMake}-${cleanModel}-${cleanYear}-${cleanDisplayId}`;
}

/**
 * Resolve displayId from a vehicle slug
 * Format: [make]-[model]-[year]-[displayId]
 */
export function resolveDisplayIdFromSlug(slug: string): string | null {
  if (!slug) return null;
  const parts = slug.split('-');
  if (parts.length < 4) return null;

  // The displayId is the last part (or last few parts if it contains hyphens)
  // For now, assume it's the part after the year
  const yearIndex = parts.findIndex(p => /^\d{4}$/.test(p));
  if (yearIndex === -1 || yearIndex === parts.length - 1) {
    return parts[parts.length - 1]; // Fallback to last part
  }

  return parts.slice(yearIndex + 1).join('-').toUpperCase();
}

/**
 * Generate full vehicle URL for public website
 * Example: https://primamobil.id/vehicles/honda-city-2006-pm-pst-001
 */
export function generateVehicleUrl(vehicle: {
  make: string;
  model: string;
  year: number;
  displayId: string;
}, baseUrl: string = 'https://primamobil.id'): string {
  const slug = generateVehicleSlug(vehicle);
  return `${baseUrl}/vehicles/${slug}`;
}

/**
 * Generate vehicle dashboard URL
 * Format: https://primamobil.id/dashboard/vehicles/[slug]
 */
export function generateVehicleDashboardUrl(vehicle: {
  make: string;
  model: string;
  year: number;
  displayId: string;
} | string, baseUrl: string = 'https://primamobil.id'): string {
  if (typeof vehicle === 'string') {
    return `${baseUrl}/dashboard/vehicles/${vehicle}/edit`;
  }
  const slug = generateVehicleSlug(vehicle);
  return `${baseUrl}/dashboard/vehicles/${slug}/edit`;
}
