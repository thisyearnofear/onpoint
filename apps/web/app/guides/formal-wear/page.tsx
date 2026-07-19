import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Scissors, Camera, Ruler, Shirt, Zap } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";
import { Accordion, AccordionItem } from "../../../components/ui/Accordion";
import { OnPointHeader } from "../../../components/OnPointHeader";

export const metadata: Metadata = {
  title: "Formal Wear & Tailoring Guide | OnPoint",
  description:
    "The complete guide to formal wear and tailoring — choosing fabrics, getting measured, understanding bespoke vs. made-to-measure, and ordering custom suits, kaftans, and agbadas online.",
  openGraph: {
    title: "Formal Wear & Tailoring Guide | OnPoint",
    description: "Bespoke vs made-to-measure, fabric selection, measurements — order custom formal wear with confidence.",
    images: [{ url: "/assets/1Product.png" }],
  },
};

export default function FormalWearGuide() {
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

        {/* Header — punchy, not a wall of text */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Style guide
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Formal Wear &amp; Tailoring Guide
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Bespoke, made-to-measure, fabrics, and measurements — everything you need to order custom formal wear with confidence.
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
                "MTM ~$150-400 in 1-3 weeks, bespoke ~$500-2,000+ in 4-8 weeks",
                "Wool is the gold standard for suits — breathable and wrinkle-resistant",
                "Provide 8 key measurements for a suit that truly fits",
                "Try on the finished garment virtually before the tailor cuts fabric",
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
                title="Bespoke vs. made-to-measure"
                subtitle="Pattern-adjusted vs. cut from scratch — cost & timeline"
                icon={<Scissors className="w-4 h-4" />}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="pl-5 border-l-2 border-primary/20">
                    <h3 className="text-sm font-bold">Made-to-Measure (MTM)</h3>
                    <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                      <li>• Starts from a standard pattern, adjusted to your measurements</li>
                      <li>• 2-3 fittings typically needed</li>
                      <li>• Good for suits, blazers, and formal shirts</li>
                      <li>~$150-400 depending on fabric and tailor</li>
                      <li>• Faster turnaround: 1-3 weeks</li>
                    </ul>
                  </div>
                  <div className="pl-5 border-l-2 border-primary/20">
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
              </AccordionItem>

              <AccordionItem
                title="Choosing your fabric"
                subtitle="Wool, linen, cotton, silk, African prints"
                icon={<Shirt className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Fabric is the single most important decision in formal wear. It determines
                  how the garment drapes, breathes, and lasts. Here are the most common options:
                </p>
                <ul className="space-y-2">
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
              </AccordionItem>

              <AccordionItem
                title="Getting measured: the essentials"
                subtitle="8 measurements your tailor needs"
                icon={<Ruler className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Accurate measurements are the difference between a suit that fits and a suit
                  that looks like it belongs to you. When ordering from a curator, provide these:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
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
                    <div key={meas} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <p className="text-xs font-bold text-foreground">{meas}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </AccordionItem>

              <AccordionItem
                title="Traditional formal wear guide"
                subtitle="Agbada, kaftan, dashiki, kente stole"
                icon={<Sparkles className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  In East and West Africa, formal wear encompasses rich traditions beyond
                  the Western suit. Here&rsquo;s what to know:
                </p>
                <ul className="space-y-3">
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
                      className="pl-5 border-l-2 border-primary/20"
                    >
                      <p className="text-sm font-bold text-foreground">{type}</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-5">{detail}</p>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="The OnPoint advantage for formal wear"
                subtitle="Virtual try-on, WhatsApp briefs, order tracking"
                icon={<Camera className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Formal wear is high-consideration and high-value. Every hesitation matters.
                  OnPoint lets you:
                </p>
                <ul className="space-y-2">
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
              <p className="mt-0.5 text-xs text-muted-foreground">Dress codes decoded, colour coordination</p>
            </Link>
            <Link
              href="/guides/ankara-style"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Ankara &amp; African Print Style Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Fabrics, occasions, made-to-measure tips</p>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-6 text-center">
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
