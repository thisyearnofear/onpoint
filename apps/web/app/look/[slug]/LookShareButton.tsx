"use client";

import { ShareArtifact } from "../../../components/ShareArtifact";

/**
 * Look share button. ShareSheet already posts the look `share` event via
 * logShare when `lookSlug` is set — passing an onShare that posts it again
 * would double-count every share, so there is deliberately no onShare here.
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
    />
  );
}
