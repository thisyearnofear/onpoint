"use client";

import { ShareArtifact } from "../../../components/ShareArtifact";
import { postLookEvent } from "../../../lib/utils/share-attribution";

/**
 * ShareArtifact wired to the look funnel — every share mints a sid and posts
 * the look share event so share → visit → try-on joins downstream.
 */
export function LookShareButton({
  lookSlug,
  title,
  text,
  url,
  imageUrl,
}: {
  lookSlug: string;
  title: string;
  text?: string;
  url: string;
  imageUrl?: string | null;
}) {
  return (
    <ShareArtifact
      title={title}
      text={text}
      url={url}
      imageUrl={imageUrl}
      lookSlug={lookSlug}
      label="Share"
      onShare={(channel, _u, sid) =>
        postLookEvent(lookSlug, "share", { shareId: sid, channel })
      }
    />
  );
}
