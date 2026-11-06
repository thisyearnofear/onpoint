import type { Metadata } from "next";
import { Check, Leaf, Camera, Recycle, Shirt } from "lucide-react";
import { AccordionItem } from "../../../components/ui/Accordion";
import { GuideAccordion } from "../../../components/guides/GuideAccordion";
import { GuideRelated } from "../../../components/guides/GuideRelated";
import { GuideCta } from "../../../components/guides/GuideCta";
import { GuideLayout } from "../../../components/guides/GuideLayout";

export const metadata: Metadata = {
  title: "Sustainable & Ethical Fashion Guide | OnPoint",
  description:
    "How to build a sustainable wardrobe — fabric choices, second-hand shopping, caring for clothes to extend their life, and supporting ethical brands.",
  openGraph: {
    title: "Sustainable & Ethical Fashion Guide | OnPoint",
    description:
      "Build a wardrobe that looks good and does good. Fabric choices, thrifting, and care tips.",
    images: [{ url: "/assets/1Product.png" }],
  },
};

export default function SustainableFashionGuide() {
  return (
    <GuideLayout
      title="Sustainable & Ethical Fashion Guide"
      lede="Buy better, care longer, and choose pieces with intention â fashion doesn’t have to cost the planet."
      takeaways={[
        "Buy fewer, better pieces — a capsule wardrobe beats fast fashion",
        "Choose organic cotton, linen, hemp, and Tencel over synthetics",
        "Wash cold, line dry, and repair to extend garment life by years",
        "Second-hand is the single most impactful sustainable choice",
      ]}
    >
      {/* Detailed sections — progressive disclosure via accordion */}
      <GuideAccordion>
        <AccordionItem
          title="The five R’s of sustainable fashion"
          subtitle="Reduce, reuse, repair, recycle, rent"
          icon={<Recycle className="w-4 h-4" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                r: "Reduce",
                body: "Buy fewer, better pieces. A 10-item capsule wardrobe worn 30 times each has a lower footprint than 50 fast-fashion pieces worn once.",
              },
              {
                r: "Reuse",
                body: "Thrift, swap, and buy second-hand. Vintage and pre-owned fashion keeps clothing in use and out of landfills.",
              },
              {
                r: "Repair",
                body: "Learn basic mending â replacing a button, fixing a hem, or darning a hole can extend a garment’s life by years.",
              },
              {
                r: "Recycle",
                body: "When a piece is truly done, recycle it through textile recycling programs. Never throw clothes in general waste.",
              },
              {
                r: "Rent",
                body: "For one-off occasions (weddings, events), consider renting instead of buying. It saves money and closet space.",
              },
            ].map(({ r, body }) => (
              <div key={r} className="pl-5 border-l-2 border-primary/20">
                <h3 className="text-sm font-bold text-success">{r}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-5">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </AccordionItem>

        <AccordionItem
          title="Fabrics to choose (and avoid)"
          subtitle="Natural vs synthetic — what to look for"
          icon={<Leaf className="w-4 h-4" />}
        >
          <div className="space-y-3">
            <div className="pl-5 border-l-2 border-success/30">
              <h3 className="text-sm font-bold text-success">Choose these</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>
                  • Organic cotton — uses 91% less water than conventional
                  cotton
                </li>
                <li>
                  • Linen — made from flax, requires minimal water and
                  pesticides
                </li>
                <li>• Hemp — grows quickly, enriches soil, durable fibres</li>
                <li>
                  • Tencel/Lyocell — closed-loop production, biodegradable
                </li>
                <li>
                  • Wool — natural, renewable, biodegradable (look for
                  responsible sourcing)
                </li>
              </ul>
            </div>
            <div className="pl-5 border-l-2 border-warning/30">
              <h3 className="text-sm font-bold text-warning">Reduce use of</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>
                  • Polyester — sheds microplastics in every wash, takes 200+
                  years to decompose
                </li>
                <li>
                  • Nylon — energy-intensive production, non-biodegradable
                </li>
                <li>
                  • Acrylic — petroleum-based, sheds microfibres, difficult to
                  recycle
                </li>
                <li>
                  • Viscose/Rayon — often involves deforestation and
                  chemical-intensive processing
                </li>
              </ul>
            </div>
          </div>
        </AccordionItem>

        <AccordionItem
          title="Make your clothes last longer"
          subtitle="Wash, dry, and store smarter"
          icon={<Shirt className="w-4 h-4" />}
        >
          <p className="text-sm leading-7 mb-3 text-muted-foreground">
            The most sustainable garment is the one already in your closet.
            Extend its life:
          </p>
          <ul className="space-y-2">
            {[
              "Wash less — most items don't need washing after every wear. Air out instead",
              "Wash cold — 30°C uses 40% less energy than 40°C and is gentler on fabrics",
              "Line dry — tumble drying causes significant wear and shrinkage. Air drying preserves elasticity and colour",
              "Store properly — use padded hangers for structured items, fold knits to prevent stretching",
              "Rotate regularly — give clothes 24-48 hours between wears to let fibres recover",
              "Spot clean — treat stains immediately rather than washing the entire garment",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm">
                <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </AccordionItem>

        <AccordionItem
          title="Smart second-hand shopping"
          subtitle="Deadstock, vintage denim, leather, tailoring"
          icon={<Check className="w-4 h-4" />}
        >
          <p className="text-sm leading-7 mb-3 text-muted-foreground">
            Buying second-hand is the single most impactful thing you can do for
            sustainable fashion. On OnPoint, vintage and thrift curators list
            pre-loved pieces with virtual try-on, so you can see the fit before
            you buy. Look for:
          </p>
          <ul className="space-y-2">
            {[
              "Deadstock items — never worn, original tags, previous season. Best value in second-hand",
              "Vintage denim — modern construction can't match the quality of 70s-90s denim",
              "Leather goods — quality leather from past decades often outperforms new production",
              "Tailored pieces — vintage blazers and trousers offer craftsmanship rarely found at modern prices",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </AccordionItem>
      </GuideAccordion>

      <GuideRelated
        links={[
          {
            href: "/guides/vintage-thrifting",
            title: "Vintage & Thrift Shopping Guide",
            desc: "Hidden gems, quality checks, era sizing",
          },
          {
            href: "/guides/accessories-styling",
            title: "Accessories Styling Guide",
            desc: "Quality over quantity, timeless pieces",
          },
        ]}
      />

      <GuideCta
        question="Ready to build a sustainable wardrobe?"
        label="Try on sustainable styles now"
        href="/lab"
        icon={<Camera className="h-4 w-4" />}
      />
    </GuideLayout>
  );
}
