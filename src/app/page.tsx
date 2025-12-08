import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export default async function HomePage() {
  // Check if this is a custom domain (tenant site) or platform domain
  const headersList = headers();
  const tenantDomain = headersList.get('x-tenant-domain');
  const host = headersList.get('host') || '';

  // Platform domains that should redirect to login
  const platformDomains = [
    'auto.lumiku.com',
    'localhost',
    '127.0.0.1',
  ];

  const isPlatformDomain = platformDomains.some(domain =>
    host.includes(domain)
  );

  // If custom domain (tenant site), find tenant and show catalog
  if (!isPlatformDomain && tenantDomain) {
    try {
      const tenant = await prisma.tenant.findFirst({
        where: { domain: tenantDomain },
        select: { slug: true },
      });

      if (tenant) {
        redirect(`/catalog/${tenant.slug}`);
      }
    } catch (error) {
      console.error('Error finding tenant:', error);
    }
  }

  // Platform domain or tenant not found - redirect to login
  redirect('/login');
}
