/**
 * AICuratorSection — shows AI Curator "second opinion" voices on a human
 * Curator's storefront. Each AI persona gives their take on the catalog,
 * letting shoppers get multiple style perspectives before they buy.
 *
 * Follows ADR 0002: AI Curators appear inside human Curator storefronts
 * as optional "second opinion" voices.
 */

"use client";

import React from "react";
import { Sparkles, MessageCircle } from "lucide-react";

interface AICuratorVoice {
  key: string;
  name: string;
  description: string;
  color: string;
  bg: string;
  icon: React.ElementType;
  take: string;
}

interface AICuratorSectionProps {
  curatorName: string;
  verticals: string[];
}

/** AI persona voices that appear as second opinions on human storefronts. */
const AI_VOICES: AICuratorVoice[] = [
  {
    key: "miranda",
    name: "Miranda Priestly",
    description: "The truth, elegantly delivered.",
    color: "text-slate-500",
    bg: "bg-slate-500/10",
    icon: Sparkles,
    take: "The fit is everything. I'd start with silhouette — a clean shoulder line tells me more about quality than any logo. Try it on and let's see if the cut earns its price.",
  },
  {
    key: "edina",
    name: "Edina Monsoon",
    description: "Darling, let's be brutally honest.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    icon: Sparkles,
    take: "Oh darling, this is DIVINE. The color story is giving main character energy. But before you commit, try it on — because confidence looks different when you can see yourself.",
  },
  {
    key: "tan",
    name: "Tan France",
    description: "You're gorgeous, let's make you shine.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    icon: MessageCircle,
    take: "I love this pick. The proportions are really flattering for most body types. Try it on so you can see exactly how it sits — I think you'll be pleasantly surprised.",
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

  if (voice.key === "miranda") {
    if (has("football") || has("sportswear"))
      return "Sportswear has evolved from pitch to pavement. The question isn't whether it's fashionable — it's whether the construction holds up. Try it on and let's evaluate the tailoring.";
    if (has("ankara") || has("african-print"))
      return "The print is bold, which I respect. But bold without precision is just noise. Try it on — I want to see how the pattern falls across the shoulders.";
    if (has("vintage") || has("thrift"))
      return "Vintage is about curation, not nostalgia. Every piece should earn its place. Try this on and tell me — does it feel timeless, or just old?";
    if (has("sneakers") || has("streetwear"))
      return "Sneaker culture has become its own language. The silhouette matters more than the colorway. Try them on — proportion is everything.";
  }

  if (voice.key === "edina") {
    if (has("football") || has("sportswear"))
      return "Oh, you're going FULL kit? I love the commitment. Try it on, darling — nothing says 'I have taste' like looking incredible in a football jersey.";
    if (has("ankara") || has("african-print"))
      return "The PRINT! The COLOR! This is giving Nairobi-to-Lagos energy and I am HERE for it. Try it on so we can see if it matches your audacity.";
    if (has("vintage") || has("thrift"))
      return "Vintage finds are like buried treasure — except YOU get to decide if it's gold or just old. Try it on and let's see if it sparkles.";
    if (has("sneakers") || has("streetwear"))
      return "These kicks are giving main character energy. Try them on — I need to see if the vibe matches your ambition.";
  }

  if (voice.key === "tan") {
    if (has("football") || has("sportswear"))
      return "Great choice — sportswear is all about comfort meeting style. Try it on and I'll tell you exactly how to style it for different occasions.";
    if (has("ankara") || has("african-print"))
      return "Ankara is such a beautiful fabric to work with. Try this on — I think the colors will really complement your skin tone.";
    if (has("vintage") || has("thrift"))
      return "I love a good vintage find. The key is making it feel intentional, not costume. Try it on and we'll see how to modernize it.";
    if (has("sneakers") || has("streetwear"))
      return "Fresh sneakers can transform an entire outfit. Try these on — I think they'll become your new go-to pair.";
  }

  return voice.take;
}

export function AICuratorSection({
  curatorName,
  verticals,
}: AICuratorSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
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
        Each has a different perspective — try on an item and pick the
        voice that resonates with you.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {AI_VOICES.map((voice) => {
          const Icon = voice.icon;
          const take = getAIVoiceTake(voice, verticals);

          return (
            <div
              key={voice.key}
              className={`rounded-lg border border-border p-3 transition-colors hover:bg-muted/30`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${voice.bg}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${voice.color}`} />
                </div>
                <div>
                  <p className="text-xs font-bold">{voice.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {voice.description}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground italic">
                &ldquo;{take}&rdquo;
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
