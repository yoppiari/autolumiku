'use client';

interface ShareButtonsProps {
  title: string;
}

export default function ShareButtons({ title }: ShareButtonsProps) {
  const handleShareFacebook = () => {
    const url = window.location.href;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank'
    );
  };

  const handleShareTwitter = () => {
    const url = window.location.href;
    const text = title;
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const text = title;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
      '_blank'
    );
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link berhasil disalin!');
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={handleShareFacebook}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
      >
        📘 Facebook
      </button>
      <button
        onClick={handleShareTwitter}
        className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 text-sm"
      >
        🐦 Twitter
      </button>
      <button
        onClick={handleShareWhatsApp}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
      >
        💬 WhatsApp
      </button>
      <button
        onClick={handleCopyLink}
        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
      >
        🔗 Copy Link
      </button>
    </div>
  );
}
