import { permanentRedirect } from "next/navigation";

/**
 * `/looks` was a second browse surface for the same catalog the wardrobe's
 * outfits tab now shows. 301 because these URLs were shared and linked from
 * live look pages; every param is carried across — dropping `sid`, `pick`,
 * `theme` or `judge` would silently break share attribution and the Runway
 * deep links that mint them.
 */
export default async function LooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (value) for (const v of value) params.append(key, v);
  }
  params.set("tab", "outfits");
  permanentRedirect(`/?${params.toString()}`);
}
