"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import {
  Bookmark,
  Sparkles,
  Send,
  CheckCircle,
  ShoppingBag,
  ArrowRight,
  Palette,
  RefreshCw,
  Shirt,
} from "lucide-react";
import { storefrontDoor } from "../../lib/utils/get-it";
import {
  newShareId,
  withShareParams,
  type ShareChannel,
} from "../../lib/utils/share-attribution";
import {
  trackStylingTipVariantClicked,
  trackResultCompareToggled,
  trackLookSaved,
} from "../../lib/utils/analytics";
import { useAnalysisHistory } from "../../lib/stores/analysis-history-store";
import { SafeImage } from "../SafeImage";

interface StructuredTipAction {
  type: string;
  label: string;
  payload: string;
}

interface StructuredTip {
  text: string;
  action?: StructuredTipAction;
}

interface SimilarPhysicalItem {
  listingId: string;
  curatorSlug: string;
  curatorName: string;
  title: string;
  imageUrl: string | null;
  orderUrl: string;
  storefrontUrl: string;
}

interface TryOnResultProps {
  result:
    | {
        id: string;
        image: string;
        description?: string;
        stylingTips?: string[];
        structuredTips?: StructuredTip[];
        providerLabel?: string;
        timestamp?: number;
      }
    | string; // Keep backward compatibility
  loading?: boolean;
  originalPhotoUrl?: string;
  onVariantFromTip?: (args: { tip: string; payload?: string }) => void;
  /** Same garment, another take. */
  onRetry?: () => void;
  /** Back to the picker — the row's "Try it on". */
  onChangeGarment?: () => void;
  /** Similar physical items from human curators (digital→physical funnel) */
  similarPhysicalItems?: SimilarPhysicalItem[];
  /** The listing this render is of — what "Get it" buys and "Send it" invites on. */
  sourceListing?: { curatorSlug?: string | null; listingId?: string | null } | null;
}

// Utility function to parse simple markdown bold text
function parseMarkdownBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-primary">
          {boldText}
        </strong>
      );
    }
    return part;
  });
}

const PROGRESS_STAGES = [
  "Analyzing body proportions…",
  "Matching garment drape & fit…",
  "Rendering final look…",
  "Adding finishing touches…",
];

