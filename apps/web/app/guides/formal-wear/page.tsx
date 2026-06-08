import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Scissors, Camera } from "lucide-react";

export const metadata: Metadata = {
  title: "Formal Wear & Tailoring Guide | BeOnPoint",
  description:
    "The complete guide to formal wear and tailoring — choosing fabrics, getting measured, understanding bespoke vs. made-to-measure, and ordering custom suits, kaftans, and agbadas online.",
  openGraph: {
    title: "Formal Wear & Tailoring Guide | BeOnPoint",
    description: "Bespoke vs made-to-measure, fabric selection, measurements — order custom formal wear with confidence.",
    images: [{ url: "/assets/1Product.png" }],
  },
};

export default function FormalWearGuide() {
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
            Formal Wear &amp; Tailoring Guide
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            From bespoke suits and wedding agbadas to custom kaftans and graduation
            gowns — formal wear is an investment in how the world sees you. This
            guide covers everything you need to know to order custom formal wear
            with confidence.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Bespoke vs. made-to-measure</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold">Made-to-Measure (MTM)</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>• Starts from a standard pattern, adjusted to your measurements</li>
                <li>• 2-3 fittings typically needed</li>
                <li>• Good for suits, blazers, and formal shirts</li>
                <li>~$150-400 depending on fabric and tailor</li>
                <li>• Faster turnaround: 1-3 weeks</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold">Bespoke</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>• Pattern created from scratch for your body</li>
                <li>• 3-5 fittings, every detail customisable</li>
                <li>• Ideal for wedding wear, agbadas, and special occasions</li>
                <li>~$500-2,000+ depending on complexity</li>
                <li>• Standard turnaround: 4-8 weeks</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Choosing your fabric</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Fabric is the single most important decision in formal wear. It determines
            how the garment drapes, breathes, and lasts. Here are the most common options:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Wool — the gold standard for suits. Breathable, wrinkle-resistant, and drapes beautifully. Tropical wool is lighter for warmer climates",
              "Linen — ideal for tropical and coastal regions. Lightweight and breathable but wrinkles easily. Perfect for casual formal wear",
              "Cotton — versatile for shirts and less formal jackets. Egyptian and Supima cotton offer the best quality",
              "Silk — used for linings, ties, and occasion wear like kaftans and gowns. Requires professional cleaning",
              "African prints (Ankara, Kente) — increasingly popular for formal blazers, stoles, and agbada trimmings",
            ].map((fabric) => (
              <li key={fabric} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{fabric}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Getting measured: the essentials</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Accurate measurements are the difference between a suit that fits and a suit
            that looks like it belongs to you. When ordering from a curator, provide these:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { meas: "Shoulder width", desc: "From shoulder bone to shoulder bone across the back" },
              { meas: "Chest circumference", desc: "Around the fullest part of the chest, tape parallel to floor" },
              { meas: "Waist", desc: "At natural waist level (narrowest point), one finger of breathing room" },
              { meas: "Hip/seat", desc: "Around the fullest part of the hips, 20cm below waist" },
              { meas: "Sleeve length", desc: "From shoulder point to wrist bone, arm slightly bent" },
              { meas: "Inseam", desc: "From crotch to ankle bone, standing straight" },
              { meas: "Back length", desc: "From base of neck to desired hem length" },
              { meas: "Neck circumference", desc: "Around the base of the neck, two fingers of room" },
            ].map(({ meas, desc }) => (
              <div key={meas} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-bold text-foreground">{meas}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Traditional formal wear guide</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            In East and West Africa, formal wear encompasses rich traditions beyond
            the Western suit. Here&rsquo;s what to know:
          </p>
          <ul className="mt-4 space-y-3">
            {[
              {
                type: "Agbada (West Africa)",
                detail: "A flowing, wide-sleeved robe worn over a dashiki and trousers. Typically made from richly embroidered fabric. Requires careful measurement of the over-robe length and shoulder width.",
              },
              {
                type: "Kaftan (East & West Africa)",
                detail: "A loose-fitting robe worn for ceremonies and Friday prayers. Can be tailored or off-the-rack. Fabric choice (cotton, silk, brocade) defines the formality level.",
              },
              {
                type: "Dashiki",
                detail: "A colourful pullover shirt with embroidery at the neckline. Worn with trousers for semi-formal occasions. Increasingly popular for smart-casual events.",
              },
              {
                type: "Kente stole",
                detail: "A hand-woven Ghanaian textile strip worn over formal wear for graduations, weddings, and religious ceremonies. Usually rented or purchased separately from the main garment.",
              },
            ].map(({ type, detail }) => (
              <li
                key={type}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="text-sm font-bold text-foreground">{type}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-5">{detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">The BeOnPoint advantage for formal wear</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Formal wear is high-consideration and high-value. Every hesitation matters.
            BeOnPoint lets you:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "See a virtual try-on of the finished garment before the tailor cuts fabric",
              "Share polaroid previews with family or wedding party for group decisions",
              "Send a structured brief via WhatsApp — your measurements, style preferences, and fabric choice in one message",
              "Track your order from cut to delivery with real-time updates",
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Ready to see how that bespoke suit looks on you?
          </p>
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            <Camera className="h-4 w-4" />
            Try on formal wear now
          </Link>
        </div>
      </article>
    </main>
  );
}
