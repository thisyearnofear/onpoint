import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Sparkles, ShoppingBag, Camera } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";

export const metadata: Metadata = {
  title: "Streetwear Style Guide | BeOnPoint",
  description:
    "The essential streetwear style guide — sneaker drops, layering techniques, oversized fits, and how to build a wardrobe that moves culture forward.",
  openGraph: {
    title: "Streetwear Style Guide | BeOnPoint",
    description: "Sneaker drops, layering, oversized fits — build a streetwear wardrobe that moves culture forward.",
    images: [{ url: "/assets/2Product.png" }],
  },
};

export default function StreetwearGuide() {
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
            Streetwear Style Guide
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            From sneaker drops to oversized silhouettes — streetwear is the most
            influential fashion movement of the last decade. Here&rsquo;s how to
            build a wardrobe that stays fresh, authentic, and unmistakably you.
          </p>
        </header>

        <Reveal>
          <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">The foundation: core pieces</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Every great streetwear fit starts with reliable basics. These are the
            pieces you&rsquo;ll reach for again and again. Invest in quality, and
            let your statement pieces do the talking.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Oversized T-shirts in neutral tones (black, white, grey, cream)",
              "Hoodies and crewnecks — heavy-weight cotton fleece holds shape best",
              "Cargos and wide-leg trousers — tech fabrics for an elevated look",
              "Denim jackets and chore coats — the perfect layering piece",
              "Clean white sneakers — the cornerstone of any rotation",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          </section>
        </Reveal>

        <Reveal>
          <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Sneaker rotation essentials</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                slot: "Daily beaters",
                picks: "Air Force 1, Nike Dunks, Adidas Samba — versatile, durable, works with everything",
              },
              {
                slot: "Statement pair",
                picks: "Limited-run JordaBrand collab, Yeezy, ASICS x Kiko — the pair that starts conversations",
              },
              {
                slot: "Tech / performance",
                picks: "New Balance 990v6, Hoka, Salomon — comfort-first, trending hard",
              },
              {
                slot: "Retro rotation",
                picks: "Air Jordan 1-14, Reebok Classics, Puma Suede — timeless silhouettes that never date",
              },
            ].map(({ slot, picks }) => (
              <div key={slot} className="pl-5 border-l-2 border-primary/20">
                <h3 className="text-sm font-bold">{slot}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-5">{picks}</p>
              </div>
            ))}
          </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">The art of layering</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Streetwear layering is about proportion and contrast. The goal is depth,
            not bulk. Start with a base layer (T-shirt or long sleeve), add a mid layer
            (hoodie, button-up, or vest), and finish with an outer layer (jacket,
            coat, or gilet). Key principles:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Mix textures: cotton + nylon + denim creates visual interest",
              "Vary lengths: a cropped jacket over a long tee adds dimension",
              "Colour block: limit to 2-3 colours per fit for a cohesive look",
              "Accessories matter: a beanie, crossbody bag, or chain finishes the silhouette",
              "Fit contrast: oversized outer layer + slim trousers (or vice versa)",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          </section>
        </Reveal>

        <Reveal>
          <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Drops &amp; timing</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Streetwear moves fast. Limited drops sell out in minutes, and the resale
            market moves just as quickly. If you&rsquo;re shopping for limited pieces,
            here&rsquo;s the playbook:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Follow your curator on WhatsApp — most announce drops before listing",
              "Use virtual try-on to decide fast — hesitation costs you the pair",
              "Set a budget ahead of drops to avoid impulse spending",
              "Retro releases (Jordan, Yeezy) restock periodically — ask your curator for restock alerts",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          </section>
        </Reveal>

        <Reveal>
          <section className="mb-10">
          <h2 className="text-xl font-bold tracking-tight">Sustainable streetwear</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            One of the best things about streetwear culture is the vintage and second-hand
            market. Deadstock (never worn) pieces from previous seasons, vintage band tees,
            and thrifted cargos all bring authenticity that new items can&rsquo;t replicate.
            Curators on BeOnPoint regularly source vintage and deadstock pieces —
            it&rsquo;s fashion with a story, and it keeps clothing out of landfills.
          </p>
          </section>
        </Reveal>

        {/* Related guides */}
        <div className="border-t border-border pt-8">
          <h3 className="text-sm font-bold mb-3">Related guides</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/guides/sneaker-care"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Sneaker Collecting &amp; Care Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Cleaning, storage, authentication tips</p>
            </Link>
            <Link
              href="/guides/vintage-thrifting"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Vintage &amp; Thrift Shopping Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Deadstock finds, quality checks, sizing</p>
            </Link>
          </div>
        </div>

        <div className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Ready to see how that drop looks on you?
          </p>
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            <Camera className="h-4 w-4" />
            Try on streetwear now
          </Link>
        </div>
      </article>
    </main>
  );
}
