import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Star, Camera } from "lucide-react";

export const metadata: Metadata = {
  title: "Accessories Styling Guide | BeOnPoint",
  description:
    "How to style watches, bags, jewelry, belts, and hats — proportion rules, metal mixing, occasion matching, and building an accessories wardrobe.",
  openGraph: {
    title: "Accessories Styling Guide | BeOnPoint",
    description: "Master the art of accessories. Watches, bags, jewelry, belts — proportion, mixing, and occasion matching.",
    images: [{ url: "/assets/3Product.png" }],
  },
};

export default function AccessoriesStylingGuide() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <article className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to BeOnPoint
        </Link>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Style guide
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Accessories Styling Guide</h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Accessories are the difference between a good outfit and a great one. The right
            watch, bag, or pair of earrings can transform a simple look into a signature style.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">The rule of three</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            A well-accessorised outfit follows the rule of three — no more than three visible
            accessories at a time. This keeps the look intentional without overwhelming it.
            For example: watch + ring + bag, or earrings + necklace + belt. When in doubt,
            remove one and see if the outfit still works.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Metal mixing: the new rules</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            The old rule that all jewellery must match in metal tone is outdated. Mixing metals
            creates visual interest. Key principles:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Silver and gold work together when there's intentional contrast. A gold watch with a silver ring is a look",
              "Use one dominant metal (60%) and one accent metal (40%) for balance",
              "Mixed metals look best when there's a connecting element — a strap, a stone, or a fabric that bridges the tones",
              "Warm skin tones lean toward gold; cool skin tones lean toward silver. But personal preference trumps rules",
              "Rose gold pairs well with both yellow gold (warm) and silver (contrast)",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Star className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Building your accessories wardrobe</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                category: "Watches",
                essentials: "A daily beater (metal or sports), a dress watch (leather strap), and a smartwatch for fitness days. One watch per context is enough.",
              },
              {
                category: "Bags",
                essentials: "A crossbody for daily use, a tote for work or travel, and a clutch or mini bag for evenings. Neutral colours (black, brown, cream) maximise versatility.",
              },
              {
                category: "Jewellery",
                essentials: "Everyday studs or small hoops, a signature ring or bracelet, and one statement piece for special occasions. Layer necklaces at varying lengths.",
              },
              {
                category: "Belts & Hats",
                essentials: "A 1-inch belt in black and brown covers most outfits. A structured cap, a beanie (winter), and a Panama or wide-brim (summer) round it out.",
              },
            ].map(({ category, essentials }) => (
              <div key={category} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold text-foreground">{category}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-5">{essentials}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Occasion matching</h2>
          <ul className="mt-4 space-y-3">
            {[
              { occasion: "Professional / Office", tip: "Keep it minimal. A classic watch, small studs, and a structured bag. Avoid noisy bracelets or dangling earrings." },
              { occasion: "Evening / Dinner", tip: "One statement piece (chandelier earrings, a cocktail ring, or a metallic clutch). Let the statement accessory lead." },
              { occasion: "Casual / Weekend", tip: "Layer beaded bracelets, wear a fabric watch strap, use a canvas tote. This is where you experiment." },
              { occasion: "Formal / Ceremony", tip: "Match metals to your outfit hardware. Pearl or diamond studs are always appropriate. A clutch or small structured bag." },
            ].map(({ occasion, tip }) => (
              <li key={occasion} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-bold text-foreground">{occasion}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-5">{tip}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Proportion matters</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Accessories should complement your body proportions, not overwhelm them. Petite frames
            suit smaller bags and delicate jewellery. Taller frames can carry oversized totes and
            bolder pieces. Your watch face should be proportional to your wrist — a general rule
            is the lugs should not overhang your wrist.
          </p>
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-foreground">Virtual try-on for accessories</p>
            <p className="mt-1 text-muted-foreground">
              Use BeOnPoint&rsquo;s virtual try-on to see how watches, bags, and jewellery look on your
              body type before you buy. Upload a photo and see the proportions for yourself.
            </p>
          </div>
        </section>

        {/* Related guides */}
        <div className="border-t border-border pt-8">
          <h3 className="text-sm font-bold mb-3">Related guides</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/guides/occasion-wear"
              className="block rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <p className="text-sm font-bold">Occasion Wear &amp; Event Dressing Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Dress codes, colour, and event styling</p>
            </Link>
            <Link
              href="/guides/streetwear-fits"
              className="block rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <p className="text-sm font-bold">Streetwear Style Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Layering, sneaker rotations, drops</p>
            </Link>
          </div>
        </div>

        <div className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">Ready to accessorise with confidence?</p>
          <Link href="/lab" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90">
            <Camera className="h-4 w-4" />
            Try on accessories now
          </Link>
        </div>
      </article>
    </main>
  );
}
