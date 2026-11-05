/**
 * Static persona theme class maps.
 *
 * Tailwind's scanner only sees literal class names — dynamic interpolation
 * like `bg-${color}/20` never compiles (the old safelist regex existed to
 * paper over this). Every variant used by the session surfaces is spelled
 * out here, keyed by color family, so purge works and colors are auditable.
 *
 * Family values must match the color/accent fields in persona-config.ts:
 * color = <family>-500, accent/text = <family>-400.
 */

export type PersonaColorFamily =
  | "slate"
  | "purple"
  | "orange"
  | "amber"
  | "blue"
  | "emerald";

export interface PersonaThemeClasses {
  /** bg-<c>-500 — solid dots, active buttons */
  bg: string;
  /** bg-<c>-500/5 */
  bg5: string;
  /** bg-<c>-500/10 */
  bg10: string;
  /** bg-<c>-500/20 */
  bg20: string;
  /** bg-<c>-500/40 — faint dot */
  bg40: string;
  /** bg-<c>-400 — accent-colored dot */
  bgAccent: string;
  /** hover:bg-<c>-400 */
  hoverBg: string;
  /** border-<c>-500 — spinner rings (compose with border-t-2 / border-b-2) */
  border: string;
  /** border-<c>-400 — alt spinner ring */
  borderAccent: string;
  /** border-<c>-500/10 */
  border10: string;
  /** border-<c>-500/20 */
  border20: string;
  /** border-<c>-500/30 */
  border30: string;
  /** border-<c>-500/40 */
  border40: string;
  /** text-<c>-400 — persona accent text */
  text: string;
  /** text-<c>-400/60 */
  textDim: string;
  /** text-<c>-400/80 */
  textSoft: string;
  /** text-<c>-400/40 */
  textFaint: string;
  /** text-<c>-500 */
  textColor: string;
  /** from-<c>-500 to-<c>-400 — compose with bg-gradient-to-* */
  gradientPair: string;
  /** from-<c>-500 to-card — compose with bg-gradient-to-br */
  gradientToCard: string;
  /** shadow-<c>-500/20 */
  shadow: string;
}

