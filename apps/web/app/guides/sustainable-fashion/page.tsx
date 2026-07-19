import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Leaf, Camera, Recycle, Shirt, Zap } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";
import { Accordion, AccordionItem } from "../../../components/ui/Accordion";
import { OnPointHeader } from "../../../components/OnPointHeader";

export const metadata: Metadata = {
  title: "Sustainable & Ethical Fashion Guide | OnPoint",
  description:
    "How to build a sustainable wardrobe — fabric choices, second-hand shopping, caring for clothes to extend their life, and supporting ethical brands.",
  openGraph: {
    title: "Sustainable & Ethical Fashion Guide | OnPoint",
    description: "Build a wardrobe that looks good and does good. Fabric choices, thrifting, and care tips.",
    images: [{ url: "/assets/1Product.png" }],
  },
};

export default function SustainableFashionGuide() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <OnPointHeader />
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
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Sustainable &amp; Ethical Fashion Guide</h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Buy better, care longer, and choose pieces with intention — fashion doesn&rsquo;t have to cost the planet.
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
                "Buy fewer, better pieces — a capsule wardrobe beats fast fashion",
                "Choose organic cotton, linen, hemp, and Tencel over synthetics",
                "Wash cold, line dry, and repair to extend garment life by years",
                "Second-hand is the single most impactful sustainable choice",
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
                title="The five R&rsquo;s of sustainable fashion"
                subtitle="Reduce, reuse, repair, recycle, rent"
                icon={<Recycle className="w-4 h-4" />}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { r: "Reduce", body: "Buy fewer, better pieces. A 10-item capsule wardrobe worn 30 times each has a lower footprint than 50 fast-fashion pieces worn once." },
                    { r: "Reuse", body: "Thrift, swap, and buy second-hand. Vintage and pre-owned fashion keeps clothing in use and out of landfills." },
                    { r: "Repair", body: "Learn basic mending — replacing a button, fixing a hem, or darning a hole can extend a garment&rsquo;s life by years." },
                    { r: "Recycle", body: "When a piece is truly done, recycle it through textile recycling programs. Never throw clothes in general waste." },
                    { r: "Rent", body: "For one-off occasions (weddings, events), consider renting instead of buying. It saves money and closet space." },
                  ].map(({ r, body }) => (
                    <div key={r} className="pl-5 border-l-2 border-primary/20">
                      <h3 className="text-sm font-bold text-emerald-600">{r}</h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-5">{body}</p>
                    </div>
                  ))}
                </div>
              </AccordionItem>

              <AccordionItem
                title="Fabrics to choose (and avoid)"
                subtitle="Natural vs synthetic — what to look for"
                icon={<Leaf className="w-4 h-4" />}
              >
                <div className="space-y-3">
                  <div className="pl-5 border-l-2 border-emerald-500/30">
                    <h3 className="text-sm font-bold text-emerald-600">Choose these</h3>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li>• Organic cotton — uses 91% less water than conventional cotton</li>
                      <li>• Linen — made from flax, requires minimal water and pesticides</li>
                      <li>• Hemp — grows quickly, enriches soil, durable fibres</li>
                      <li>• Tencel/Lyocell — closed-loop production, biodegradable</li>
                      <li>• Wool — natural, renewable, biodegradable (look for responsible sourcing)</li>
                    </ul>
                  </div>
                  <div className="pl-5 border-l-2 border-amber-500/30">
                    <h3 className="text-sm font-bold text-amber-600">Reduce use of</h3>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li>• Polyester — sheds microplastics in every wash, takes 200+ years to decompose</li>
                      <li>• Nylon — energy-intensive production, non-biodegradable</li>
                      <li>• Acrylic — petroleum-based, sheds microfibres, difficult to recycle</li>
                      <li>• Viscose/Rayon — often involves deforestation and chemical-intensive processing</li>
                    </ul>
                  </div>
                </div>
              </AccordionItem>

              <AccordionItem
                title="Make your clothes last longer"
                subtitle="Wash, dry, and store smarter"
                icon={<Shirt className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3 text-muted-foreground">
                  The most sustainable garment is the one already in your closet. Extend its life:
                </p>
                <ul className="space-y-2">
                  {[
                    "Wash less — most items don't need washing after every wear. Air out instead",
                    "Wash cold — 30°C uses 40% less energy than 40°C and is gentler on fabrics",
                    "Line dry — tumble drying causes significant wear and shrinkage. Air drying preserves elasticity and colour",
                    "Store properly — use padded hangers for structured items, fold knits to prevent stretching",
                    "Rotate regularly — give clothes 24-48 hours between wears to let fibres recover",
                    "Spot clean — treat stains immediately rather than washing the entire garment",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm">
                      <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Smart second-hand shopping"
                subtitle="Deadstock, vintage denim, leather, tailoring"
                icon={<Sparkles className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3 text-muted-foreground">
                  Buying second-hand is the single most impactful thing you can do for sustainable fashion.
                  On OnPoint, vintage and thrift curators list pre-loved pieces with virtual try-on,
                  so you can see the fit before you buy. Look for:
                </p>
                <ul className="space-y-2">
                  {[
                    "Deadstock items — never worn, original tags, previous season. Best value in second-hand",
                    "Vintage denim — modern construction can't match the quality of 70s-90s denim",
                    "Leather goods — quality leather from past decades often outperforms new production",
                    "Tailored pieces — vintage blazers and trousers offer craftsmanship rarely found at modern prices",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>
            </Accordion>
          </div>
        </Reveal>

        {/* Related guides + CTA */}
        <div className="border-t border-border pt-6 mt-8">
          <h3 className="text-sm font-bold mb-3">Related guides</h3>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <Link
              href="/guides/vintage-thrifting"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Vintage &amp; Thrift Shopping Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Hidden gems, quality checks, era sizing</p>
            </Link>
            <Link
              href="/guides/accessories-styling"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Accessories Styling Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Quality over quantity, timeless pieces</p>
            </Link>
          </div>
        </div>

        <div className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">Ready to build a sustainable wardrobe?</p>
          <Link href="/lab" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90">
            <Camera className="h-4 w-4" />
            Try on sustainable styles now
          </Link>
        </div>
      </article>
    </main>
  );
}
