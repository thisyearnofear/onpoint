import Link from "next/link";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SafeImage } from "./SafeImage";

// ── Types ────────────────────────────────────────────

interface ArchetypeConfig {
  slug: string;
  name: string;
  avatar: string;
  type: string;
  verticals: string[];
  brand?: {
    colors?: { primary?: string; accent?: string };
    location?: { city?: string; landmark?: string };
  };
  channels?: { whatsapp?: string; instagram?: string };
}

interface ArchetypeMeta {
  title: string;
  emoji: string;
  description: string;
}

// Archetype display metadata (kept in code, not duplicated in JSON)
const ARCHETYPE_META: Record<string, ArchetypeMeta> = {
  "mo": {
    title: "Sportswear Stylist",
    emoji: "⚽",
    description: "Football kits, athletic gear, Premier League jerseys",
  },
  "zara": {
    title: "Streetwear Curator",
    emoji: "👟",
    description: "Sneakers, drops, streetwear staples, retro fits",
  },
  "amara": {
    title: "Ankara & African Print",
    emoji: "🧵",
    description: "Ankara, Kente, Kitenge, occasion wear, custom pieces",
  },
  "juma": {
    title: "Vintage & Thrift",
    emoji: "📻",
    description: "One-of-a-kind vintage, thrift finds, deadstock",
  },
  "fatima": {
    title: "Tailor & Formalwear",
    emoji: "✂️",
    description: "Bespoke suits, kaftans, agbadas, formal wear",
  },
  "grace": {
    title: "Luxury & Premium",
    emoji: "💎",
    description: "Designer pieces, luxury resale, premium accessories",
  },
};

// ── Load configs ─────────────────────────────────────

function loadArchetypes(): ArchetypeConfig[] {
  const configDir = join(process.cwd(), "apps", "web", "config", "curators");
  try {
    const files = readdirSync(configDir).filter((f) => f.endsWith(".json"));
    return files
      .map((file) => {
        const raw = readFileSync(join(configDir, file), "utf-8");
        return JSON.parse(raw) as ArchetypeConfig;
      })
      .filter((c) => c.avatar); // only those with avatars
  } catch {
    return [];
  }
}

// ── Avatar fallback ──────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

// ── Component ────────────────────────────────────────

export default async function ArchetypeAvatarPreview() {
  const archetypes = loadArchetypes();

  if (archetypes.length === 0) {
    return null; // silently hide if configs aren't available
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-sm">
            🎭
          </div>
          <div>
            <h2 className="font-bold">Curator archetype avatars</h2>
            <p className="text-xs text-muted-foreground">
              {archetypes.length} seedable profiles for onboarding new curators
            </p>
          </div>
        </div>
        <Link
          href="/curator/onboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          Onboard new →
        </Link>
      </div>

      {/* Avatar grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {archetypes.map((archetype) => {
          const meta = ARCHETYPE_META[archetype.slug];
          const primary = archetype.brand?.colors?.primary ?? "#6366f1";
          const accent = archetype.brand?.colors?.accent ?? "#4f46e5";

          return (
            <div
              key={archetype.slug}
              className="group relative overflow-hidden rounded-xl border border-border bg-background p-3 text-center transition-all hover:shadow-md"
            >
              {/* Gradient accent bar */}
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{
                  background: `linear-gradient(90deg, ${primary}, ${accent})`,
                }}
              />

              {/* Avatar */}
              <div className="relative mx-auto mt-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted">
                <SafeImage
                  sources={[archetype.avatar]}
                  alt={archetype.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>

              {/* Name & title */}
              <p className="mt-3 text-sm font-bold">{archetype.name}</p>
              <p className="text-xs text-muted-foreground">
                {meta?.emoji} {meta?.title ?? archetype.verticals[0]}
              </p>

              {/* Vertical tags */}
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {archetype.verticals.slice(0, 2).map((v) => (
                  <span
                    key={v}
                    className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground"
                  >
                    {v.replaceAll("-", " ")}
                  </span>
                ))}
              </div>

              {/* Hover detail */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-background/95 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                <span className="text-2xl">{meta?.emoji}</span>
                <p className="px-2 text-center text-[11px] leading-tight text-muted-foreground">
                  {meta?.description}
                </p>
                <span
                  className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{ background: primary }}
                >
                  {archetype.brand?.location?.city ?? "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
