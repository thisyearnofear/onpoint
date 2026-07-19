"use client";

interface ShareBarProps {
  title: string;
  shareUrl: string;
}

export function ShareBar({ title, shareUrl }: ShareBarProps) {
  return (
    <div className="flex gap-2">
      <button
        className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
        onClick={() => {
          if (navigator.share) {
            navigator.share({ title, url: shareUrl });
          } else {
            navigator.clipboard.writeText(shareUrl);
          }
        }}
      >
        Copy link
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-medium transition-colors hover:bg-muted"
      >
        Tweet
      </a>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-medium transition-colors hover:bg-muted"
      >
        WhatsApp
      </a>
    </div>
  );
}
