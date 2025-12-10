import { Metadata } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getTheme, generateCSSVariables } from '@/lib/themes/theme-definitions';

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

export default async function TenantLayout({
    children,
    params
}: {
    children: React.ReactNode,
    params: { slug: string }
}) {
    // 1. Fetch Tenant Theme Info Server-Side
    const tenant = await prisma.tenant.findUnique({
        where: { slug: params.slug },
        select: {
            selectedTheme: true,
            theme: true // 'light' | 'dark' | 'auto'
        }
    });

    if (!tenant) return <>{children}</>;

    // 2. Resolve Theme Definition
    const themeDef = getTheme(tenant.selectedTheme || 'modern');

    // 3. Generate CSS Variables (Force Dark for 'automotive-dark' or rely on tenant.theme)
    // For Prima Mobil (automotive-dark), we know it prefers dark.
    // Ideally we generate both or handle based on user pref, but for FOUC protection 
    // we inject the "Default" for this tenant.
    const mode = tenant.selectedTheme === 'automotive-dark' ? 'dark' : (tenant.theme === 'dark' ? 'dark' : 'light');
    const cssVariables = generateCSSVariables(themeDef, mode);

    return (
        <html lang="id" className={mode}>
            <head>
                {/* Critical CSS Injection to prevent FOUC */}
                <style
                    id="server-side-theme"
                    dangerouslySetInnerHTML={{
                        __html: `:root { ${cssVariables} }`
                    }}
                />
            </head>
            <body>
                {children}
            </body>
        </html>
    );
}