export const PERSONA_THEME: Record<PersonaColorFamily, PersonaThemeClasses> = {
  slate: {
    bg: "bg-slate-500",
    bg5: "bg-slate-500/5",
    bg10: "bg-slate-500/10",
    bg20: "bg-slate-500/20",
    bg40: "bg-slate-500/40",
    bgAccent: "bg-slate-400",
    hoverBg: "hover:bg-slate-400",
    border: "border-slate-500",
    borderAccent: "border-slate-400",
    border10: "border-slate-500/10",
    border20: "border-slate-500/20",
    border30: "border-slate-500/30",
    border40: "border-slate-500/40",
    text: "text-slate-400",
    textDim: "text-slate-400/60",
    textSoft: "text-slate-400/80",
    textFaint: "text-slate-400/40",
    textColor: "text-slate-500",
    gradientPair: "from-slate-500 to-slate-400",
    gradientToCard: "from-slate-500 to-card",
    shadow: "shadow-slate-500/20",
  },
  purple: {
    bg: "bg-purple-500",
    bg5: "bg-purple-500/5",
    bg10: "bg-purple-500/10",
    bg20: "bg-purple-500/20",
    bg40: "bg-purple-500/40",
    bgAccent: "bg-purple-400",
    hoverBg: "hover:bg-purple-400",
    border: "border-purple-500",
    borderAccent: "border-purple-400",
    border10: "border-purple-500/10",
    border20: "border-purple-500/20",
    border30: "border-purple-500/30",
    border40: "border-purple-500/40",
    text: "text-purple-400",
    textDim: "text-purple-400/60",
    textSoft: "text-purple-400/80",
    textFaint: "text-purple-400/40",
    textColor: "text-purple-500",
    gradientPair: "from-purple-500 to-purple-400",
    gradientToCard: "from-purple-500 to-card",
    shadow: "shadow-purple-500/20",
  },
  orange: {
    bg: "bg-orange-500",
    bg5: "bg-orange-500/5",
    bg10: "bg-orange-500/10",
    bg20: "bg-orange-500/20",
    bg40: "bg-orange-500/40",
    bgAccent: "bg-orange-400",
    hoverBg: "hover:bg-orange-400",
    border: "border-orange-500",
    borderAccent: "border-orange-400",
    border10: "border-orange-500/10",
    border20: "border-orange-500/20",
    border30: "border-orange-500/30",
    border40: "border-orange-500/40",
    text: "text-orange-400",
    textDim: "text-orange-400/60",
    textSoft: "text-orange-400/80",
    textFaint: "text-orange-400/40",
    textColor: "text-orange-500",
    gradientPair: "from-orange-500 to-orange-400",
    gradientToCard: "from-orange-500 to-card",
    shadow: "shadow-orange-500/20",
  },
  amber: {
    bg: "bg-amber-500",
    bg5: "bg-amber-500/5",
    bg10: "bg-amber-500/10",
    bg20: "bg-amber-500/20",
    bg40: "bg-amber-500/40",
    bgAccent: "bg-amber-400",
    hoverBg: "hover:bg-amber-400",
    border: "border-amber-500",
    borderAccent: "border-amber-400",
    border10: "border-amber-500/10",
    border20: "border-amber-500/20",
    border30: "border-amber-500/30",
    border40: "border-amber-500/40",
    text: "text-amber-400",
    textDim: "text-amber-400/60",
    textSoft: "text-amber-400/80",
    textFaint: "text-amber-400/40",
    textColor: "text-amber-500",
    gradientPair: "from-amber-500 to-amber-400",
    gradientToCard: "from-amber-500 to-card",
    shadow: "shadow-amber-500/20",
  },
  blue: {
    bg: "bg-blue-500",
    bg5: "bg-blue-500/5",
    bg10: "bg-blue-500/10",
    bg20: "bg-blue-500/20",
    bg40: "bg-blue-500/40",
    bgAccent: "bg-blue-400",
    hoverBg: "hover:bg-blue-400",
    border: "border-blue-500",
    borderAccent: "border-blue-400",
    border10: "border-blue-500/10",
    border20: "border-blue-500/20",
    border30: "border-blue-500/30",
    border40: "border-blue-500/40",
    text: "text-blue-400",
    textDim: "text-blue-400/60",
    textSoft: "text-blue-400/80",
    textFaint: "text-blue-400/40",
    textColor: "text-blue-500",
    gradientPair: "from-blue-500 to-blue-400",
    gradientToCard: "from-blue-500 to-card",
    shadow: "shadow-blue-500/20",
  },
  emerald: {
    bg: "bg-emerald-500",
    bg5: "bg-emerald-500/5",
    bg10: "bg-emerald-500/10",
    bg20: "bg-emerald-500/20",
    bg40: "bg-emerald-500/40",
    bgAccent: "bg-emerald-400",
    hoverBg: "hover:bg-emerald-400",
    border: "border-emerald-500",
    borderAccent: "border-emerald-400",
    border10: "border-emerald-500/10",
    border20: "border-emerald-500/20",
    border30: "border-emerald-500/30",
    border40: "border-emerald-500/40",
    text: "text-emerald-400",
    textDim: "text-emerald-400/60",
    textSoft: "text-emerald-400/80",
    textFaint: "text-emerald-400/40",
    textColor: "text-emerald-500",
    gradientPair: "from-emerald-500 to-emerald-400",
    gradientToCard: "from-emerald-500 to-card",
    shadow: "shadow-emerald-500/20",
  },
};

const FAMILY_BY_PERSONA: Record<string, PersonaColorFamily> = {
  miranda: "slate",
  edina: "purple",
  shaft: "orange",
  luxury: "amber",
  streetwear: "blue",
  sustainable: "emerald",
};

export function personaThemeClasses(persona: string | null | undefined): PersonaThemeClasses {
  return PERSONA_THEME[FAMILY_BY_PERSONA[persona ?? ""] ?? "slate"];
}
