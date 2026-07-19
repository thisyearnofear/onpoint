/**
 * AICuratorSection — shows AI Curator "second opinion" voices on a human
 * Curator's storefront. Each AI persona gives their take on the catalog,
 * and clicking a card starts a try-on session pre-configured with that voice.
 *
 * Follows ADR 0002: AI Curators appear inside human Curator storefronts
 * as optional "second opinion" voices.
 */

"use client";

import React from "react";
import { Camera, Sparkles, MessageCircle, ArrowRight } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";

interface AICuratorVoice {
  /** Maps to StylistPersona key */
  personaKey: StylistPersona;
  name: string;
  description: string;
  color: string;
  bg: string;
  ring: string;
  icon: React.ElementType;
  take: string;
}

interface AICuratorSectionProps {
  curatorName: string;
  curatorSlug: string;
  verticals: string[];
  /** First listing ID from the storefront — used as the deep-link item. */
  listingId?: string;
}

/** AI persona voices that appear as second opinions on human storefronts. */
const AI_VOICES: AICuratorVoice[] = [
  {
    personaKey: "miranda",
    name: "Miranda Priestly",
    description: "The truth, elegantly delivered.",
    color: "text-muted-foreground",
    bg: "bg-slate-500/10",
    ring: "hover:ring-slate-500/30",
    icon: Sparkles,
    take: "The fit is everything. I'd start with silhouette — a clean shoulder line tells me more about quality than any logo. Try it on and let's see if the cut earns its price.",
  },
  {
    personaKey: "edina",
    name: "Edina Monsoon",
    description: "Darling, let's be brutally honest.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    ring: "hover:ring-purple-500/30",
    icon: Sparkles,
    take: "Oh darling, this is DIVINE. The color story is giving main character energy. But before you commit, try it on — because confidence looks different when you can see yourself.",
  },
  {
    personaKey: "shaft",
    name: "John Shaft",
    description: "Cool, confident, no-nonsense.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    ring: "hover:ring-orange-500/30",
    icon: MessageCircle,
    take: "That's a solid pick. Clean lines, good construction — it'll hold up. Try it on and let's see if it moves right.",
  },
];

/**
 * Generate a context-aware "take" from each AI voice based on the
 * curator's verticals. Falls back to the default take if no match.
 */
function getAIVoiceTake(
  voice: AICuratorVoice,
  verticals: string[],
): string {
  const has = (v: string) => verticals.some((vt) => vt.includes(v));

  if (voice.personaKey === "miranda") {
    if (has("football") || has("sportswear"))
      return "Sportswear has evolved from pitch to pavement. The question isn't whether it's fashionable — it's whether the construction holds up. Try it on and let's evaluate the tailoring.";
    if (has("ankara") || has("african-print"))
      return "The print is bold, which I respect. But bold without precision is just noise. Try it on — I want to see how the pattern falls across the shoulders.";
    if (has("vintage") || has("thrift"))
      return "Vintage is about curation, not nostalgia. Every piece should earn its place. Try this on and tell me — does it feel timeless, or just old?";
    if (has("sneakers") || has("streetwear"))
      return "Sneaker culture has become its own language. The silhouette matters more than the colorway. Try them on — proportion is everything.";
    if (has("hair") || has("barber"))
      return "Presentation is a total system — the hair, the fit, the posture. A great haircut needs a great outfit to frame it. Try this on and let's see the full picture.";
  }

  if (voice.personaKey === "edina") {
    if (has("football") || has("sportswear"))
      return "Oh, you're going FULL kit? I love the commitment. Try it on, darling — nothing says 'I have taste' like looking incredible in a football jersey.";
    if (has("ankara") || has("african-print"))
      return "The PRINT! The COLOR! This is giving Nairobi-to-Lagos energy and I am HERE for it. Try it on so we can see if it matches your audacity.";
    if (has("vintage") || has("thrift"))
      return "Vintage finds are like buried treasure — except YOU get to decide if it's gold or just old. Try it on and let's see if it sparkles.";
    if (has("sneakers") || has("streetwear"))
      return "These kicks are giving main character energy. Try them on — I need to see if the vibe matches your ambition.";
    if (has("hair") || has("barber"))
      return "A killer look is head-to-toe, darling. The hair is iconic, but the outfit has to match that energy. Try this on — I dare you not to feel fabulous.";
  }

  if (voice.personaKey === "shaft") {
    if (has("football") || has("sportswear"))
      return "Sportswear done right is about confidence, not comfort. That piece has the structure to pull it off. Try it on — see if it earns its spot.";
    if (has("ankara") || has("african-print"))
      return "Bold print. That takes nerve to wear well — and nerve is exactly what this piece needs. Try it on and own it.";
    if (has("vintage") || has("thrift"))
      return "Vintage only works if it doesn't look like a costume. This one has the bones to feel modern. Try it on — let's see if it holds up.";
    if (has("sneakers") || has("streetwear"))
      return "Clean sneakers change everything. These have the right profile — not too chunky, not too slim. Try them on and see how they move.";
    if (has("hair") || has("barber"))
      return "Good hair is half the outfit. Now the other half has to match that energy. Try this on — let's see the full picture.";
  }

  return voice.take;
}

function buildTryOnHref(
  curatorSlug: string,
  personaKey: StylistPersona,
  listingId?: string,
): string {
  const params = new URLSearchParams({
    tab: "try-on",
    persona: personaKey,
    from: curatorSlug,
  });
  if (listingId) params.set("item", listingId);
  return `/lab?${params.toString()}`;
}

export function AICuratorSection({
  curatorName,
  curatorSlug,
  verticals,
  listingId,
}: AICuratorSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">
          AI Stylist second opinions
        </h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          Free
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Our AI stylists weigh in on {curatorName}&apos;s collection.
        Pick one to start a try-on session with their voice.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {AI_VOICES.map((voice) => {
          const Icon = voice.icon;
          const take = getAIVoiceTake(voice, verticals);
          const href = buildTryOnHref(curatorSlug, voice.personaKey, listingId);

          return (
            <a
              key={voice.personaKey}
              href={href}
              className={`group relative rounded-lg border border-border p-4 transition-all hover:border-border hover:bg-muted/30 hover:ring-2 ${voice.ring} hover:shadow-md`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${voice.bg} transition-transform group-hover:scale-110`}
                >
                  <Icon className={`h-4 w-4 ${voice.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold">{voice.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {voice.description}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground italic mb-3">
                &ldquo;{take}&rdquo;
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-3 w-3" />
                Try on with {voice.name.split(" ")[0]}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
