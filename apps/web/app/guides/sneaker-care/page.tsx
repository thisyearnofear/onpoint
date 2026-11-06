import Link from "next/link";
import type { Metadata } from "next";
import { Check, ShoppingBag, Camera, Layers, ShieldCheck, Clock } from "lucide-react";
import { Reveal } from "../../../components/ui/Reveal";
import { Accordion, AccordionItem } from "../../../components/ui/Accordion";
import { GuideLayout } from "../../../components/guides/GuideLayout";

export const metadata: Metadata = {
  title: "Sneaker Collecting & Care Guide | OnPoint",
  description:
    "The essential guide to sneaker collecting — building a rotation, cleaning and maintenance, storing for value retention, and spotting authentic vs. fake pairs.",
  openGraph: {
    title: "Sneaker Collecting & Care Guide | OnPoint",
    description: "Build a sneaker rotation that holds value. Cleaning, storage, authentication tips.",
    images: [{ url: "/assets/2Product.png" }],
  },
};

export default function SneakerCareGuide() {
  return (
    <GuideLayout
        title="Sneaker Collecting & Care Guide"
        lede="Building a rotation, cleaning by material, storage, and authentication — everything that separates sneakers that last from sneakers that crumble."
  takeaways={[
            "A balanced rotation = beaters, a rotational pair, a statement pair, and a retro",
                "Clean by material — suede never gets wet, canvas can go in the machine",
                "Original box + tissue paper adds 15-20% to resale value",
                "Check stitching, box label, smell, and weight to spot fakes"
          ]}
      >
                {/* Header — punchy, not a wall of text */}

        {/* TL;DR — quick takeaways, no reading required */}
        

        {/* Detailed sections — progressive disclosure via accordion */}
        <Reveal>
          <div className="border border-border p-5 md:p-6">
            <Accordion>
              <AccordionItem
                title="Building your rotation"
                subtitle="5 pairs that cover every scenario"
                icon={<Layers className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">A well-balanced rotation covers every scenario without overlap. Aim for:</p>
                <ul className="space-y-2">
                  {[
                    "Daily beaters — comfortable, replaceable, works with everything (Air Force 1, Nike Dunks, Adidas Samba)",
                    "Rotational pair — one step above beaters, worn 2-3 times a week (New Balance 990, ASICS)",
                    "Statement pair — the drop that turns heads, saved for specific outfits or occasions",
                    "Retro/classic — timeless silhouettes that never go out of style (Air Jordan 1, Reebok Classics)",
                    "Beater boots — for weather days, hikes, or anything that would ruin suede",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Cleaning by material"
                subtitle="Leather, suede, mesh, canvas — the right method"
                icon={<Check className="w-4 h-4" />}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { material: "Leather", care: "Mild soap + water. Use a horsehair brush for scuffs. Condition every 3 months. Avoid direct sunlight when drying." },
                    { material: "Suede / Nubuck", care: "Suede brush + eraser block for stains. Waterproof spray before first wear. Never submerge in water." },
                    { material: "Mesh / Knit", care: "Cold water + gentle detergent. Stuff with paper towels to maintain shape while drying. Air dry only." },
                    { material: "Canvas", care: "Machine washable on gentle cycle (remove laces first). Air dry — heat damages glue and shape." },
                  ].map(({ material, care }) => (
                    <div key={material} className="pl-5 border-l-2 border-primary/20">
                      <h3 className="text-sm font-bold">{material}</h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-5">{care}</p>
                    </div>
                  ))}
                </div>
              </AccordionItem>

              <AccordionItem
                title="Storage for value retention"
                subtitle="Keep boxes, control moisture, never stack"
                icon={<ShoppingBag className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">How you store sneakers directly affects their resale value. Follow these rules:</p>
                <ul className="space-y-2">
                  {[
                    "Keep original box and tissue paper — these add 15-20% to resale value",
                    "Store in a cool, dry place away from direct sunlight (UV degrades colour and materials)",
                    "Use shoe trees for leather pairs to maintain shape and prevent creasing",
                    "Silica gel packets inside the box control moisture in humid climates",
                    "Never stack pairs on top of each other — weight distorts the midsoles over time",
                    "For long-term storage, wrap in acid-free tissue paper, not plastic bags",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="Spotting fakes: quick checklist"
                subtitle="Stitching, box label, smell, insole, weight"
                icon={<ShieldCheck className="w-4 h-4" />}
              >
                <p className="text-sm leading-7 mb-3">When buying from resellers or second-hand, run through these checks:</p>
                <ul className="space-y-2">
                  {[
                    "Stitching: authentic pairs have clean, even stitches. Fakes often have loose threads or inconsistent spacing",
                    "Box label: compare font weight, spacing, and SKU format against known authentic pairs",
                    "Smell test: authentic pairs smell like factory glue. Chemical or plastic smells are a red flag",
                    "Insole removal: check the glue pattern under the insole — authentic pairs use specific patterns per brand",
                    "Weight: fake pairs are often lighter due to cheaper materials. Compare with a known authentic pair",
                  ].map((check) => (
                    <li key={check} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </AccordionItem>

              <AccordionItem
                title="When to buy: seasonal timing"
                subtitle="2-3 months post-release for the best price"
                icon={<Clock className="w-4 h-4" />}
              >
                <p className="text-sm leading-7">
                  Sneaker prices fluctuate by season. The best time to buy is typically 2-3 months
                  after release, after the initial hype settles but before stock runs dry. Holiday
                  seasons (Black Friday, end-of-year) often see price drops on general-release pairs.
                  Limited collabs rarely drop in price — buy at retail or don&rsquo;t buy at all.
                </p>
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
              <p className="mt-0.5 text-xs text-muted-foreground">Sneaker rotation essentials, drops, layering</p>
            </Link>
            <Link
              href="/guides/sustainable-fashion"
              className="block py-3 border-b border-border/40 transition-colors hover:border-primary/30 group"
            >
              <p className="text-sm font-bold">Sustainable &amp; Ethical Fashion Guide</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Making clothes last, fabric choices, care</p>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">Ready to see how that pair looks on you?</p>
          <Link href="/lab" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
            <Camera className="h-4 w-4" />
            Try on sneakers now
          </Link>
        </div>
      
    </GuideLayout>
  );
}
