'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Twitter, Link as LinkIcon, MessageCircle } from 'lucide-react';

interface ShareButtonsProps {
    title: string;
}

export default function ShareButtons({ title }: ShareButtonsProps) {
    const [currentUrl, setCurrentUrl] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setCurrentUrl(window.location.href);
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(currentUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareLinks = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`,
        twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(title)}`,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(title + ' ' + currentUrl)}`,
    };

    if (!currentUrl) return null;

    return (
        <div className="flex flex-wrap gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(shareLinks.facebook, '_blank')}
                className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
                <Facebook className="w-4 h-4" />
                Facebook
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(shareLinks.twitter, '_blank')}
                className="gap-2 text-sky-500 hover:text-sky-600 hover:bg-sky-50"
            >
                <Twitter className="w-4 h-4" />
                Twitter
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(shareLinks.whatsapp, '_blank')}
                className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
            >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2 hover:bg-gray-100"
            >
                <LinkIcon className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy Link'}
            </Button>
        </div>
    );
}
