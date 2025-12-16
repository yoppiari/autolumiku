'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface BlogCardProps {
  post: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    featuredImage: string | null;
    publishedAt: Date | null;
    views: number;
  };
  blogUrl: string;
}

// Check if string looks like a valid image URL
function isValidImageUrl(url: string | null): boolean {
  if (!url) return false;
  // Must start with / (relative) or http (absolute)
  if (!url.startsWith('/') && !url.startsWith('http')) return false;
  // Should not be too short
  if (url.length < 5) return false;
  return true;
}

export default function BlogCard({ post, blogUrl }: BlogCardProps) {
  const [imageError, setImageError] = useState(false);
  const hasValidImage = isValidImageUrl(post.featuredImage) && !imageError;

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
    <Card className="hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)] hover:border-primary/50 transition-all duration-300 overflow-hidden bg-card/60 backdrop-blur-sm group border-muted">
      <CardHeader className="p-0">
        <div className="aspect-video relative bg-zinc-800 overflow-hidden">
          {hasValidImage ? (
            <img
              src={post.featuredImage!}
              alt={post.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
              <div className="text-center text-zinc-400">
                <svg className="w-16 h-16 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <span className="text-sm font-medium">Artikel</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-lg mb-2 line-clamp-2">{post.title}</CardTitle>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {getExcerpt(post.excerpt)}
        </p>
        <div className="mt-4 text-xs text-muted-foreground">
          {post.publishedAt && new Date(post.publishedAt).toLocaleDateString('id-ID')} • {post.views} views
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button asChild variant="outline" className="w-full">
          <Link href={blogUrl}>Baca Selengkapnya</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