function StagedProgress() {
  const [stage, setStage] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (stage >= PROGRESS_STAGES.length - 1) return;
    const delay = 8000 + Math.random() * 4000; // 8-12s per stage
    const timer = setTimeout(() => setStage((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [stage]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
        <p className="text-sm font-medium text-primary mb-2 transition-all duration-500">
          {PROGRESS_STAGES[stage]}
        </p>
        <div className="flex items-center justify-center gap-1.5 mb-1">
          {PROGRESS_STAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i <= stage ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This typically takes 30–60 seconds
        </p>
      </div>
    </div>
  );
}

export function TryOnResult({
  result,
  loading = false,
  originalPhotoUrl,
  onVariantFromTip,
  onRetry,
  onChangeGarment,
  similarPhysicalItems,
  sourceListing,
}: TryOnResultProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const compareStartRef = useRef<number | null>(null);

  // Map action type to icon
  const actionIcon = (type: string) => {
    switch (type) {
      case "color_change":
        return <Palette className="h-3.5 w-3.5" />;
      case "garment_swap":
        return <Shirt className="h-3.5 w-3.5" />;
      default:
        return <RefreshCw className="h-3.5 w-3.5" />;
    }
  };

  // Handle both string and object formats
  const resultData = typeof result === "string" ? { image: result } : result;
  const { image, description, stylingTips, structuredTips, providerLabel } = resultData as {
    image: string;
    description?: string;
    stylingTips?: string[];
    structuredTips?: StructuredTip[];
    providerLabel?: string;
  };
  const imageSrc = image
    ? image.startsWith("data:") || image.startsWith("http")
      ? image
      : `data:image/webp;base64,${image}`
    : "";
  const isApproximation = !loading && Boolean(imageSrc) && !(
    providerLabel?.toLowerCase().includes("image-conditioned") ||
    providerLabel?.toLowerCase().includes("actual garment")
  );

  // Merge structured tips into a lookup for fast access when rendering plain tips
  const structuredByTip = React.useMemo(() => {
    const map = new Map<string, StructuredTip>();
    (structuredTips || []).forEach((tip) => map.set(tip.text, tip));
    return map;
  }, [structuredTips]);

  const { addSession } = useAnalysisHistory();

  // What this render is of: the storefront listing it came from, or — for a
  // digital design, which has no stock — the first physical equivalent the API
  // matched. Both the buy door and the invite are built from that, so the CTA
  // can never promise an item this result doesn't have.
  const buyTarget = sourceListing?.listingId
    ? sourceListing
    : (similarPhysicalItems?.[0] ?? null);
  const getIt = storefrontDoor(buyTarget);
  const sendTarget =
    buyTarget?.curatorSlug && buyTarget?.listingId ? buyTarget : null;

  const handleSaveLook = useCallback(() => {
    if (saved) return;
    addSession({
      score: 7,
      sessionGoal: null,
      persona: null,
      headline: description || 'Virtual try-on result',
      takeaways: stylingTips || [],
      topics: [],
      coverImage: imageSrc || null,
      extraImages: [],
      recommendations: [],
    });
    setSaved(true);
    trackLookSaved({
      score: 7,
      persona: null,
      hasImage: Boolean(imageSrc),
      source: "try_on_result",
    });
  }, [saved, description, stylingTips, imageSrc, addSession]);

  const handleSend = async () => {
    if (!sendTarget?.curatorSlug || !sendTarget.listingId) return;
    setSending(true);
    let inviteUrl: string | null = null;
    try {
      const res = await fetch("/api/try-on/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curatorSlug: sendTarget.curatorSlug,
          listingId: sendTarget.listingId,
          note: description ? description.slice(0, 280) : undefined,
        }),
      });
      if (res.ok) inviteUrl = ((await res.json())?.inviteUrl as string) ?? null;
    } catch {
      inviteUrl = null;
    }
    setSending(false);
    if (!inviteUrl) {
      setSendFailed(true);
      return;
    }

    // One id per send, so the link can be followed to the recipient's try-on and
    // order. The token route signs it; nothing here is stored on this device.
    const sid = newShareId();
    const channel: ShareChannel = typeof navigator.share === "function" ? "native" : "copy";
    const url = withShareParams(inviteUrl, sid, channel);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Try this on — I picked it for you",
          text: description || "See it on you before you buy it.",
          url,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setSendFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setSendFailed(true);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5" />
          Virtual Try-On Result
        </CardTitle>
        <p className="text-sm text-muted-foreground text-center">
          Your personalized virtual try-on visualization
        </p>
        {providerLabel && (
          <div className="mx-auto mt-2 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            {providerLabel}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative aspect-[3/4] max-h-96 rounded-lg overflow-hidden bg-muted mx-auto">
            {loading ? (
              <StagedProgress />
            ) : image ? (
              <>
                <SafeImage
                  sources={[
                    showOriginal && originalPhotoUrl ? originalPhotoUrl : imageSrc,
                  ]}
                  alt={
                    showOriginal ? "Original photo" : "Virtual try-on result"
                  }
                  fill
                  unoptimized
                  className="object-cover transition-opacity duration-300"
                />
                {isApproximation && (
                  <div className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-300 backdrop-blur-sm">
                    AI Similar-Look Preview
                  </div>
                )}
                {originalPhotoUrl && (
                  <button
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium bg-black/60 text-white rounded-full px-3 py-1 backdrop-blur-sm hover:bg-black/80 transition-colors select-none"
                    onMouseDown={() => {
                      compareStartRef.current = Date.now();
                      setShowOriginal(true);
                    }}
                    onMouseUp={() => {
                      setShowOriginal(false);
                      if (compareStartRef.current) {
                        trackResultCompareToggled({
                          duration_ms: Date.now() - compareStartRef.current,
                        });
                      }
                      compareStartRef.current = null;
                    }}
                    onMouseLeave={() => {
                      setShowOriginal(false);
                      if (compareStartRef.current) {
                        trackResultCompareToggled({
                          duration_ms: Date.now() - compareStartRef.current,
                        });
                      }
                      compareStartRef.current = null;
                    }}
                    onTouchStart={() => {
                      compareStartRef.current = Date.now();
                      setShowOriginal(true);
                    }}
                    onTouchEnd={() => {
                      setShowOriginal(false);
                      if (compareStartRef.current) {
                        trackResultCompareToggled({
                          duration_ms: Date.now() - compareStartRef.current,
                        });
                      }
                      compareStartRef.current = null;
                    }}
                  >
                    {showOriginal ? "Original" : "Hold to compare"}
                  </button>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    Processing your try-on...
                  </p>
                </div>
              </div>
            )}
          </div>

          {description && (
            <div className="text-center">
              <p className="text-sm font-medium text-center">
                Generated Outfit
              </p>
              <p className="text-sm text-muted-foreground text-center">
                {description}
              </p>
            </div>
          )}

          {stylingTips && stylingTips.length > 0 && (
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium text-center">Styling Tips:</p>
              <ul className="text-sm text-muted-foreground space-y-2.5 inline-block text-left">
                {stylingTips.map((tip, index) => {
                  const structured = structuredByTip.get(tip);
                  const hasAction = structured?.action && onVariantFromTip;
                  return (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1 flex-shrink-0">•</span>
                      <span className="flex-1">{parseMarkdownBold(tip)}</span>
                      {hasAction && (
                        <button
                          onClick={() => {
                            trackStylingTipVariantClicked({
                              tip_index: index,
                              tip_text: tip,
                              has_custom_action: true,
                              action_type: structured.action!.type,
                            });
                            onVariantFromTip!({
                              tip,
                              payload: structured.action!.payload,
                            });
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 rounded-full px-2.5 py-0.5 hover:bg-primary/10 transition-colors whitespace-nowrap flex-shrink-0 mt-0.5"
                        >
                          {actionIcon(structured.action!.type)}
                          {structured.action!.label}
                        </button>
                      )}
                      {!hasAction && onVariantFromTip && (
                        <button
                          onClick={() => {
                            trackStylingTipVariantClicked({
                              tip_index: index,
                              tip_text: tip,
                              has_custom_action: false,
                            });
                            onVariantFromTip({ tip });
                          }}
                          className="flex items-center gap-0.5 text-xs text-primary hover:underline whitespace-nowrap flex-shrink-0 mt-0.5"
                        >
                          Try variant <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* The next loop, in order — buy it, try something else on, keep it,
              hand it to someone. Never a dead end. */}
          {!loading && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button variant="outline" asChild className="text-xs">
                <a href={getIt.href}>
                  <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                  {getIt.label}
                </a>
              </Button>
              {onChangeGarment && (
                <Button variant="outline" onClick={onChangeGarment} className="text-xs">
                  <Shirt className="h-3.5 w-3.5 mr-1" />
                  Try it on
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleSaveLook}
                disabled={saved}
                className={`text-xs ${saved ? "border-success/30 text-success" : ""}`}
              >
                {saved ? (
                  <><Bookmark className="h-3.5 w-3.5 mr-1 fill-current" /> Saved</>
                ) : (
                  <><Bookmark className="h-3.5 w-3.5 mr-1" /> Save</>
                )}
              </Button>
              {sendTarget && (
                <Button
                  onClick={() => void handleSend()}
                  loading={sending}
                  className="text-xs"
                >
                  {copied ? (
                    <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Link copied</>
                  ) : (
                    <><Send className="h-3.5 w-3.5 mr-1" /> {sending ? "Minting…" : "Send it"}</>
                  )}
                </Button>
              )}
            </div>
          )}
          {sendFailed && (
            <p className="text-xs text-error">
              That invite didn&apos;t mint — the link is what failed, not your photo.
              Try once more, or screenshot the look.
            </p>
          )}

          {/* Same garment, same photo, another take. */}
          {onRetry && (
            <Button
              variant="ghost"
              className="w-full text-primary hover:bg-primary/10"
              onClick={onRetry}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          )}

          {/* Digital→Physical funnel: similar physical items from human curators */}
          {similarPhysicalItems && similarPhysicalItems.length > 0 && (
            <div className="w-full mt-2">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold">Shop the real thing</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                This was a digital design. Here are similar physical items from
                human curators you can order now.
              </p>
              <div className="grid gap-2">
                {similarPhysicalItems.map((item) => (
                  <a
                    key={item.listingId}
                    href={`/s/${item.curatorSlug}?item=${item.listingId}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-all hover:border-primary/40 hover:bg-muted/30"
                  >
                    {item.imageUrl && (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
                        <SafeImage
                          sources={[item.imageUrl]}
                          alt={item.title}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        by {item.curatorName}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* AI Model Transparency Label */}
          <div className="text-xs text-gray-500 text-center mt-3 flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3" />
            <span>
              {isApproximation
                ? "Style inspiration only — this is an AI-generated preview, not the actual garment. Fabric, print, and fit may differ."
                : providerLabel || "AI generated visualization"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
