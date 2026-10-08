"use client";

import {
  newShareId,
  postLookEvent,
  withShareParams,
  type ShareChannel,
} from "../../../lib/utils/share-attribution";

interface ShareBarProps {
  lookSlug: string;
  title: string;
  shareUrl: string;
}

const BUTTON =
  "flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-medium transition-colors hover:bg-muted";

export function ShareBar({ lookSlug, title, shareUrl }: ShareBarProps) {
  // Each share gets its own id so the funnel can follow it from share to
  // visit to try-on. The id is minted client-side so the URL can be built
  // synchronously inside the click gesture (navigator.share needs that).
  function attributedShare(channel: ShareChannel): string {
    const sid = newShareId();
    postLookEvent(lookSlug, "share", { shareId: sid, channel });
    return withShareParams(shareUrl, sid, channel);
  }

  return (
    <div className="flex gap-2">
      <button
        className={BUTTON}
        onClick={() => {
          if (navigator.share) {
            void navigator
              .share({ title, url: attributedShare("native") })
              .catch(() => {});
          } else {
            void navigator.clipboard.writeText(attributedShare("copy"));
          }
        }}
      >
        Copy link
      </button>
      <a
        href="#share-twitter"
        onClick={(e) => {
          e.preventDefault();
          const url = attributedShare("twitter");
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
            "_blank",
            "noopener,noreferrer",
          );
        }}
        className={BUTTON}
      >
        Tweet
      </a>
      <a
        href="#share-whatsapp"
        onClick={(e) => {
          e.preventDefault();
          const url = attributedShare("whatsapp");
          window.open(
            `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
            "_blank",
            "noopener,noreferrer",
          );
        }}
        className={BUTTON}
      >
        WhatsApp
      </a>
    </div>
  );
}
