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
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">No Image</span>
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
