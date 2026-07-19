import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Shirt, Ruler, Printer, Smartphone, Sparkles, Zap } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";
import { Accordion, AccordionItem } from "../../../components/ui/Accordion";
import { OnPointLayout } from "../../../components/OnPointLayout";

export const metadata: Metadata = {
  title: "Football Kit Buying Guide | OnPoint",
  description:
    "The complete guide to buying football kits online — sizing, printing names & numbers, authentic vs. replica, and how to get the perfect fit for match day.",
  openGraph: {
    title: "Football Kit Buying Guide | OnPoint",
    description: "Sizing, printing, authentic vs. replica — everything you need to buy the perfect football kit.",
    images: [{ url: "/assets/2Product.png" }],
  },
};

export default function FootballKitsGuide() {
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

        {/* Header — punchy, not a wall of text */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Shirt className="h-3.5 w-3.5" />
            Style guide
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Football Kit Buying Guide
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Sizing, printing, authentic vs. replica — everything you need before you buy.
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
                "Nike runs slim → size up for relaxed fit",
                "Adidas = standard fit → your usual size",
                "Replica ~$70-90, Authentic ~$120-150",
                "Try on with AI before you order",
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
                title="Sizing: getting it right"
                subtitle="Nike, Adidas, Puma — how they differ"
                icon={<Ruler className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Football kit sizing varies significantly between brands. A Nike size M fits
                  differently from an Adidas size M, and Puma runs its own sizing entirely.
                </p>
                <ul className="space-y-2">
                  {[
                    "Nike kits run slim — size up if you prefer a relaxed fit or plan to layer",
                    "Adidas offers a standard fit; go with your usual size",
                    "Puma tends to run slightly larger, especially in the chest",
                    "Retro/reissue kits often use older sizing charts — check the specific season's measurements",
                    "Player-version kits (Vapor, Authentic) are tighter and lighter than fan versions",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Printing names & numbers"
                subtitle="Fonts, patches, placement"
                icon={<Printer className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Most curators offer printing with your preferred name and number. Premier
                  League kits use official font sets — your curator can match the exact
                  typeface for the current season.
                </p>
                <ul className="space-y-2">
                  {[
                    "Font style: home vs. away kits sometimes use different fonts",
                    "Position size: sleeve numbers (UCL) vs. back numbers (league)",
                    "Cup competitions: check if the kit needs specific patches (FA Cup, UCL)",
                    "Name length: most leagues allow up to 15 characters",
                    "Print placement: standard is 7-8 inches tall on the back",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm">
                      <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Authentic vs. replica"
                subtitle="$70-90 vs $120-150 — which to pick"
              >
                <div className="grid gap-3 sm:grid-cols-2 mt-2">
                  <div className="pl-5 border-l-2 border-primary/20">
                    <h4 className="text-sm font-bold">Replica (Stadium)</h4>
                    <ul className="mt-2 space-y-1.5 text-xs">
                      <li>• Standard fit, more comfortable</li>
                      <li>• Heat-sealed badge and sponsor</li>
                      <li>~$70-90 — best value</li>
                      <li>• Easier to print on</li>
                    </ul>
                  </div>
                  <div className="pl-5 border-l-2 border-primary/20">
                    <h4 className="text-sm font-bold">Authentic (Vapor/Player)</h4>
                    <ul className="mt-2 space-y-1.5 text-xs">
                      <li>• Tight, performance fit — size up</li>
                      <li>• Woven badge, heat-transfer sponsor</li>
                      <li>~$120-150 — what players wear</li>
                      <li>• Lighter, more breathable</li>
                    </ul>
                  </div>
                </div>
              </AccordionItem>

              <AccordionItem
                title="Current season vs. retro"
                subtitle="Collecting tips for classic kits"
                icon={<Sparkles className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  Current-season kits are widely available in standard sizes. Retro kits
                  (previous seasons, classic designs) are often limited-run and may have
                  different sizing.
                </p>
                <ul className="space-y-2">
                  {[
                    "Original manufacturer tags — add authenticity value",
                    "Match patches and printing from iconic seasons",
                    "Limited-edition third kits and training wear",
                    "Player-issue versions (rare, higher value)",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm">
                      <Printer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Buying via WhatsApp"
                subtitle="How OnPoint makes it faster"
                icon={<Smartphone className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">
                  On OnPoint, you browse kits on a curator's storefront, try them on
                  virtually, and send a ready-to-act brief via WhatsApp. The brief captures
                  everything: item, size, printing details, and delivery info.
                </p>
                <div className="pl-5 border-l-2 border-primary/30 text-sm">
                  <p className="font-semibold text-foreground">Pro tip</p>
                  <p className="mt-1 text-muted-foreground">
                    Use the AI try-on before you order. Upload a photo and see how the kit fits
                    your body type — it saves the back-and-forth on sizing questions.
                  </p>
                </div>
              </AccordionItem>
            </Accordion>
          </div>
        </Reveal>

        {/* Related guides + CTA — compact */}
        <div className="border-t border-border pt-6 mt-8">
          <h3 className="text-sm font-bold mb-3">Related guides</h3>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <Link
              href="/guides/streetwear-fits"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Streetwear Style Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Sneaker drops, layering, oversized fits</p>
            </Link>
            <Link
              href="/guides/sneaker-care"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Sneaker Collecting & Care Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Cleaning, storage, authentication tips</p>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Browse real kits on the{" "}
            <Link href="/s/wanja" className="text-primary hover:underline">Wanja storefront</Link>
            {" — Premier League jerseys with WhatsApp checkout."}
          </p>
        </div>

        {/* CTA */}
        <div className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Ready to find your next kit?
          </p>
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            <Smartphone className="h-4 w-4" />
            Try on a kit now
          </Link>
        </div>
      </article>
    </OnPointLayout>
  );
}
