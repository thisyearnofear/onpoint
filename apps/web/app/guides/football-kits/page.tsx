import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Shirt, Ruler, Printer, Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Football Kit Buying Guide | BeOnPoint",
  description:
    "The complete guide to buying football kits online — sizing, printing names & numbers, authentic vs. replica, and how to get the perfect fit for match day.",
  openGraph: {
    title: "Football Kit Buying Guide | BeOnPoint",
    description: "Sizing, printing, authentic vs. replica — everything you need to buy the perfect football kit.",
    images: [{ url: "/assets/2Product.png" }],
  },
};

export default function FootballKitsGuide() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <article className="mx-auto max-w-3xl px-4 py-12">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to BeOnPoint
        </Link>

        {/* Header */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Shirt className="h-3.5 w-3.5" />
            Style guide
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Football Kit Buying Guide
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Whether you&rsquo;re after the latest Premier League home shirt, a classic
            retro kit, or training gear for the pitch — this guide covers everything
            you need to know before you buy.
          </p>
        </header>

        {/* Section 1 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Sizing: getting it right the first time</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Football kit sizing varies significantly between brands. A Nike size M fits
            differently from an Adidas size M, and Puma runs its own sizing entirely.
            Here&rsquo;s what to keep in mind:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Nike kits run slim — size up if you prefer a relaxed fit or plan to layer",
              "Adidas offers a standard fit; go with your usual size",
              "Puma tends to run slightly larger, especially in the chest",
              "Retro/reissue kits often use older sizing charts — check the specific season&rsquo;s measurements",
              "Player-version kits (Vapor, Authentic) are tighter and lighter than fan versions",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 2 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Printing names &amp; numbers</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Most curators offer printing with your preferred name and number. Premier
            League kits use official font sets — your curator can match the exact
            typeface for the current season. A few things to confirm before ordering:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Font style: home vs. away kits sometimes use different fonts",
              "Position size: sleeve numbers (UCL) vs. back numbers (league)",
              "Cup competitions: check if the kit needs specific patches (FA Cup, UCL)",
              "Name length: most leagues allow up to 15 characters",
              "Print placement: standard is 7-8 inches tall on the back",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 3 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Authentic vs. replica</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold">Replica (Stadium)</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>• Standard fit, more comfortable for casual wear</li>
                <li>• Heat-sealed badge and sponsor</li>
                <li>~$70-90 — best value for most fans</li>
                <li>• Easier to print names and numbers on</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold">Authentic (Vapor/Player)</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>• Tight, performance fit — size up if unsure</li>
                <li>• Woven badge, heat-transfer sponsor</li>
                <li>~$120-150 — what players wear on pitch</li>
                <li>• Lighter fabric, more breathable</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Current season vs. retro</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Current-season kits are widely available in standard sizes. Retro kits
            (previous seasons, classic designs) are often limited-run and may have
            different sizing. If you&rsquo;re collecting, look for:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Original manufacturer tags — add authenticity value",
              "Match patches and printing from iconic seasons",
              "Limited-edition third kits and training wear",
              "Player-issue versions (rare, higher value)",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Printer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 5 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Buying via WhatsApp</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            On BeOnPoint, you browse kits on a curator&rsquo;s storefront, try them on
            virtually, and send a ready-to-act brief via WhatsApp. The brief captures
            everything: item, size, printing details, and delivery info. The curator
            confirms stock and you pay however works best — M-Pesa, bank transfer, or cash.
          </p>
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-foreground">Pro tip</p>
            <p className="mt-1 text-muted-foreground">
              Use the AI try-on before you order. Upload a photo and see how the kit fits
              your body type — it saves the back-and-forth on sizing questions.
            </p>
          </div>
        </section>

        {/* Related guides */}
        <div className="border-t border-border pt-8">
          <h3 className="text-sm font-bold mb-3">Related guides</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/guides/streetwear-fits"
              className="block rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <p className="text-sm font-bold">Streetwear Style Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Sneaker drops, layering, oversized fits</p>
            </Link>
            <Link
              href="/guides/sneaker-care"
              className="block rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <p className="text-sm font-bold">Sneaker Collecting &amp; Care Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Cleaning, storage, authentication tips</p>
            </Link>
          </div>
          {/* Curator storefront */}
          <p className="mt-4 text-xs text-muted-foreground">
            Browse real kits on the{" "}
            <Link href="/s/wanja" className="text-primary hover:underline">Wanja storefront</Link>
            {" "}— Premier League jerseys with WhatsApp checkout.
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
    </main>
  );
}
