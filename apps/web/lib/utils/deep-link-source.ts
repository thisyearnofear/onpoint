/**
 * A `from=` param says *where the visitor came from*. It is not a curator slug
 * unless it names one — storefront links pass a slug, artifact links (a card, a
 * wish list, a magazine) pass the kind of thing they are. Treating `card` as a
 * slug printed "Styling from card's storefront" and sent it into the storefront
 * API on every artifact landing.
 */

/** Words artifact surfaces use instead of a slug. Keep in step with API-side validation. */
export const ARTIFACT_SOURCES = ["card", "list", "mag"] as const;

export type ArtifactSource = (typeof ARTIFACT_SOURCES)[number];

export type DeepLinkSource =
  | { kind: "storefront"; curatorSlug: string }
  | { kind: "artifact"; artifact: ArtifactSource }
  | null;

export function resolveDeepLinkSource(from: string | null | undefined): DeepLinkSource {
  if (!from) return null;
  let value = from;
  try {
    value = decodeURIComponent(from);
  } catch {
    // A malformed escape is still a value — share links are user input.
  }
  const artifact = ARTIFACT_SOURCES.find((candidate) => candidate === value);
  if (artifact) return { kind: "artifact", artifact };
  return { kind: "storefront", curatorSlug: value };
}

/** Honest caption for the banner — a storefront names itself, an artifact names the hand-off. */
export function describeDeepLinkSource(source: DeepLinkSource): string | null {
  if (!source) return null;
  if (source.kind === "storefront") return `Styling from ${source.curatorSlug}'s storefront`;
  return ARTIFACT_CAPTIONS[source.artifact];
}

const ARTIFACT_CAPTIONS: Record<ArtifactSource, string> = {
  card: "Styled from a card someone sent you",
  list: "Styled from a wish list",
  mag: "Styled from your issue of the magazine",
};
