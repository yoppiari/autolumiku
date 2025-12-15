'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Check, X, Copy, Link } from 'lucide-react';
import { FaWhatsapp, FaFacebook, FaTelegram, FaTwitter } from 'react-icons/fa';

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
}

export default function ShareButton({ title, text, url }: ShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    return url || (typeof window !== 'undefined' ? window.location.href : '');
  };

  const handleShare = async () => {
    const shareUrl = getShareUrl();

    // Try Web Share API first (mobile-friendly)
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled or error - show modal instead
        if ((err as Error).name === 'AbortError') {
          return; // User cancelled, do nothing
        }
      }
    }

    // Fallback: Show share modal
    setShowModal(true);
  };

  const copyToClipboard = async () => {
    const shareUrl = getShareUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Final fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareUrl = getShareUrl();
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${title} - ${text}`);

  const shareLinks = [
    {
      name: 'WhatsApp',
      icon: FaWhatsapp,
      color: 'bg-green-500 hover:bg-green-600',
      url: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      name: 'Facebook',
      icon: FaFacebook,
      color: 'bg-blue-600 hover:bg-blue-700',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'Twitter',
      icon: FaTwitter,
      color: 'bg-sky-500 hover:bg-sky-600',
      url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      name: 'Telegram',
      icon: FaTelegram,
      color: 'bg-blue-500 hover:bg-blue-600',
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
  ];

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        size="lg"
        onClick={handleShare}
      >
        <Share2 className="w-5 h-5 mr-2" />
        Bagikan
      </Button>

      {/* Share Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowModal(false)}>
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Bagikan</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {shareLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center p-3 rounded-lg text-white ${link.color} transition-colors`}
                  onClick={() => setShowModal(false)}
                >
                  <link.icon className="w-6 h-6" />
                  <span className="text-xs mt-1">{link.name}</span>
                </a>
              ))}
            </div>

            {/* Copy link */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-2">Atau salin link:</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg overflow-hidden">
                  <Link className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{shareUrl}</span>
                </div>
                <Button
                  size="sm"
                  onClick={copyToClipboard}
                  className={copied ? 'bg-green-600 hover:bg-green-600' : ''}
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {copied && (
                <p className="text-sm text-green-600 mt-2">Link berhasil disalin!</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
