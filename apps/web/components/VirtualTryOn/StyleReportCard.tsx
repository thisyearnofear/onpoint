"use client";

import React, { useRef, useCallback } from "react";
import { Button } from "@repo/ui/button";
import {
  Sparkles,
  Share2,
  Download,
  Copy,
  CheckCircle,
  Crown,
  Zap,
  Leaf,
  Star,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";
import type { StylistPersona } from "@repo/ai-client";

// ── Types ──

interface StyleReportCardProps {
  score: number;
  persona: StylistPersona;
  takeaways: string[];
  topics: string[];
  captureImage?: string;
  sessionGoal?: string;
  onClose: () => void;
}

// ── Persona Styling Map ──

const PERSONA_STYLES: Record<
  StylistPersona,
  { gradient: string; icon: React.ElementType; label: string; accent: string }
> = {
  luxury: {
    gradient: "from-amber-500 to-yellow-600",
    icon: Crown,
    label: "Anna Karenina",
    accent: "text-amber-400",
  },
  streetwear: {
    gradient: "from-blue-500 to-cyan-600",
    icon: Zap,
    label: "Artful Dodger",
    accent: "text-blue-400",
  },
  sustainable: {
    gradient: "from-emerald-500 to-green-600",
    icon: Leaf,
    label: "Mowgli",
    accent: "text-emerald-400",
  },
  edina: {
    gradient: "from-purple-500 to-pink-600",
    icon: Sparkles,
    label: "Edina Monsoon",
    accent: "text-purple-400",
  },
  miranda: {
    gradient: "from-rose-500 to-red-600",
    icon: Star,
    label: "Miranda Priestly",
    accent: "text-rose-400",
  },
  shaft: {
    gradient: "from-orange-500 to-amber-600",
    icon: MessageCircle,
    label: "John Shaft",
    accent: "text-orange-400",
  },
};

// ── Component ──

export function StyleReportCard({
  score,
  persona,
  takeaways,
  topics,
  captureImage,
  sessionGoal,
  onClose,
}: StyleReportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [isSharing, setIsSharing] = React.useState(false);

  const personaStyle = PERSONA_STYLES[persona] || PERSONA_STYLES.luxury;
  const PersonaIcon = personaStyle.icon;

  // ── Score Rating ──
  const getScoreRating = (s: number): string => {
    if (s >= 9) return "Legendary";
    if (s >= 8) return "Elite";
    if (s >= 7) return "Strong";
    if (s >= 5) return "Solid";
    return "Growing";
  };

  // ── Generate Share Text ──
  const generateShareText = useCallback((): string => {
    const rating = getScoreRating(score);
    const topicStr = topics.slice(0, 3).join(", ");
    const takeaway = takeaways[0] || "Found my perfect look!";
    return `🔥 OnPoint Style Report\n\nScore: ${score}/10 (${rating})\nStylist: ${personaStyle.label}\nFocus: ${topicStr || "Personal Style"}\n\n"${takeaway}"\n\nMinted on Celo via @onpoint`;
  }, [score, persona, topics, takeaways]);

  // ── Copy to Clipboard ──
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generateShareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = generateShareText();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generateShareText]);

  // ── Share to Farcaster ──
  const handleShareFarcaster = useCallback(() => {
    const text = generateShareText();
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }, [generateShareText]);

  // ── Share to Twitter ──
  const handleShareTwitter = useCallback(() => {
    const text = generateShareText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }, [generateShareText]);

  // ── Download as Image (canvas-based) ──
  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      setIsSharing(true);

      // Use html2canvas if available, otherwise fallback to screenshot
      const html2canvas = (window as any).html2canvas;
      if (html2canvas) {
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: "#0f172a",
          scale: 2,
        });
        const link = document.createElement("a");
        link.download = `onpoint-style-report-${score}outof10.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        // Fallback: copy text
        handleCopy();
      }
    } catch (err) {
      console.error("Download failed:", err);
      handleCopy();
    } finally {
      setIsSharing(false);
    }
  }, [score, handleCopy]);

  // ── Native Share (Web Share API) ──
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `OnPoint Style Report — ${score}/10`,
          text: generateShareText(),
          url: window.location.href,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  }, [score, generateShareText, handleCopy]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        ref={cardRef}
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        }}
      >
        {/* Gradient Accent Border */}
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${personaStyle.gradient} opacity-20 blur-xl`}
        />

        {/* Content */}
        <div className="relative z-10 p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${personaStyle.gradient} flex items-center justify-center shadow-lg`}
              >
                <PersonaIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Style Report</h3>
                <p className={`${personaStyle.accent} text-[10px] font-mono uppercase tracking-widest`}>
                  {personaStyle.label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] text-amber-400 font-bold">OnPoint</span>
            </div>
          </div>

          {/* Capture Image */}
          {captureImage && (
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <img
                src={captureImage}
                alt="Style capture"
                className="w-full h-40 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-white/80 font-mono">
                    Proof of Style
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Score */}
          <div className="text-center py-4">
            <div className="relative inline-block">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 100 }}
                className="text-7xl font-black text-white italic tracking-tighter tabular-nums drop-shadow-2xl"
              >
                {score}
              </motion.div>
              <div className={`absolute -right-6 bottom-3 text-xl font-bold ${personaStyle.accent}`}>
                /10
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 inline-block"
            >
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                {getScoreRating(score)} Persona
              </span>
            </motion.div>
          </div>

          {/* Topics */}
          {topics.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                Analysis Focus
              </p>
              <div className="flex flex-wrap gap-2">
                {topics.slice(0, 4).map((topic, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/70"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Takeaway */}
          {takeaways.length > 0 && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-sm text-white/90 leading-relaxed italic">
                "{takeaways[0]}"
              </p>
            </div>
          )}

          {/* Session Goal Badge */}
          {sessionGoal && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-[10px] text-indigo-300 font-medium">
                Goal: {sessionGoal}
              </span>
            </div>
          )}

          {/* QR / Link Hint */}
          <div className="text-center">
            <p className="text-[9px] text-white/30 font-mono">
              onpoint.style • {new Date().toLocaleDateString()}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            {/* Primary Share */}
            <Button
              onClick={handleNativeShare}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full py-5 text-sm font-bold shadow-lg shadow-indigo-500/20"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Style Report
            </Button>

            {/* Secondary Actions */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShareFarcaster}
                className="text-white/60 hover:text-white hover:bg-white/5 rounded-xl text-[10px] flex flex-col gap-1 py-3"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Warpcast
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShareTwitter}
                className="text-white/60 hover:text-white hover:bg-white/5 rounded-xl text-[10px] flex flex-col gap-1 py-3"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Twitter
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={isSharing}
                className="text-white/60 hover:text-white hover:bg-white/5 rounded-xl text-[10px] flex flex-col gap-1 py-3"
              >
                {isSharing ? (
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Save
              </Button>
            </div>

            {/* Copy Text */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="w-full text-white/40 hover:text-white hover:bg-white/5 rounded-xl text-[10px]"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1.5 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1.5" />
                  Copy as text
                </>
              )}
            </Button>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-full text-center text-[10px] text-white/30 hover:text-white/60 transition-colors pt-2"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}