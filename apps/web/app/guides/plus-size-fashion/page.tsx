import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Heart, Camera } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";

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
        <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to OnPoint
        </Link>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Style guide
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Plus-Size Fashion &amp; Fit Guide</h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Great style has no size limit. The key is understanding what works for your
            body — not fighting it. This guide covers fit, silhouettes, and how to
            build a wardrobe that makes you feel incredible.
          </p>
        </header>

        <Reveal>
          <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Fit is everything</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            The most important rule in plus-size fashion is simple: clothes should fit your
            body, not the other way around. Too-tight clothing is uncomfortable and unflattering.
            Too-loose clothing can look shapeless. The sweet spot is garments that skim your
            body without pulling, gaping, or bagging.
          </p>
          <ul className="mt-4 space-y-2">
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
          </section>
        </Reveal>

        <Reveal>
          <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Silhouettes that work</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Certain silhouettes are universally flattering for plus-size bodies. These are
            starting points, not rules — personal style always comes first.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          </section>
        </Reveal>

        <Reveal>
          <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Fabric &amp; pattern tips</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">Fabric choice matters as much as fit:</p>
          <ul className="mt-4 space-y-2">
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
          </section>
        </Reveal>

        <Reveal>
          <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Virtual try-on changes everything</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            One of the biggest frustrations in plus-size shopping is ordering online and hoping
            for the best. OnPoint&rsquo;s virtual try-on lets you upload a photo and see how any
            item fits your body type before you commit. This is especially valuable for plus-size
            shoppers because sizing varies so much between brands. See it, try it, then buy
            with confidence — no more guessing from size charts.
          </p>
          </section>
        </Reveal>

        {/* Related guides */}
        <div className="border-t border-border pt-8">
          <h3 className="text-sm font-bold mb-3">Related guides</h3>
          <div className="grid gap-3 sm:grid-cols-2">
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
