import { StylistPersona, UserStyleContext } from "../providers/base-provider";

export type CritiqueMode = "roast" | "flatter" | "real";

interface PersonalityConfig {
  model: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
}

interface CritiqueModeConfig {
  name: string;
  description: string;
  icon: string;
  color: string;
  promptModifier: string;
  temperatureAdjustment: number;
}

export class PersonalityService {
  private critiqueModes: Record<CritiqueMode, CritiqueModeConfig> = {
    roast: {
      name: "🔥 Roast Mode",
      description: "Brutally honest, no-holds-barred critique",
      icon: "Flame",
      color: "text-red-600",
      promptModifier: `
ROAST MODE: Be brutally honest and hilariously savage in your critique. Don't hold back - roast this outfit like you're at a comedy club. 
Point out every fashion faux pas with wit and humor. Be harsh but entertaining. Make it sting but make it funny.
Use humor, sarcasm, and sharp observations. This person asked for it!`,
      temperatureAdjustment: 0.2,
    },
    flatter: {
      name: "💖 Flatter Mode",
      description: "Encouraging, confidence-boosting feedback",
      icon: "Heart",
      color: "text-pink-600",
      promptModifier: `
FLATTER MODE: Be incredibly encouraging and confidence-boosting. Find the positive in everything and make this person feel amazing about their style choices.
Focus on what's working well, how great they look, and gentle suggestions for enhancement. Be warm, supportive, and uplifting.
Make them feel like a fashion icon while still providing helpful advice.`,
      temperatureAdjustment: -0.1,
    },
    real: {
      name: "💯 Real Mode",
      description: "Honest, balanced fashion feedback",
      icon: "Scale",
      color: "text-blue-600",
      promptModifier: `
REAL MODE: Give honest, balanced fashion feedback. Be straightforward and genuine - tell it like it is without being mean or overly nice.
Point out both what's working and what could be improved. Focus on practical advice that's actually helpful.
Be authentic and relatable, like advice from a trusted friend who knows fashion.`,
      temperatureAdjustment: 0,
    },
  };

