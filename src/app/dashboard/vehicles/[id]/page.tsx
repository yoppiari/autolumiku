/**
 * Redirect page for /dashboard/vehicles/[id]
 * Redirects to /dashboard/vehicles/[id]/edit
 */

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Redirect to edit page
  redirect(`/dashboard/vehicles/${id}/edit`);
}
