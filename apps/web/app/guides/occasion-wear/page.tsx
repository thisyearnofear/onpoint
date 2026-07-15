import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, Calendar, Camera, Palette, Thermometer, Clock, Zap } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";
import { Accordion, AccordionItem } from "../../../components/ui/Accordion";

export const metadata: Metadata = {
  title: "Occasion Wear & Event Dressing Guide | OnPoint",
  description:
    "What to wear to weddings, graduations, galas, and formal events — dress codes decoded, fabric advice, colour coordination, and how to stand out for the right reasons.",
  openGraph: {
    title: "Occasion Wear & Event Dressing Guide | OnPoint",
    description: "Decode dress codes for weddings, graduations, and formal events. Fabric, colour, and styling tips.",
    images: [{ url: "/assets/3Product.png" }],
  },
};

export default function OccasionWearGuide() {
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
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Occasion Wear &amp; Event Dressing Guide</h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            From weddings to galas — here&rsquo;s how to decode the dress code and show up dressed right.
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
                "Know the dress code — white tie to smart casual, each has rules",
                "Avoid white/ivory at weddings; bold colours and prints are welcome",
                "Choose linen and light cotton for warm climates, velvet for evening",
                "Plan 6-8 weeks ahead for made-to-measure or bespoke pieces",
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
                title="Dress codes decoded"
                subtitle="White tie to smart casual — what each means"
                icon={<Calendar className="w-4 h-4" />}
              >
                <div className="space-y-3">
                  {[
                    { code: "White Tie", what: "The most formal dress code. Floor-length gown for women, tailcoat with white bow tie for men. Reserved for state dinners, royal events, and high-profile galas." },
                    { code: "Black Tie", what: "Evening gown or formal cocktail dress for women. Tuxedo with black bow tie for men. Acceptable for weddings, awards ceremonies, and charity galas." },
                    { code: "Black Tie Optional", what: "Formal but flexible. Women can wear a gown or a dressy separates set. Men can wear a tuxedo or a dark suit with a conservative tie." },
                    { code: "Semi-Formal / Cocktail", what: "Knee-length or midi dress for women. Dark suit and tie for men. The most common dress code for evening weddings and corporate events." },
                    { code: "Smart Casual", what: "Dressy separates — a blouse with tailored trousers, a knit dress, or a blazer with jeans. No ties required. Common for daytime events and less formal celebrations." },
                    { code: "Traditional / Cultural", what: "Many African and diaspora events specify traditional attire — Agbada, Kente, Ankara, Dashiki, or Kaftan. Always check the invitation for cultural dress guidance." },
                  ].map(({ code, what }) => (
                    <div key={code} className="pl-5 border-l-2 border-primary/20">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="text-sm font-bold">{code}</h3>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-5">{what}</p>
                    </div>
                  ))}
                </div>
              </AccordionItem>

              <AccordionItem
                title="Colour coordination for events"
                subtitle="Weddings, graduations, cultural, and corporate"
                icon={<Palette className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3 text-muted-foreground">
                  Colour matters at events — both for personal style and etiquette:
                </p>
                <ul className="space-y-2">
                  {[
                    "Weddings: avoid white, ivory, or cream (reserved for the bride). Bold colours, pastels, and prints are welcome. Black is acceptable for evening weddings",
                    "Graduations: wear your institution&rsquo;s colours or neutral tones. Avoid anything that clashes with academic gown colours",
                    "Cultural celebrations: bright colours are encouraged — Ankara, Kente, and Kitenge for African events. Gold and jewel tones for Diwali or South Asian celebrations",
                    "Corporate events: navy, charcoal, and burgundy are safe. One accent colour (tie, scarf, pocket square) adds personality without overpowering",
                    "Seasonal colour cues: pastels and light linens for daytime/summer events. Rich jewel tones, velvet, and darker fabrics for evening/winter",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Fabric &amp; climate considerations"
                subtitle="Linen for heat, velvet for evening, layering"
                icon={<Thermometer className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 text-muted-foreground">
                  In tropical and warm climates (common for many African and diaspora events),
                  fabric choice is as important as style. Linen, light cotton, and silk blends
                  keep you comfortable through long ceremonies. For evening events when temperatures
                  drop, layering with a light stole, blazer, or kente wrap adds both warmth and style.
                  Avoid heavy synthetic fabrics that trap heat — your comfort affects your confidence.
                </p>
              </AccordionItem>

              <AccordionItem
                title="Planning ahead: the timeline"
                subtitle="6-8 weeks out to the night before"
                icon={<Clock className="w-4 h-4" />}
              >
                <ul className="space-y-2">
                  {[
                    "6-8 weeks before: order made-to-measure or bespoke pieces (agbada, suit, Kente gown)",
                    "4 weeks before: schedule first fitting. Confirm shoe and accessory choices",
                    "2 weeks before: final fitting. Break in new shoes by wearing them around the house",
                    "1 week before: confirm outfit is clean, pressed, and complete. Pack backup accessories",
                    "Day before: try on the full outfit with intended undergarments and shoes. Take a photo to verify",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
              href="/guides/formal-wear"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Formal Wear &amp; Tailoring Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Bespoke vs MTM, fabric, traditional fits</p>
            </Link>
            <Link
              href="/guides/ankara-style"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Ankara &amp; African Print Style Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Fabrics, ceremonies, and cultural dress</p>
            </Link>
          </div>
        </div>

        <div className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">Ready to find your event look?</p>
          <Link href="/lab" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90">
            <Camera className="h-4 w-4" />
            Try on occasion wear now
          </Link>
        </div>
      </article>
    </main>
  );
}