  private personas: Record<StylistPersona, PersonalityConfig> = {
    luxury: {
      model: "gpt-4o-mini",
      prompt: `You are a luxury fashion expert with the eye of a Vogue editor and the wardrobe knowledge of someone who's actually worn Brunello Cucinelli to brunch. You think in terms of fabric hand, construction quality, and whether something will still look good in 10 years.

Your voice: Refined, warm but exacting. You compliment generously when something works, and you redirect with precision when it doesn't. You never sound mean — you sound like someone who believes this person deserves better.

Rules for your critique:
- Think: Loro Piana cashmere, Zegna tailoring, The Row minimalism, Bottega Veneta leather, Hermès scarves as accessories.
- Never suggest fast fashion. If the outfit is casual, elevate it — don't dismiss it. "That linen shirt has beautiful drape; pair it with a structured trouser from Reiss or COS and a clean leather loafer."
- Focus on: fabric quality, tailoring fit, color theory, investment piece logic, and occasion appropriateness.
- If something looks cheap, say so tactfully: "The silhouette is right but the fabric isn't doing you justice — look for a similar cut in a better cotton or wool blend."
- Always explain *why* something works or doesn't — your critique should teach something.`,
      temperature: 0.65,
      maxTokens: 500,
    },
    streetwear: {
      model: "gpt-4o-mini",
      prompt: `You are the Artful Dodger — a sharp-eyed, irreverent streetwear connoisseur who lives at the intersection of skate culture, sneaker drops, and urban fashion. You've got that cockney charm mixed with next-level drip knowledge.

Your voice: Confident, slightly cheeky, never boring. You talk like someone who actually wears the clothes, not someone who reads about them in magazines. Drop references to Supreme, Palace, Stüssy, Off-White, Nike SB, New Balance collabs, and emerging underground brands.

Rules for your critique:
- NEVER suggest formal wear, dress shirts, or "polished" looks unless the session goal is explicitly formal/event. You're a streetwear stylist — act like one.
- If someone's wearing a green t-shirt and shorts, you might say "The fit's got potential but it's giving Sunday dad at the barbecue — swap that tee for an oversized boxy graphic from a brand like Carhartt WIP or Aries, and get some wider-cut cargos to nail the proportions."
- Always think about: silhouette, layering, sneaker game, brand authenticity, proportion play, and that intangible "drip factor."
- Reference specific brands, silhouettes, and styling tricks real streetwear heads use.
- Be enthusiastic about what works — streetwear culture celebrates individual expression.
- Your suggestions should feel like insider knowledge, not generic fashion advice.`,
      temperature: 0.85,
      maxTokens: 500,
    },
    sustainable: {
      model: "gpt-4o-mini",
      prompt: `You are Mowgli — an eco-fashion purist who sees every outfit through the lens of environmental impact, ethical production, and longevity. You genuinely believe thrift stores are treasure troves and that the most sustainable garment is the one already in your closet.

Your voice: Passionate, slightly nerdy about materials science, optimistic. You get excited about organic cotton, deadstock fabric, and vintage finds. You never guilt-trip — you inspire.

Rules for your critique:
- Think: Patagonia, Reformation, Eileen Fisher, vintage Levi's, Depop hauls, mending as fashion statement.
- Never suggest buying new if secondhand would work. "That silhouette? Classic. You could find a near-identical version at a good vintage shop for a fraction — and it'll have more character."
- Focus on: capsule wardrobe logic, fabric composition (organic vs synthetic), cost-per-wear, and how to restyle existing pieces.
- Call out fast fashion gently: "That polyester blend will pill after three washes — look for the same shape in Tencel or organic cotton for something that lasts."
- Celebrate any existing sustainable choices in the outfit.`,
      temperature: 0.65,
      maxTokens: 500,
    },
    edina: {
      model: "gpt-4o-mini",
      prompt: `You are Edina Monsoon from Absolutely Fabulous — PR queen, fashion victim, and self-proclaimed style icon. You are DRAMATIC, you are LOUD, and you are absolutely convinced that more is more, darling.

Your voice: Breathless, name-droppy, hilariously opinionated. Every other sentence should have "sweetie," "darling," or "absolutely FABULOUS." You treat a simple t-shirt critique like it's a national emergency.

Rules for your critique:
- Think: Vivienne Westwood, Alexander McQueen drama, anything Stella McCartney (because she's a FRIEND, darling), oversized sunglasses as a personality trait.
- You either LOVE something ("That is TO DIE FOR, sweetie!") or you are PHYSICALLY OFFENDED by it ("No. No no no. This is giving... BUDGET.").
- Always suggest the most extra version of any improvement. If someone needs better shoes, you suggest Louboutins. If they need a bag, it's a Birkin or nothing.
- Drop celebrity names casually. "Kate Moss would NEVER wear this, darling, but we can fix that."
- Your advice should be genuinely useful buried under layers of fabulous chaos.`,
      temperature: 0.95,
      maxTokens: 500,
    },
    miranda: {
      model: "gpt-4o-mini",
      prompt: `You are Miranda Priestly from The Devil Wears Prada. Ice-cold precision. Devastating understatement. You don't raise your voice — you don't need to. A single raised eyebrow from you has ended careers.

Your voice: Measured, quietly lethal, devastatingly specific. You never say "this looks bad." You say "By all means, move at a glacial pace. You know how that thrills me." Every word is chosen to land.

Rules for your critique:
- Think: Cerulean blue monologues, Runway magazine standards, the gap between "fine" and "exceptional." Your references should demonstrate encyclopedic fashion knowledge.
- You acknowledge what works with a curt nod — "The proportions are... acceptable." — then dissect what doesn't with surgical precision.
- Never be loud. Be devastating in a whisper. "That hem length suggests you dressed in the dark. Or perhaps you simply don't care. Either way, it's beneath you."
- Reference specific fashion moments, seasonal trends, or designer collections to prove your point. "That shade of green appeared in Bottega's resort collection three seasons ago. On the runway. On Gigi. It did not look like this."
- Your advice, when it comes, is always actionable and specific. You just deliver it like it costs you something to say.`,
      temperature: 0.45,
      maxTokens: 500,
    },
    shaft: {
      model: "gpt-4o-mini",
      prompt: `You are John Shaft. Cool is not something you try to be — it's something you are. You walk into a room and the room adjusts. Your style philosophy: if you have to think about whether it looks good, it doesn't.

Your voice: Smooth, confident, economical. You don't over-explain. You state facts. "That shirt fits. Those pants don't. Fix that and you're good." Short sentences land harder.

Rules for your critique:
- Think: Sharp leather jackets, perfectly fitted dark denim, clean boots, a watch that means something, the power of a good overcoat. Shaft's world is timeless menswear with edge.
- Fit is king. You will forgive a lot of style choices if the fit is right. "You can wear almost anything if it fits like it was made for you."
- Never suggest anything fussy or over-accessorized. Shaft's style is clean, intentional, and effortless. "Lose the belt AND the chain. Pick one. Let it say something."
- Focus on: fit, confidence, silhouette, the difference between "dressed up" and "dressed right."
- If something works, you keep it brief: "That's clean." If it doesn't: "Nah. Try again. You're better than this."`,
      temperature: 0.7,
      maxTokens: 500,
    },
  };

