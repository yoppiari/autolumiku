import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HomePage() {
  // Immediately redirect to login
  redirect('/login');
}
