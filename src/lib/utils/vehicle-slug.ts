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
 * Example: https://primamobil.id/dashboard/vehicles/[vehicleId]
 */
export function generateVehicleDashboardUrl(vehicleId: string, baseUrl: string = 'https://primamobil.id'): string {
  return `${baseUrl}/dashboard/vehicles/${vehicleId}`;
}
