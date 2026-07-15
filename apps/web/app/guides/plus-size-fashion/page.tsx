import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Heart, Camera, Ruler, Zap } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";
import { Accordion, AccordionItem } from "../../../components/ui/Accordion";

export const metadata: Metadata = {
  title: "Plus-Size Fashion & Fit Guide | OnPoint",
  description:
    "Your guide to plus-size fashion — finding the right fit, flattering silhouettes, trusted brands, and how to dress with confidence at every size.",
  openGraph: {
    title: "Plus-Size Fashion & Fit Guide | OnPoint",
    description: "Dress with confidence at any size. Fit tips, silhouettes, trusted brands, and virtual try-on for plus-size fashion.",
    images: [{ url: "/assets/1Product.png" }],
  },
};

export default function PlusSizeFashionGuide() {
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

        {/* Header — punchy, not a wall of text */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Style guide
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Plus-Size Fashion &amp; Fit Guide</h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Fit, silhouettes, fabrics, and virtual try-on — everything you need to dress with confidence at any size.
          </p>
        </header>

        {/* TL;DR — quick takeaways, no reading required */}
        <Reveal>
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent p-5 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Quick Takeaways</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                "Clothes should skim your body — not pull, gap, or bag",
                "Fit & flare and wrap silhouettes flatter every body type",
                "Stretch fabrics with good recovery hold shape without sagging",
                "Virtual try-on removes the guesswork from online sizing",
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
                title="Fit is everything"
                subtitle="Shoulder seams, darts, and the sweet spot"
                icon={<Ruler className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  The most important rule in plus-size fashion is simple: clothes should fit your
                  body, not the other way around. Too-tight clothing is uncomfortable and unflattering.
                  Too-loose clothing can look shapeless. The sweet spot is garments that skim your
                  body without pulling, gaping, or bagging.
                </p>
                <ul className="space-y-2">
                  {[
                    "Shoulder seams should sit at your natural shoulder line — not creeping up or hanging off",
                    "Trousers should fasten comfortably without a visible pull at the zip or buttons",
                    "Sleeves should allow full range of motion without tightness at the bicep or armhole",
                    "Darts and princess seams are your friends — they create shape without relying on belts",
                    "If a garment gaps at the bust or waist, it&rsquo;s the wrong cut, not the wrong size",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Silhouettes that work"
                subtitle="Fit & flare, wraps, straight leg, V-necks"
                icon={<Sparkles className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Certain silhouettes are universally flattering for plus-size bodies. These are
                  starting points, not rules — personal style always comes first.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { style: "Fit & Flare", why: "Cinches at the waist and flows over hips. Works for dresses, coats, and skirts. Creates an hourglass shape regardless of your natural proportions." },
                    { style: "Wrap silhouettes", why: "Wrap dresses and tops are adjustable and create a diagonal line that elongates the torso. Universally flattering across all body types." },
                    { style: "Straight leg", why: "Straight-leg trousers and jeans balance wider hips and create a clean vertical line. Avoid skinny fits if you prefer comfort." },
                    { style: "V-necklines", why: "V-necks elongate the neck and upper body. Crew necks can make a larger bust feel restricted — V-necks are more forgiving." },
                  ].map(({ style, why }) => (
                    <div key={style} className="pl-5 border-l-2 border-primary/20">
                      <h3 className="text-sm font-bold">{style}</h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-5">{why}</p>
                    </div>
                  ))}
                </div>
              </AccordionItem>

              <AccordionItem
                title="Fabric & pattern tips"
                subtitle="Stretch, drape, stripes, and matte finishes"
                icon={<Heart className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">Fabric choice matters as much as fit:</p>
                <ul className="space-y-2">
                  {[
                    "Stretch fabrics with good recovery (cotton-elastane blends) hold shape without sagging",
                    "Medium-weight fabrics drape better than stiff or ultra-thin materials",
                    "Vertical stripes and small-scale prints are easier to wear than large, bold patterns",
                    "Dark colours are slimming, but don't shy away from colour — a well-fitted bright piece is more flattering than a baggy dark one",
                    "Matte finishes are more forgiving than shiny fabrics, which highlight every contour",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Heart className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Virtual try-on changes everything"
                subtitle="See it on your body before you commit"
                icon={<Camera className="w-4 h-4" />}
              >
                <p className="text-sm leading-7">
                  One of the biggest frustrations in plus-size shopping is ordering online and hoping
                  for the best. OnPoint&rsquo;s virtual try-on lets you upload a photo and see how any
                  item fits your body type before you commit. This is especially valuable for plus-size
                  shoppers because sizing varies so much between brands. See it, try it, then buy
                  with confidence — no more guessing from size charts.
                </p>
              </AccordionItem>
            </Accordion>
          </div>
        </Reveal>

        {/* Related guides + CTA — compact */}
        <div className="border-t border-border pt-6 mt-8">
          <h3 className="text-sm font-bold mb-3">Related guides</h3>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <Link
              href="/guides/occasion-wear"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Occasion Wear &amp; Event Dressing Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Weddings, galas, and formal events</p>
            </Link>
            <Link
              href="/guides/sustainable-fashion"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Sustainable &amp; Ethical Fashion Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Quality fabrics, timeless pieces, smart shopping</p>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">Ready to see how it fits?</p>
          <Link href="/lab" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90">
            <Camera className="h-4 w-4" />
            Try on plus-size styles now
          </Link>
        </div>
      </article>
    </main>
  );
}
