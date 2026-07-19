import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Camera, Scissors, Calendar, Ruler, Zap } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";
import { Accordion, AccordionItem } from "../../../components/ui/Accordion";
import { OnPointLayout } from "../../../components/OnPointLayout";

export const metadata: Metadata = {
  title: "Ankara & African Print Style Guide | OnPoint",
  description:
    "Your complete guide to Ankara, Kente, Kitenge, and African print fashion — occasion wear, fabric selection, styling tips, and how to order custom pieces online.",
  openGraph: {
    title: "Ankara & African Print Style Guide | OnPoint",
    description: "Ankara, Kente, Kitenge — fabrics, occasions, styling tips for African print fashion.",
    images: [{ url: "/assets/3Product.png" }],
  },
};

export default function AnkaraStyleGuide() {
  return (
    <OnPointLayout footer={false}>
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
            Ankara &amp; African Print Style Guide
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Bold prints, rich colours, and cultural heritage — choose the right fabric, fit, and style for any occasion.
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
                "Ankara = versatile wax print for structured pieces",
                "Match print boldness to the occasion (weddings vs. casual)",
                "Most pieces are made-to-measure — have your measurements ready",
                "Virtual try-on shows how a print drapes before fabric is cut",
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
                title="Choosing your fabric"
                subtitle="Ankara, Kente, Kitenge — what sets them apart"
                icon={<Sparkles className="w-4 h-4" />}
              >
                <div className="grid gap-3 sm:grid-cols-3 mt-2">
                  {[
                    {
                      name: "Ankara (Wax Print)",
                      body: "Machine-printed cotton with vibrant patterns. Versatile for dresses, shirts, skirts, and blazers. Holds shape well — ideal for structured pieces.",
                    },
                    {
                      name: "Kente",
                      body: "Hand-woven Ghanaian textile with symbolic patterns. Traditionally worn for ceremonies. Best for statement pieces like stoles, gowns, and trim accents.",
                    },
                    {
                      name: "Kitenge",
                      body: "East African printed cotton. Softer drape than Ankara, popular for matching sets (top + wrap skirt). Common in Kenya, Uganda, and Tanzania.",
                    },
                  ].map((fabric) => (
                    <div
                      key={fabric.name}
                      className="pl-5 border-l-2 border-primary/20"
                    >
                      <h4 className="text-sm font-bold">{fabric.name}</h4>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {fabric.body}
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionItem>

              <AccordionItem
                title="Matching print to occasion"
                subtitle="Weddings, graduations, church, office, everyday"
                icon={<Calendar className="w-4 h-4" />}
              >
                <ul className="space-y-3 mt-2">
                  {[
                    {
                      occasion: "Weddings (guest or bridal party)",
                      tip: "Go for bold Ankara in coordinated family colours. Kente stoles over neutral outfits are a classic choice for wedding guests.",
                    },
                    {
                      occasion: "Graduation ceremonies",
                      tip: "Kitenge matching sets (blazer + skirt or shirt + trousers) photograph beautifully. Lightweight fabrics work best for all-day wear.",
                    },
                    {
                      occasion: "Church & Sunday best",
                      tip: "Ankara dresses with structured shoulders and midi lengths. Pair with neutral accessories to let the print shine.",
                    },
                    {
                      occasion: "Casual & everyday",
                      tip: "Ankara tops with jeans or Kitenge wrap skirts with plain T-shirts. Start with one printed piece per outfit.",
                    },
                    {
                      occasion: "Corporate & office wear",
                      tip: "Tailored Ankara blazers or pencil skirts in subdued prints. Pair with solid-colour blouses or shirts.",
                    },
                  ].map((item) => (
                    <li
                      key={item.occasion}
                      className="pl-5 border-l-2 border-primary/20"
                    >
                      <p className="text-sm font-bold text-foreground">{item.occasion}</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-5">
                        {item.tip}
                      </p>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Made-to-measure: what to provide"
                subtitle="Measurements your curator needs"
                icon={<Ruler className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Most African print pieces are made-to-order — which means your measurements
                  matter. When ordering from a curator, be ready with:
                </p>
                <ul className="space-y-2">
                  {[
                    "Neck to shoulder length (for tops, blazers, dresses)",
                    "Chest/bust circumference at the fullest point",
                    "Waist and hip measurements (for skirts, trousers, dresses)",
                    "Arm length from shoulder point to wrist",
                    "Desired hem length (knee, midi, floor-length)",
                    "Any style reference photos (Pinterest, Instagram)",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Try before you tailor"
                subtitle="Virtual try-on for bold prints"
                icon={<Scissors className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  One of the biggest challenges with custom African print fashion is visualising
                  how a bold pattern will drape on your body. On OnPoint, you can upload a
                  photo and see a virtual try-on of the garment before the curator cuts fabric.
                  This replaces the usual back-and-forth of WhatsApp messages and ensures
                  you love the look before committing.
                </p>
                <div className="pl-5 border-l-2 border-accent/30 text-sm">
                  <p className="font-semibold text-foreground">Why it matters</p>
                  <p className="mt-1 text-muted-foreground">
                    Ankara prints look different on a roll vs. on a body. The same print can
                    read bold and confident on one body type and overwhelming on another.
                    Virtual try-on helps you find your print — not just your size.
                  </p>
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
              href="/guides/formal-wear"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Formal Wear &amp; Tailoring Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Agbadas, kaftans, and bespoke tailoring</p>
            </Link>
            <Link
              href="/guides/occasion-wear"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Occasion Wear &amp; Event Dressing Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Weddings, graduations, and cultural events</p>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Ready to see how that Ankara blazer looks on you?
          </p>
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            <Camera className="h-4 w-4" />
            Try on African print now
          </Link>
        </div>
      </article>
    </OnPointLayout>
  );
}
