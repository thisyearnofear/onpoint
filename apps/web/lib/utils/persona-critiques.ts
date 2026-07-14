/** Persona critique data — extracted from homepage for reusability. */

import type { CritiqueMode } from "@repo/ai-client";

export const PERSONA_QUOTES: Record<string, string> = {
  miranda: "Passable.",
  edina: "Fabulous!",
  shaft: "Right on.",
  luxury: "Exquisite.",
  streetwear: "Fresh.",
  sustainable: "Thoughtful.",
};

/** Mode-aware critiques per persona — each mode gets 4+ entries for variety */
export const PERSONA_CRITIQUES: Record<string, Record<string, string[]>> = {
  miranda: {
    real: [
      "The silhouette is acceptable, but the palette shows promise. Refine the accessories.",
      "Interesting proportions. The layering works — keep pushing the boundaries.",
      "A solid foundation. Now elevate it with one unexpected detail. The potential is there.",
      "Strong composition. The fit flatters your frame. Consider a bolder silhouette for impact.",
      "Clean lines, intentional palette. This works. Now edit one element for maximum effect.",
    ],
    roast: [
      "Did you dress in the dark? The proportions are at war with each other. Pick a lane.",
      "That hem length suggests you simply don't care. I'd suggest you start.",
      "The palette is screaming. Tell it to use its indoor voice. We can salvage this.",
      "This is... a choice. Not a good one, but a choice nonetheless. Let's rebuild from the shoes up.",
    ],
    flatter: [
      "You clearly understand proportion. The silhouette is working beautifully for you.",
      "There's real intelligence in this composition. You have a natural eye for balance.",
      "The palette is considered and cohesive. This is someone who knows what they're doing.",
      "Strong foundation with room to play. You've earned the right to experiment more.",
    ],
  },
  edina: {
    real: [
      "Darling, this is STUNNING. The colors are singing! Just add more drama!",
      "Oh honey, YES! This turns heads. Now make it louder — MORE IS MORE!",
      "Fabulous doesn't even cover it! The vibe is immaculate. Add sparkle!",
      "You've got the base right, sweetie, but where's the EXCITEMENT? Textures! Layers!",
      "I'm getting there with this look. It needs a STATEMENT piece to push it over the top.",
    ],
    roast: [
      "Sweetie, no. Just... no. This is giving 'I gave up.' And I REFUSE to accept that!",
      "Oh honey. The 80s called and they want their outfit back. Burn it. Start over.",
      "This is a CRIME against fashion, darling! We need an intervention, stat!",
      "Budget. BUDGET, sweetie! This look screams 'I raided a charity bin in the dark.'",
    ],
    flatter: [
      "ABSOLUTELY FABULOUS! You look like a million bucks, darling! MEGA-WOW!",
      "Yes yes YES! This is the energy we need! You are a STYLE ICON in the making!",
      "Darling, you've got IT! That special something! Now let's turn it up to ELEVEN!",
      "I am OBSESSED with this look! The confidence, the attitude, the VISION!",
    ],
  },
  shaft: {
    real: [
      "Clean. Confident. You look like you own the room. Keep it sharp.",
      "That's what I'm talking about. Strong look, strong energy. Stay bold.",
      "Right on. This has swagger written all over it. Wear it like you mean it.",
      "Solid look. The proportions work. Now own it like you knew it would.",
      "Clean execution. The details are right where they should be. Respect.",
    ],
    roast: [
      "Nah. That's not it. You're better than this — try again.",
      "That fit is doing you dirty. Size up, size down, but fix it.",
      "You're trying too hard. Real style doesn't try. It just IS.",
      "Lose the accessories. All of them. You look like you're cosplaying.",
    ],
    flatter: [
      "Now THAT'S what I'm talking about. Clean, sharp, confident. You got it.",
      "Right on. This is a look that says 'I know who I am.' Respect.",
      "Clean. You look like you walked out of a magazine. Keep that energy.",
      "That's how you do it. Strong choices, strong execution. You're on fire.",
    ],
  },
};

export function getCritique(
  persona: string,
  mode: CritiqueMode,
): string {
  const modeCritiques = PERSONA_CRITIQUES[persona]?.[mode];
  const fallbackCritiques = PERSONA_CRITIQUES[persona]?.real;
  const critiquePool = modeCritiques || fallbackCritiques || PERSONA_CRITIQUES.edina!.real!;
  return critiquePool[Math.floor(Math.random() * critiquePool.length)]!;
}
