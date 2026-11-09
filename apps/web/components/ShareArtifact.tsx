"use client";

import { ShareSheet } from "./social/ShareSheet";
import type { ShareChannel } from "@/lib/utils/share-attribution";

/**
 * Back-compat wrapper: same props as before, now channel-aware.
 * Pass `imageUrl` for the Instagram download tile.
 */
export function ShareArtifact({
  title,
  text,
  url,
  imageUrl,
  lookSlug,
  label,
  onShare,
}: {
  title: string;
  text?: string;
  url: string;
  imageUrl?: string | null;
  lookSlug?: string | null;
  label?: string;
  /** Extra attribution hook — called with (channel, attributedUrl, sid) per send. */
  onShare?: (channel: ShareChannel, url: string, sid: string) => void;
}) {
  return (
    <ShareSheet
      title={title}
      text={text}
      url={url}
      imageUrl={imageUrl}
      lookSlug={lookSlug}
      label={label ?? "Send it"}
      onShare={onShare}
    />
  );
}
