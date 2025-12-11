import { Metadata } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getTheme, generateCSSVariables } from '@/lib/themes/theme-definitions';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    try {
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
    } catch (error) {
        console.error('generateMetadata Error:', error);
        return {
            title: 'Error'
        };
    }
}

export default async function TenantLayout({
    children,
    params
}: {
    children: React.ReactNode,
    params: { slug: string }
}) {
    // 1. Fetch Tenant Theme Info Server-Side
    let tenant = null;
    try {
        tenant = await prisma.tenant.findUnique({
            where: { slug: params.slug },
            select: {
                selectedTheme: true,
                theme: true // 'light' | 'dark' | 'auto'
            }
        });
    } catch (error) {
        console.error('TenantLayout Error:', error);
        // Fallback to null, children will render (likely 404 or error boundary if downstream fails)
        // Or we can let it throw if we want the Error Boundary to catch it immediately.
        // But throwing here might be safer to guarantee Error Boundary catches it.
        throw error;
    }

    if (!tenant) return <>{children}</>;

    // 2. Resolve Theme Definition
    const themeDef = getTheme(tenant.selectedTheme || 'modern');

    // 3. Generate CSS Variables (Force Dark for 'automotive-dark' or rely on tenant.theme)
    // For Prima Mobil (automotive-dark), we know it prefers dark.
    // Ideally we generate both or handle based on user pref, but for FOUC protection 
    // we inject the "Default" for this tenant.
    const mode = tenant.selectedTheme === 'automotive-dark' ? 'dark' : (tenant.theme === 'dark' ? 'dark' : 'light');
    const cssVariables = generateCSSVariables(themeDef, mode);

    // Convert CSS variables string to style object
    const cssVarsObject = cssVariables
        .split(';')
        .filter(v => v.trim())
        .reduce((acc, rule) => {
            const [key, value] = rule.split(':').map(s => s.trim());
            if (key && value) {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, string>);

    return (
        <>
            {/*
                Inject theme CSS variables as inline style on wrapper div.
                Inline styles have highest specificity and override globals.css @layer base.
                CSS variables inherit to all children elements.
            */}
            <div
                className={`min-h-screen ${mode} bg-background text-foreground`}
                style={cssVarsObject}
            >
                {children}
            </div>
        </>
    );
}
