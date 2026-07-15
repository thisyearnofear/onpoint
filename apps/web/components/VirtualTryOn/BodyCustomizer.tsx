"use client";

import { User, Ruler, Sparkles } from "lucide-react";

/**
 * Body customization for selfie-mode try-on.
 * Lets users build a virtual body profile from diverse, inclusive options.
 * The selections are combined into a personDescription string that feeds
 * the Venice SD35 text-to-image generator.
 */

export type BodyProfile = {
  bodyType: string;
  height: string;
  build: string;
  skinTone: string;
};

export const DEFAULT_BODY_PROFILE: BodyProfile = {
  bodyType: "average",
  height: "average",
  build: "regular",
  skinTone: "medium",
};

const BODY_TYPES = [
  { value: "slim", label: "Slim", desc: "Lean, narrow frame" },
  { value: "average", label: "Average", desc: "Balanced proportions" },
  { value: "athletic", label: "Athletic", desc: "Toned, muscular" },
  { value: "curvy", label: "Curvy", desc: "Fuller hips and bust" },
  { value: "plus-size", label: "Plus-size", desc: "Fuller figure" },
];

const HEIGHTS = [
  { value: "petite", label: "Petite", desc: "Under 5'3\" / 160cm" },
  { value: "average", label: "Average", desc: "5'3\"–5'9\" / 160–175cm" },
  { value: "tall", label: "Tall", desc: "Over 5'9\" / 175cm" },
];

const BUILDS = [
  { value: "regular", label: "Regular", desc: "Standard fit" },
  { value: "broad", label: "Broad", desc: "Wider shoulders" },
  { value: "narrow", label: "Narrow", desc: "Slimmer frame" },
];

// Inclusive skin tone range — names are descriptive, not racialized
const SKIN_TONES = [
  { value: "deep", label: "Deep", desc: "Rich dark skin", promptHint: "deep dark skin" },
  { value: "dark", label: "Dark", desc: "Dark brown skin", promptHint: "dark brown skin" },
  { value: "medium", label: "Medium", desc: "Medium brown skin", promptHint: "medium brown skin" },
  { value: "tan", label: "Tan", desc: "Warm tan skin", promptHint: "tan warm skin" },
  { value: "light", label: "Light", desc: "Light skin", promptHint: "light skin" },
  { value: "fair", label: "Fair", desc: "Very fair skin", promptHint: "fair pale skin" },
];

/**
 * Convert a body profile into a text description for the AI image generator.
 * This feeds into the personDescription field of the try-on API.
 */
export function bodyProfileToDescription(profile: BodyProfile): string {
  const bodyType = BODY_TYPES.find((b) => b.value === profile.bodyType)?.label || "Average";
  const height = HEIGHTS.find((h) => h.value === profile.height)?.label || "Average";
  const build = BUILDS.find((b) => b.value === profile.build)?.label || "Regular";
  const skinTone = SKIN_TONES.find((s) => s.value === profile.skinTone)?.promptHint || "medium brown skin";

  return [
    `Body type: ${bodyType.toLowerCase()}`,
    `Height: ${height.toLowerCase()}`,
    `Build: ${build.toLowerCase()}`,
    `Skin tone: ${skinTone}`,
  ].join("\n");
}

interface OptionCardProps {
  label: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}

function OptionCard({ label, desc, selected, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-2.5 transition-all ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/30"
      }`}
    >
      <p className="text-xs font-bold">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}

interface BodyCustomizerProps {
  profile: BodyProfile;
  onChange: (profile: BodyProfile) => void;
}

export function BodyCustomizer({ profile, onChange }: BodyCustomizerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Sparkles className="h-4 w-4 text-primary" />
        Build your virtual body
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Your selfie gives us your face and skin tone. Pick a body to see the full look.
      </p>

      {/* Skin tone */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Skin tone</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {SKIN_TONES.map((tone) => (
            <button
              key={tone.value}
              type="button"
              onClick={() => onChange({ ...profile, skinTone: tone.value })}
              className={`group flex flex-col items-center gap-1 transition-all`}
              title={tone.desc}
            >
              <span
                className={`h-9 w-9 rounded-full border-2 transition-all ${
                  profile.skinTone === tone.value
                    ? "border-primary ring-2 ring-primary/20 scale-110"
                    : "border-border hover:border-primary/40"
                }`}
                style={{
                  background: {
                    deep: "#3d2817",
                    dark: "#5c3d22",
                    medium: "#8b5e3c",
                    tan: "#c68642",
                    light: "#e8c4a0",
                    fair: "#f5dccc",
                  }[tone.value] || "#8b5e3c",
                }}
              />
              <span className={`text-[9px] ${profile.skinTone === tone.value ? "font-bold text-primary" : "text-muted-foreground"}`}>
                {tone.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Body type */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Body type</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {BODY_TYPES.map((bt) => (
            <OptionCard
              key={bt.value}
              label={bt.label}
              desc={bt.desc}
              selected={profile.bodyType === bt.value}
              onClick={() => onChange({ ...profile, bodyType: bt.value })}
            />
          ))}
        </div>
      </div>

      {/* Height + Build */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-medium">Height</span>
          </div>
          <div className="space-y-1.5">
            {HEIGHTS.map((h) => (
              <OptionCard
                key={h.value}
                label={h.label}
                desc={h.desc}
                selected={profile.height === h.value}
                onClick={() => onChange({ ...profile, height: h.value })}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-medium">Build</span>
          </div>
          <div className="space-y-1.5">
            {BUILDS.map((b) => (
              <OptionCard
                key={b.value}
                label={b.label}
                desc={b.desc}
                selected={profile.build === b.value}
                onClick={() => onChange({ ...profile, build: b.value })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
