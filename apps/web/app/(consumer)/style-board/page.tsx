import { permanentRedirect } from "next/navigation";

/**
 * The style board merged into the wardrobe studio (`/?tab=outfits`).
 * Old links — including runway "fix" shares with ?pick=<id>&sid=&utm_ — are
 * forwarded; the studio selects the picked outfit on stage.
 */
export default async function StyleBoardPage({
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
