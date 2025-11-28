/**
 * Blog Detail Page
 * Route: /catalog/[slug]/blog/[postSlug]
 */

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, User, Eye } from 'lucide-react';

const prisma = new PrismaClient();

export default async function BlogPostPage({
    params
}: {
    params: { slug: string; postSlug: string }
}) {
    const { slug, postSlug } = params;

    const tenant = await prisma.tenant.findUnique({
        where: { slug },
    });

    if (!tenant) {
        return notFound();
    }

    // Fetch blog post with author
    const post = await prisma.blogPost.findFirst({
        where: {
            tenantId: tenant.id,
            slug: postSlug,
            status: 'PUBLISHED',
        },
        // author relation doesn't exist, we use authorName directly from the model
    });

    if (!post) {
        return notFound();
    }

    // Increment view count (this should ideally be a server action or API call to avoid hydration issues, 
    // but for now we'll skip it or do it in a useEffect if it was a client component. 
    // Since this is a server component, we can update it directly but it makes the page dynamic)
    // await prisma.blogPost.update({
    //   where: { id: post.id },
    //   data: { views: { increment: 1 } },
    // });

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
                />

                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto">
                        <Button asChild variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-primary">
                            <Link href={`/catalog/${tenant.slug}/blog`} className="flex items-center gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Kembali ke Blog
                            </Link>
                        </Button>

                        <article className="bg-card rounded-lg shadow-sm overflow-hidden border">
                            {post.featuredImage && (
                                <div className="aspect-video w-full relative">
                                    <img
                                        src={post.featuredImage}
                                        alt={post.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            <div className="p-6 md:p-10">
                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                                    {post.publishedAt && (
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            <span>{new Date(post.publishedAt).toLocaleDateString('id-ID', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <User className="w-4 h-4" />
                                        <span>{post.authorName || 'Admin'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Eye className="w-4 h-4" />
                                        <span>{post.views} views</span>
                                    </div>
                                </div>

                                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-8 leading-tight">
                                    {post.title}
                                </h1>

                                <div
                                    className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary"
                                    dangerouslySetInnerHTML={{ __html: post.content }}
                                />
                            </div>
                        </article>

                        {/* Share or CTA could go here */}
                        <div className="mt-12 text-center">
                            <h3 className="text-xl font-bold mb-4">Tertarik dengan kendaraan kami?</h3>
                            <div className="flex justify-center gap-4">
                                <Button asChild size="lg">
                                    <Link href={`/catalog/${tenant.slug}/vehicles`}>Lihat Koleksi Mobil</Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href={`/catalog/${tenant.slug}/contact`}>Hubungi Kami</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
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