  async generateCritique(
    imageBase64: string,
    persona: StylistPersona,
    mode: CritiqueMode = "real",
    userContext?: UserStyleContext,
  ): Promise<string> {
    const personaConfig = this.personas[persona];
    const modeConfig = this.critiqueModes[mode];

    // ── Identity-Based Personalization ──
    let contextInjection = "";
    if (userContext) {
      const level = userContext.xp ? Math.floor(userContext.xp / 100) + 1 : 1;
      const badgeList = userContext.badges?.join(", ") || "none";

      contextInjection = `
USER CONTEXT:
- Style Level: ${level}
- Achievements: ${badgeList}
- Farcaster FID: ${userContext.fid || "Not linked"}
- Celo Native: ${userContext.isCeloUser ? "Yes" : "No"}

ADJUSTMENT: 
${level > 5 ? "The user is a highly experienced fashionista. Use professional terminology and be more nuanced." : "The user is beginning their fashion journey. Be encouraging and focus on fundamentals."}
${userContext.badges?.includes("style-elite") ? 'Acknowledge their "Style Elite" status with a brief nod to their past successes.' : ""}
${userContext.isCeloUser ? 'Since they are a Celo user, you may occasionally mention digital ownership or "Proof of Style" if it fits the critique.' : ""}
`;
    }

    // Enhance the prompt with mode-specific instructions and user context
    const enhancedConfig = {
      ...personaConfig,
      prompt: `${personaConfig.prompt}\n\n${modeConfig.promptModifier}\n\n${contextInjection}`,
      temperature: Math.max(
        0.1,
        Math.min(
          1.0,
          personaConfig.temperature + modeConfig.temperatureAdjustment,
        ),
      ),
    };

    // Check cache first
    const cacheKey = `${persona}_${mode}_${imageBase64.substring(0, 50)}`;
    try {
      const { critiqueModeCache } = await import("../utils/cache");
      const cached = await critiqueModeCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (cacheError) {
      console.warn("Cache check failed:", cacheError);
    }

    try {
      const response = await fetch("/api/ai/personality-critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          persona,
          mode,
          config: enhancedConfig,
          provider: "auto",
        }),
      });

      if (!response.ok) {
        throw new Error(`Personality critique failed: ${response.status}`);
      }

      const data = await response.json();
      const critique =
        data.critique || "Unable to generate critique at this time.";

      // Cache the result
      try {
        const { critiqueModeCache } = await import("../utils/cache");
        await critiqueModeCache.set(cacheKey, critique);
      } catch (cacheError) {
        console.warn("Cache set failed:", cacheError);
      }

      return critique;
    } catch (error) {
      console.error("Personality critique error:", error);
      throw error;
    }
  }

  getCritiqueModeInfo(mode: CritiqueMode) {
    return this.critiqueModes[mode];
  }

  getAllCritiqueModes(): CritiqueMode[] {
    return Object.keys(this.critiqueModes) as CritiqueMode[];
  }

  getPersonalityInfo(persona: StylistPersona) {
    const info = {
      luxury: {
        name: "Luxury Expert",
        description: "High-end fashion connoisseur with impeccable taste",
        icon: "Crown",
        color: "text-yellow-600",
      },
      streetwear: {
        name: "Streetwear Guru",
        description: "Urban fashion expert who knows the latest drops",
        icon: "Zap",
        color: "text-blue-600",
      },
      sustainable: {
        name: "Eco Stylist",
        description: "Sustainable fashion advocate focused on ethical choices",
        icon: "Leaf",
        color: "text-green-600",
      },
      edina: {
        name: "Edina Monsoon",
        description: "Dramatic fashionista from Absolutely Fabulous",
        icon: "Sparkles",
        color: "text-purple-600",
      },
      miranda: {
        name: "Miranda Priestly",
        description: "Ice-cold fashion editor with devastating critique",
        icon: "Star",
        color: "text-red-600",
      },
      shaft: {
        name: "John Shaft",
        description: "Cool, confident style icon with timeless appeal",
        icon: "MessageCircle",
        color: "text-orange-600",
      },
    };

    return info[persona];
  }

  getPersonaPrompt(persona: StylistPersona): string {
    return this.personas[persona]?.prompt || "";
  }
}

export const personalityService = new PersonalityService();
