import Link from "next/link";
import type { Metadata } from "next";
import { Palette, ArrowRight, Shirt, Sparkles, ShoppingBag, Search, Scissors, Footprints, Leaf, Star, Heart, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Style Guides | BeOnPoint",
  description:
    "Fashion style guides and buying advice — football kits, Ankara prints, streetwear, vintage thrifting, formal wear, and more. Expert tips for smarter shopping.",
  openGraph: {
    title: "Style Guides | BeOnPoint",
    description: "Expert fashion style guides and buying advice across every category.",
    images: [{ url: "/assets/1Product.png" }],
  },
};

const GUIDES = [
  {
    slug: "football-kits",
    title: "Football Kit Buying Guide",
    description: "Sizing, printing names and numbers, authentic vs replica, and how to get the perfect fit for match day.",
    icon: Shirt,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    readTime: "5 min",
  },
  {
    slug: "ankara-style",
    title: "Ankara & African Print Style Guide",
    description: "Fabrics, occasion matching, made-to-measure measurements, and virtual try-on for bold prints.",
    icon: Sparkles,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    readTime: "4 min",
  },
  {
    slug: "streetwear-fits",
    title: "Streetwear Style Guide",
    description: "Core pieces, sneaker rotation essentials, layering techniques, and navigating limited drops.",
    icon: ShoppingBag,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    readTime: "5 min",
  },
  {
    slug: "vintage-thrifting",
    title: "Vintage & Thrift Shopping Guide",
    description: "Hidden gems, quality checks, vintage sizing quirks, and building a unique wardrobe sustainably.",
    icon: Search,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    readTime: "5 min",
  },
  {
    slug: "formal-wear",
    title: "Formal Wear & Tailoring Guide",
    description: "Bespoke vs made-to-measure, fabric selection, measurements, and traditional agbadas and kaftans.",
    icon: Scissors,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    readTime: "6 min",
  },
  {
    slug: "sneaker-care",
    title: "Sneaker Collecting & Care Guide",
    description: "Building a rotation, cleaning by material, storage for value retention, and spotting authentic vs fake pairs.",
    icon: Footprints,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    readTime: "5 min",
  },
  {
    slug: "sustainable-fashion",
    title: "Sustainable & Ethical Fashion Guide",
    description: "The five R's of sustainable fashion, fabric choices, making clothes last longer, and smart second-hand shopping.",
    icon: Leaf,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    readTime: "5 min",
  },
  {
    slug: "accessories-styling",
    title: "Accessories Styling Guide",
    description: "The rule of three, metal mixing, building an accessories wardrobe, and occasion matching for watches, bags, and jewellery.",
    icon: Star,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    readTime: "4 min",
  },
  {
    slug: "plus-size-fashion",
    title: "Plus-Size Fashion & Fit Guide",
    description: "Finding the right fit, flattering silhouettes, fabric and pattern tips, and dressing with confidence at every size.",
    icon: Heart,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    readTime: "5 min",
  },
  {
    slug: "occasion-wear",
    title: "Occasion Wear & Event Dressing Guide",
    description: "Dress codes decoded, colour coordination, fabric and climate considerations, and planning ahead for weddings and formal events.",
    icon: Calendar,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    readTime: "6 min",
  },
];

export default function GuidesIndexPage() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1.5 shadow-md">
              <Palette className="h-4 w-4 text-white" />
            </div>
            BeOnPoint
          </Link>
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            Try It Free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-14 md:py-18 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Style guides
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Fashion style guides
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Expert buying advice and style tips across every category — from football
            kits to Ankara prints, streetwear to formal tailoring.
          </p>
        </div>
      </section>

      {/* Guide cards */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="space-y-4">
          {GUIDES.map((guide) => {
            const Icon = guide.icon;
            return (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="group block border-b border-border/40 py-4 transition-colors hover:border-primary/30"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${guide.bg}`}>
                    <Icon className={`h-6 w-6 ${guide.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold">{guide.title}</h2>
                      <span className="text-[10px] text-muted-foreground shrink-0">{guide.readTime}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {guide.description}
                    </p>
                  </div>
                  <ArrowRight className="mt-3 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center border-t border-border pt-8">
          <p className="text-sm text-muted-foreground mb-4">
            Ready to see how these styles look on you?
          </p>
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            Try virtual try-on now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1 shadow-md">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            BeOnPoint
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/curator" className="hover:text-foreground transition-colors">For Curators</Link>
          </div>
          <p className="text-xs">10 style guides for smarter fashion shopping.</p>
        </div>
      </footer>
    </main>
  );
}
