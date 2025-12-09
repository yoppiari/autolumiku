import { Metadata } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const tenant = await prisma.tenant.findUnique({
        where: { slug: params.slug },
    });

    if (!tenant) return {};

    // Get headers to determine domain context
    const headersList = headers();
    const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
    const originalPath = headersList.get('x-original-path') || '';

    // Generate canonical URL based on domain context
    const canonicalUrl = isCustomDomain
        ? `https://${tenant.domain}${originalPath}`
        : `https://auto.lumiku.com/catalog/${tenant.slug}`;

    return {
        title: {
            template: `%s | ${tenant.name}`,
            default: tenant.name,
        },
        description: `Jelajahi koleksi kendaraan terlengkap di ${tenant.name}. Dapatkan mobil impian Anda dengan harga terbaik.`,
        icons: {
            icon: tenant.faviconUrl || '/favicon.ico',
        },
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: tenant.name,
            description: `Jelajahi koleksi kendaraan terlengkap di ${tenant.name}`,
            url: canonicalUrl,
            siteName: tenant.name,
            locale: 'id_ID',
            type: 'website',
            images: tenant.logoUrl ? [
                {
                    url: tenant.logoUrl,
                    width: 1200,
                    height: 630,
                    alt: tenant.name,
                }
            ] : [],
        },
        twitter: {
            card: 'summary_large_image',
            title: tenant.name,
            description: `Jelajahi koleksi kendaraan terlengkap di ${tenant.name}`,
            images: tenant.logoUrl ? [tenant.logoUrl] : [],
        },
    };
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
