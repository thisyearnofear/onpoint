import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Leaf, Camera } from "lucide-react";

export const metadata: Metadata = {
  title: "Sustainable & Ethical Fashion Guide | BeOnPoint",
  description:
    "How to build a sustainable wardrobe — fabric choices, second-hand shopping, caring for clothes to extend their life, and supporting ethical brands.",
  openGraph: {
    title: "Sustainable & Ethical Fashion Guide | BeOnPoint",
    description: "Build a wardrobe that looks good and does good. Fabric choices, thrifting, and care tips.",
    images: [{ url: "/assets/1Product.png" }],
  },
};

export default function SustainableFashionGuide() {
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
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Sustainable &amp; Ethical Fashion Guide</h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Fashion doesn&rsquo;t have to cost the planet. Building a sustainable wardrobe
            means buying better, caring longer, and choosing pieces with intention.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">The five R&rsquo;s of sustainable fashion</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { r: "Reduce", body: "Buy fewer, better pieces. A 10-item capsule wardrobe worn 30 times each has a lower footprint than 50 fast-fashion pieces worn once." },
              { r: "Reuse", body: "Thrift, swap, and buy second-hand. Vintage and pre-owned fashion keeps clothing in use and out of landfills." },
              { r: "Repair", body: "Learn basic mending — replacing a button, fixing a hem, or darning a hole can extend a garment&rsquo;s life by years." },
              { r: "Recycle", body: "When a piece is truly done, recycle it through textile recycling programs. Never throw clothes in general waste." },
              { r: "Rent", body: "For one-off occasions (weddings, events), consider renting instead of buying. It saves money and closet space." },
            ].map(({ r, body }) => (
              <div key={r} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold text-emerald-600">{r}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-5">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Fabrics to choose (and avoid)</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <h3 className="text-sm font-bold text-emerald-600">Choose these</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>• Organic cotton — uses 91% less water than conventional cotton</li>
                <li>• Linen — made from flax, requires minimal water and pesticides</li>
                <li>• Hemp — grows quickly, enriches soil, durable fibres</li>
                <li>• Tencel/Lyocell — closed-loop production, biodegradable</li>
                <li>• Wool — natural, renewable, biodegradable (look for responsible sourcing)</li>
              </ul>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h3 className="text-sm font-bold text-amber-600">Reduce use of</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>• Polyester — sheds microplastics in every wash, takes 200+ years to decompose</li>
                <li>• Nylon — energy-intensive production, non-biodegradable</li>
                <li>• Acrylic — petroleum-based, sheds microfibres, difficult to recycle</li>
                <li>• Viscose/Rayon — often involves deforestation and chemical-intensive processing</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Make your clothes last longer</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">The most sustainable garment is the one already in your closet. Extend its life:</p>
          <ul className="mt-4 space-y-2">
            {[
              "Wash less — most items don't need washing after every wear. Air out instead",
              "Wash cold — 30°C uses 40% less energy than 40°C and is gentler on fabrics",
              "Line dry — tumble drying causes significant wear and shrinkage. Air drying preserves elasticity and colour",
              "Store properly — use padded hangers for structured items, fold knits to prevent stretching",
              "Rotate regularly — give clothes 24-48 hours between wears to let fibres recover",
              "Spot clean — treat stains immediately rather than washing the entire garment",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Smart second-hand shopping</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Buying second-hand is the single most impactful thing you can do for sustainable fashion.
            On BeOnPoint, vintage and thrift curators list pre-loved pieces with virtual try-on,
            so you can see the fit before you buy. Look for:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Deadstock items — never worn, original tags, previous season. Best value in second-hand",
              "Vintage denim — modern construction can't match the quality of 70s-90s denim",
              "Leather goods — quality leather from past decades often outperforms new production",
              "Tailored pieces — vintage blazers and trousers offer craftsmanship rarely found at modern prices",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="border-t border-border pt-8 text-center">
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
