'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Photo {
  thumbnailUrl?: string;
  originalUrl: string;
}

interface VehicleImageCarouselProps {
  photos: Photo[];
  alt: string;
  className?: string;
  imageClassName?: string;
  interval?: number; // Rotation interval in ms (default: 10000 = 10 seconds)
  showIndicators?: boolean;
  showCounter?: boolean;
  grayscale?: boolean; // For SOLD vehicles
  overlay?: React.ReactNode; // Custom overlay (e.g., SOLD badge)
  badges?: React.ReactNode; // Custom badges (e.g., status, ID)
  aspectRatio?: string; // Aspect ratio class (default: 'aspect-[16/10]')
  roundedClass?: string; // Rounded corners class
  onClick?: () => void;
}

export default function VehicleImageCarousel({
  photos,
  alt,
  className = '',
  imageClassName = '',
  interval = 6000, // 6 seconds default
  showIndicators = true,
  showCounter = true,
  grayscale = false,
  overlay,
  badges,
  aspectRatio = 'aspect-[16/10]',
  roundedClass = 'rounded-t-lg',
  onClick,
}: VehicleImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const photoCount = photos.length;
  const hasMultiplePhotos = photoCount > 1;

  // Get current photo URL
  const getCurrentPhotoUrl = useCallback(() => {
    if (photoCount === 0) return null;
    const photo = photos[currentIndex];
    return photo?.thumbnailUrl || photo?.originalUrl;
  }, [photos, currentIndex, photoCount]);

  // Auto-rotate photos
  useEffect(() => {
    if (!hasMultiplePhotos || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photoCount);
    }, interval);

    return () => clearInterval(timer);
  }, [hasMultiplePhotos, isPaused, photoCount, interval]);

  // Manual navigation
  const goToPhoto = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + photoCount) % photoCount);
  };

  const goToNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % photoCount);
  };

  const photoUrl = getCurrentPhotoUrl();

  return (
    <div
      className={`relative ${aspectRatio} bg-gray-200 ${roundedClass} overflow-hidden group ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={onClick}
    >
      {photoUrl ? (
        <>
          {/* Main Image with transition */}
          <img
            src={photoUrl}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-500 ${grayscale ? 'grayscale' : ''
              } ${imageClassName}`}
          />

          {/* Navigation Arrows (visible on hover) */}
          {hasMultiplePhotos && (
            <>
              <button
                onClick={goToPrev}
                className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="Previous photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNext}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="Next photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Dot Indicators */}
          {hasMultiplePhotos && showIndicators && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {photos.slice(0, 5).map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    goToPhoto(idx);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex
                    ? 'bg-white w-3'
                    : 'bg-white/60 hover:bg-white/80'
                    }`}
                  aria-label={`Go to photo ${idx + 1}`}
                />
              ))}
              {photoCount > 5 && (
                <span className="text-white text-[10px] ml-1">+{photoCount - 5}</span>
              )}
            </div>
          )}

          {/* Photo Counter (alternative to dots) */}
          {hasMultiplePhotos && showCounter && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {currentIndex + 1}/{photoCount}
            </div>
          )}
        </>
      ) : (
        // No photo placeholder
        <div className="w-full h-full flex flex-col items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-gray-400 mt-1">No Photo</span>
        </div>
      )}

      {/* Custom Overlay (e.g., SOLD badge) */}
      {overlay}

      {/* Custom Badges */}
      {badges}
    </div>
  );
}
