import { ImageResponse } from "next/og";
import { getApiBase } from "../../../lib/utils/api-base";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface StorefrontData {
  curator: {
    name: string;
    type: "human" | "ai";
    verticals: string[];
    brand?: {
      colors?: { primary?: string; accent?: string };
      location?: { city: string; landmark?: string };
    };
  };
  meta: {
    listingCount: number;
  };
}

async function loadStorefront(slug: string): Promise<StorefrontData | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/curator/${encodeURIComponent(slug)}/storefront`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadStorefront(slug);

  if (!data) {
    // Generic fallback
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #111827, #1e1b4b)",
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1 }}>
            OnPoint
          </div>
          <div style={{ fontSize: 20, opacity: 0.6, marginTop: 8 }}>
            Curator not found
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const { curator, meta } = data;
  const primary = curator.brand?.colors?.primary || "#111827";
  const accent = curator.brand?.colors?.accent || "#e94560";
  const city = curator.brand?.location?.city;
  const verticals = curator.verticals ?? [];
  const isAI = curator.type === "ai";

  // Get initials for avatar circle
  const initials = curator.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${primary}, ${primary}dd, ${accent}88)`,
          color: "white",
          fontFamily: "sans-serif",
          padding: 60,
          position: "relative",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {initials}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, opacity: 0.9 }}>
              {isAI ? "AI Curator" : "Curator"} Storefront
            </div>
          </div>
          <div style={{ fontSize: 14, opacity: 0.6, fontWeight: 600 }}>
            OnPoint
          </div>
        </div>

        {/* Center — name and tagline */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1 }}>
            {curator.name}
          </div>
          {city && (
            <div style={{ fontSize: 22, opacity: 0.7, marginTop: 12 }}>
              {city}
            </div>
          )}
        </div>

        {/* Bottom — stats and verticals */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.15)",
            paddingTop: 24,
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            {verticals.slice(0, 4).map((v) => (
              <div
                key={v}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.15)",
                  textTransform: "capitalize",
                }}
              >
                {v}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.8 }}>
            {meta.listingCount} live listing{meta.listingCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
