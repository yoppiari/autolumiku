/**
 * Google Map Embed Component
 * Stable component that prevents re-renders and flickering
 */

'use client';

import React, { memo } from 'react';

interface GoogleMapEmbedProps {
  address: string;
  title?: string;
  className?: string;
  height?: string;
}

// Memoized to prevent re-renders when parent updates
const GoogleMapEmbed = memo(function GoogleMapEmbed({
  address,
  title = 'Location Map',
  className = '',
  height = '500px',
}: GoogleMapEmbedProps) {
  // Construct Google Maps Embed URL
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div
      className={`rounded-2xl overflow-hidden bg-muted ${className}`}
      style={{ minHeight: height }}
    >
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0, minHeight: height }}
        loading="eager"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={mapUrl}
        title={title}
      />
    </div>
  );
});

export default GoogleMapEmbed;
