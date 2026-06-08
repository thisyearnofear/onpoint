import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Search, Camera } from "lucide-react";

export const metadata: Metadata = {
  title: "Vintage & Thrift Shopping Guide | BeOnPoint",
  description:
    "The complete guide to vintage and thrift fashion shopping — how to find hidden gems, check quality, size vintage pieces, and build a unique wardrobe sustainably.",
  openGraph: {
    title: "Vintage & Thrift Shopping Guide | BeOnPoint",
    description: "Find hidden gems, check quality, size vintage pieces — build a unique wardrobe sustainably.",
    images: [{ url: "/assets/3Product.png" }],
  },
};

export default function VintageThriftingGuide() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <article className="mx-auto max-w-3xl px-4 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to BeOnPoint
        </Link>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Style guide
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Vintage &amp; Thrift Shopping Guide
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            One person&rsquo;s cast-off is another person&rsquo;s treasure. Vintage and
            thrift shopping is the most sustainable way to build a distinctive wardrobe —
            but it takes a trained eye. Here&rsquo;s how to find genuine gems, spot quality,
            and navigate the world of pre-loved fashion with confidence.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">What to look for</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                item: "Denim jackets",
                why: "Vintage Levi&rsquo;s, Lee, and Wrangler jackets from the 70s-90s have superior construction and character that modern replicas can&rsquo;t match.",
              },
              {
                item: "Band T-shirts",
                why: "Original tour tees from the 80s and 90s are highly collectible. Check the tag and print date to verify era.",
              },
              {
                item: "Leather goods",
                why: "Vintage leather bags, belts, and jackets in good condition can be restored and last decades longer than fast-fashion alternatives.",
              },
              {
                item: "Tailored blazers",
                why: "Vintage blazers from quality brands offer tailoring that&rsquo;s nearly impossible to find at thrift prices.",
              },
            ].map(({ item, why }) => (
              <div key={item} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold">{item}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-5">{why}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Quality checks before you buy</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Not all vintage is good vintage. When evaluating a piece, run through this
            checklist:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Check seams: double-stitched seams outlast single-stitched. Inspect for pulling or loose threads",
              "Examine zippers: metal zippers (YKK or Talon) are a sign of quality. Plastic zippers are harder to repair",
              "Smell test: musty odour can be washed out; mildew or smoke is harder to remove",
              "Fabric integrity: hold the fabric up to light — thinning or holes indicate wear",
              "Tag research: brand labels, RN numbers, and union tags help date and authenticate pieces",
              "Stains: check under arms, collar, and cuffs. Some stains set permanently",
            ].map((check) => (
              <li key={check} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Sizing vintage pieces</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Vintage sizing is different from modern sizing. A 1990s size M fits closer
            to a modern size S. Pre-1970s sizing is even more variable — before standardised
            sizing charts, every brand used its own measurements.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Always ask for actual measurements (pit-to-pit, length, shoulder width)",
              "Vintage men&rsquo;s small often fits modern women&rsquo;s medium — consider cross-shopping",
              "Waist measurements on vintage trousers run 1-2 inches smaller than modern equivalents",
              "Vintage stretch fabrics have degraded elastic — account for less recovery",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-4 text-sm">
            <p className="font-semibold text-foreground">Virtual try-on helps here</p>
            <p className="mt-1 text-muted-foreground">
              With BeOnPoint, you can see how a vintage piece fits your body type before
              buying. Upload a photo and try on the item virtually — no more guessing
              from measurements alone.
            </p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Eras worth knowing</h2>
          <div className="mt-4 space-y-3">
            {[
              {
                era: "1940s-1950s",
                body: "High-waisted trousers, A-line skirts, structured jackets. Look for wool, tweed, and rayon. Sizing runs very small by modern standards.",
              },
              {
                era: "1960s-1970s",
                body: "Mod dresses, bell-bottoms, floral prints, leather fringe. Bolder colours and patterns. Sizing starts to approach modern standards.",
              },
              {
                era: "1980s",
                body: "Power shoulders, oversized blazers, acid-wash denim, tracksuits. Often in excellent condition because the fabric was over-engineered.",
              },
              {
                era: "1990s",
                body: "Baggy jeans, slip dresses, plaid shirts, minimalism. The most sought-after vintage era for streetwear. Sizing is closest to modern.",
              },
            ].map(({ era, body }) => (
              <div key={era} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold">{era}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-5">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Ready to try on that vintage find?
          </p>
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            <Camera className="h-4 w-4" />
            Try on vintage now
          </Link>
        </div>
      </article>
    </main>
  );
}
