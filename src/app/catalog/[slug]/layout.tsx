import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const tenant = await prisma.tenant.findUnique({
        where: { slug: params.slug },
    });

    if (!tenant) return {};

    return {
        title: {
            template: `%s | ${tenant.name}`,
            default: tenant.name,
        },
        icons: {
            icon: tenant.faviconUrl || '/favicon.ico',
        },
    };
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
