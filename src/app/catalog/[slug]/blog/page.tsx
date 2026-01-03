/**
 * Blog Listing Page
 * Route: /catalog/[slug]/blog
 */

// Disable caching to always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import BlogCard from '@/components/catalog/BlogCard';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { prisma } from '@/lib/prisma';
import { getBlogUrl } from '@/lib/utils/url-helper';


export default async function BlogPage({ params }: { params: any }) {
    const { slug } = await params;
    const headersList = headers();
    const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
    const tenantDomain = headersList.get('x-tenant-domain');

    // 1. Fetch Tenant - try multiple lookup strategies
    let tenant = await prisma.tenant.findUnique({
        where: { slug },
    });

    // Fallback 1: Try without -id suffix (e.g., primamobil-id -> primamobil)
    if (!tenant && slug.endsWith('-id')) {
        const slugWithoutId = slug.replace(/-id$/, '');
        tenant = await prisma.tenant.findUnique({
            where: { slug: slugWithoutId },
        });
    }

    // Fallback 2: Try by domain for custom domains
    if (!tenant && isCustomDomain && tenantDomain) {
        tenant = await prisma.tenant.findFirst({
            where: {
                OR: [
                    { domain: tenantDomain },
                    { domain: `www.${tenantDomain}` },
                    { domain: tenantDomain.replace('www.', '') },
                ],
            },
        });
    }

    if (!tenant) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Showroom Not Found</h1>
                </div>
            </div>
        );
    }

    const blogPosts = await prisma.blogPost.findMany({
        where: {
            tenantId: tenant.id,
            status: 'PUBLISHED',
        },
        orderBy: {
            publishedAt: 'desc',
        },
        select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            featuredImage: true,
            publishedAt: true,
            views: true,
            authorName: true,
        },
    });

    const getExcerpt = (content: string | null, maxLength: number = 150): string => {
        if (!content) return '';
        const text = content.replace(/<[^>]*>/g, '');
        const firstPara = text.split('\n\n')[0] || text.split('\n')[0] || text;
        if (firstPara.length > maxLength) {
            return firstPara.substring(0, maxLength) + '...';
        }
        return firstPara;
    };

    return (
        <ThemeProvider tenantId={tenant.id}>
            <div className="min-h-screen bg-background flex flex-col">
                <CatalogHeader
                    branding={{
                        name: tenant.name,
                        logoUrl: tenant.logoUrl,
                        primaryColor: tenant.primaryColor,
                        secondaryColor: tenant.secondaryColor,
                        slug: tenant.slug,
                    }}
                    phoneNumber={tenant.phoneNumber || undefined}
                    whatsappNumber={tenant.whatsappNumber || undefined}
                    slug={tenant.slug}
                    isCustomDomain={isCustomDomain}
                />

                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                            Blog & Artikel
                        </h1>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            Berita terbaru, tips otomotif, dan ulasan kendaraan dari {tenant.name}
                        </p>
                    </div>

                    {blogPosts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {blogPosts.map((post) => {
                                // Check if image URL is valid
                                const hasValidImage = post.featuredImage &&
                                    (post.featuredImage.startsWith('/') || post.featuredImage.startsWith('http')) &&
                                    post.featuredImage.length > 5;

                                return (
                                    <div key={post.id} className="group cursor-pointer flex flex-col h-full">
                                        <Link href={`/catalog/${tenant.slug}/blog/${post.slug}`} className="block">
                                            <div className="aspect-video relative rounded-2xl overflow-hidden mb-5">
                                                {hasValidImage ? (
                                                    <img
                                                        src={post.featuredImage!}
                                                        alt={post.title}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
                                                        <div className="text-center text-zinc-400">
                                                            <svg className="w-16 h-16 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                                            </svg>
                                                            <span className="text-sm font-medium">Artikel</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Date Badge */}
                                                {post.publishedAt && (
                                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">
                                                        {new Date(post.publishedAt).toLocaleDateString('id-ID', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>

                                        <div className="flex-1 flex flex-col">
                                            <div className="text-xs text-primary font-bold mb-2 uppercase tracking-wide">
                                                {post.authorName || 'Redaksi'}
                                            </div>
                                            <h3 className="text-2xl font-bold text-foreground mb-3 leading-tight group-hover:text-primary transition-colors">
                                                <Link href={`/catalog/${tenant.slug}/blog/${post.slug}`}>
                                                    {post.title}
                                                </Link>
                                            </h3>
                                            <p className="text-muted-foreground line-clamp-3 mb-4 flex-1">
                                                {getExcerpt(post.excerpt)}
                                            </p>
                                            <Link
                                                href={`/catalog/${tenant.slug}/blog/${post.slug}`}
                                                className="inline-flex items-center text-primary font-semibold hover:underline mt-auto"
                                            >
                                                Baca Selengkapnya
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-muted/30 rounded-lg">
                            <p className="text-muted-foreground text-lg">Belum ada artikel yang diterbitkan.</p>
                        </div>
                    )}
                </main>

                <GlobalFooter
                    tenant={{
                        name: tenant.name,
                        phoneNumber: tenant.phoneNumber,
                        phoneNumberSecondary: tenant.phoneNumberSecondary,
                        whatsappNumber: tenant.whatsappNumber,
                        email: tenant.email,
                        address: tenant.address,
                        city: tenant.city,
                        province: tenant.province,
                        primaryColor: tenant.primaryColor,
                    }}
                />
            </div>
        </ThemeProvider>
    );
}
