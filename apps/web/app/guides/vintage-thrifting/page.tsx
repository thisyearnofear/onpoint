import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Search, Camera, Tag, Clock, Zap } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";
import { Accordion, AccordionItem } from "../../../components/ui/Accordion";

export const metadata: Metadata = {
  title: "Vintage & Thrift Shopping Guide | OnPoint",
  description:
    "The complete guide to vintage and thrift fashion shopping — how to find hidden gems, check quality, size vintage pieces, and build a unique wardrobe sustainably.",
  openGraph: {
    title: "Vintage & Thrift Shopping Guide | OnPoint",
    description: "Find hidden gems, check quality, size vintage pieces — build a unique wardrobe sustainably.",
    images: [{ url: "/assets/3Product.png" }],
  },
};

export default function VintageThriftingGuide() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <article className="mx-auto max-w-3xl px-4 py-12">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to OnPoint
        </Link>

        {/* Header */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Style guide
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Vintage &amp; Thrift Shopping Guide
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Find hidden gems, spot quality, and navigate pre-loved fashion with confidence.
          </p>
        </header>

        {/* Quick Takeaways */}
        <Reveal>
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent p-5 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Quick Takeaways</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                "Hunt for denim jackets, band tees, leather goods & blazers",
                "Always check seams, zippers, fabric integrity & tags",
                "Vintage sizing runs small — ask for actual measurements",
                "Virtual try-on beats guessing from measurements alone",
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="text-muted-foreground">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Detailed sections — progressive disclosure via accordion */}
        <Reveal>
          <div className="rounded-2xl border border-border/40 bg-card p-5 md:p-6">
            <Accordion>
              <AccordionItem
                title="What to look for"
                subtitle="The categories worth hunting"
                icon={<Search className="w-4 h-4" />}
              >
                <div className="grid gap-3 sm:grid-cols-2 mt-2">
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
                    <div key={item} className="pl-5 border-l-2 border-primary/20">
                      <h4 className="text-sm font-bold">{item}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-5">{why}</p>
                    </div>
                  ))}
                </div>
              </AccordionItem>

              <AccordionItem
                title="Quality checks before you buy"
                subtitle="The checklist that separates gems from junk"
                icon={<Check className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Not all vintage is good vintage. When evaluating a piece, run through this
                  checklist:
                </p>
                <ul className="space-y-2">
                  {[
                    "Check seams: double-stitched seams outlast single-stitched. Inspect for pulling or loose threads",
                    "Examine zippers: metal zippers (YKK or Talon) are a sign of quality. Plastic zippers are harder to repair",
                    "Smell test: musty odour can be washed out; mildew or smoke is harder to remove",
                    "Fabric integrity: hold the fabric up to light — thinning or holes indicate wear",
                    "Tag research: brand labels, RN numbers, and union tags help date and authenticate pieces",
                    "Stains: check under arms, collar, and cuffs. Some stains set permanently",
                  ].map((check) => (
                    <li key={check} className="flex items-start gap-2 text-sm">
                      <Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Sizing vintage pieces"
                subtitle="Vintage runs small — always get real measurements"
                icon={<Tag className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Vintage sizing is different from modern sizing. A 1990s size M fits closer
                  to a modern size S. Pre-1970s sizing is even more variable — before standardised
                  sizing charts, every brand used its own measurements.
                </p>
                <ul className="space-y-2">
                  {[
                    "Always ask for actual measurements (pit-to-pit, length, shoulder width)",
                    "Vintage men&rsquo;s small often fits modern women&rsquo;s medium — consider cross-shopping",
                    "Waist measurements on vintage trousers run 1-2 inches smaller than modern equivalents",
                    "Vintage stretch fabrics have degraded elastic — account for less recovery",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pl-5 border-l-2 border-accent/30 text-sm">
                  <p className="font-semibold text-foreground">Virtual try-on helps here</p>
                  <p className="mt-1 text-muted-foreground">
                    With OnPoint, you can see how a vintage piece fits your body type before
                    buying. Upload a photo and try on the item virtually — no more guessing
                    from measurements alone.
                  </p>
                </div>
              </AccordionItem>

              <AccordionItem
                title="Eras worth knowing"
                subtitle="1940s to 1990s — what each decade delivers"
                icon={<Clock className="w-4 h-4" />}
              >
                <div className="space-y-3 mt-2">
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
                    <div key={era} className="pl-5 border-l-2 border-primary/20">
                      <h4 className="text-sm font-bold">{era}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-5">{body}</p>
                    </div>
                  ))}
                </div>
              </AccordionItem>
            </Accordion>
          </div>
        </Reveal>

        {/* Related guides */}
        <div className="border-t border-border pt-6 mt-8">
          <h3 className="text-sm font-bold mb-3">Related guides</h3>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <Link
              href="/guides/sustainable-fashion"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Sustainable &amp; Ethical Fashion Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Five R's, fabric choices, second-hand tips</p>
            </Link>
            <Link
              href="/guides/accessories-styling"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Accessories Styling Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Watches, bags, jewellery, and proportion</p>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-6 text-center">
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
