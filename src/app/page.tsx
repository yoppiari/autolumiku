import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// Force dynamic rendering since we use headers()
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  console.log('[HomePage] Starting...');

  try {
    // Check if this is a custom domain (tenant site) or platform domain
    const headersList = headers();
    const host = headersList.get('host') || '';

    console.log('[HomePage] host:', host);

    // For now, always redirect to login
    redirect('/login');
  } catch (error) {
    console.error('[HomePage] Error:', error);
    throw error;
  }
}
