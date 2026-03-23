"use client";

import React, { useRef, useCallback, useState } from "react";
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
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
  Eye,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { StylistPersona } from "@repo/ai-client";
import type { SessionFeedback } from "./hooks/useLiveSession";
import {
  getScoreTier,
  generateShareText,
  generateFullReportText,
} from "../../lib/utils/score-utils";
import { getPersonaConfig } from "../../lib/utils/persona-config";
import { SocialUtils } from "../../lib/utils/social";

// ── Types ──

interface StyleReportCardProps {
  score: number;
  persona: StylistPersona;
  takeaways: string[];
  topics: string[];
  fullFeedback?: SessionFeedback[];
  captureImage?: string;
  sessionGoal?: string;
  onClose: () => void;
}

const FEEDBACK_TYPE_CONFIG: Record<
  SessionFeedback["type"],
  { icon: React.ElementType; color: string; label: string }
> = {
  praise: { icon: ThumbsUp, color: "text-emerald-400", label: "Praise" },
  critique: { icon: AlertTriangle, color: "text-amber-400", label: "Critique" },
  suggestion: {
    icon: Lightbulb,
    color: "text-indigo-400",
    label: "Suggestion",
  },
  observation: { icon: Eye, color: "text-slate-400", label: "Observation" },
};

// ── Component ──

export function StyleReportCard({
  score,
  persona,
  takeaways,
  topics,
  fullFeedback = [],
  captureImage,
  sessionGoal,
  onClose,
}: StyleReportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showAllTakeaways, setShowAllTakeaways] = useState(false);
  const [showFullFeedback, setShowFullFeedback] = useState(false);

  const personaStyle = getPersonaConfig(persona);
  const PersonaIcon = personaStyle.icon;

  const visibleTakeaways = showAllTakeaways ? takeaways : takeaways.slice(0, 2);
  const hasMoreTakeaways = takeaways.length > 2;

  // ── Generate Full Feedback Text ──
  const handleDownloadFeedback = useCallback(() => {
    const text = generateFullReportText({
      score,
      personaLabel: personaStyle.characterName,
      topics,
      takeaways,
      sessionGoal,
      fullFeedback,
    });
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `onpoint-style-report-${score}-out-of-10.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [score, persona, topics, takeaways, fullFeedback, sessionGoal]);

  // ── Generate Share Text ──
  const handleCopy = useCallback(async () => {
    const text = generateShareText({
      score,
      personaLabel: personaStyle.characterName,
      topics,
      takeaways,
      sessionGoal,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [score, persona, topics, takeaways]);

  // ── Share to Farcaster ──
  const [isSharingFarcaster, setIsSharingFarcaster] = useState(false);

  const handleShareFarcaster = useCallback(async () => {
    setIsSharingFarcaster(true);
    const text = generateShareText({
      score,
      personaLabel: personaStyle.characterName,
      topics,
      takeaways,
    });
    await SocialUtils.shareContent({
      text,
      imageDataUrl: captureImage,
    });
    setIsSharingFarcaster(false);
  }, [score, persona, topics, takeaways, captureImage]);

  // ── Share to Twitter ──
  const handleShareTwitter = useCallback(() => {
    const text = generateShareText({
      score,
      personaLabel: personaStyle.characterName,
      topics,
      takeaways,
    });
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }, [score, persona, topics, takeaways]);

  // ── Download as Image (canvas-based) ──
  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      setIsSharing(true);
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
    const text = generateShareText({
      score,
      personaLabel: personaStyle.characterName,
      topics,
      takeaways,
    });
    if (navigator.share) {
      try {
        await navigator.share({
          title: `OnPoint Style Report — ${score}/10`,
          text,
          url: window.location.href,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  }, [score, persona, topics, takeaways, handleCopy]);

  // ── Escape key handler ──
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Style Report — ${getScoreTier(score)}`}
    >
      <motion.div
        ref={cardRef}
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="relative w-full max-w-sm max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        }}
      >
        {/* Gradient Accent Border */}
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${personaStyle.gradient} opacity-20 blur-xl pointer-events-none`}
        />

        {/* Scrollable Content */}
        <div className="relative z-10 overflow-y-auto no-scrollbar p-6 space-y-5">
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
                <p
                  className={`${personaStyle.accent} text-[10px] font-mono uppercase tracking-widest`}
                >
                  {personaStyle.characterName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] text-amber-400 font-bold">
                OnPoint
              </span>
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
              <div
                className={`absolute -right-6 bottom-3 text-xl font-bold ${personaStyle.accent}`}
              >
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
                {getScoreTier(score)}
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

          {/* Key Takeaways — Progressive Disclosure */}
          {takeaways.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                  Stylist Feedback
                </p>
                {hasMoreTakeaways && (
                  <button
                    onClick={() => setShowAllTakeaways(!showAllTakeaways)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    {showAllTakeaways ? (
                      <>
                        Show less <ChevronUp className="w-3 h-3" />
                      </>
                    ) : (
                      <>
                        +{takeaways.length - 2} more{" "}
                        <ChevronDown className="w-3 h-3" />
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {visibleTakeaways.map((takeaway, i) => {
                  const feedbackItem = fullFeedback.find(
                    (f) => f.text === takeaway,
                  );
                  const typeConfig = feedbackItem
                    ? FEEDBACK_TYPE_CONFIG[feedbackItem.type]
                    : null;
                  const TypeIcon = typeConfig?.icon || Lightbulb;

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white/5 rounded-xl p-3 border border-white/10 flex gap-2.5 items-start"
                    >
                      <TypeIcon
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${typeConfig?.color || "text-indigo-400"}`}
                      />
                      <p className="text-xs text-white/80 leading-relaxed">
                        {takeaway}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Session Feedback — Expandable */}
          {fullFeedback.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowFullFeedback(!showFullFeedback)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-white/40" />
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                    Full Session Log ({fullFeedback.length} entries)
                  </p>
                </div>
                {showFullFeedback ? (
                  <ChevronUp className="w-3.5 h-3.5 text-white/40" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                )}
              </button>

              <AnimatePresence>
                {showFullFeedback && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar pr-1">
                      {fullFeedback.map((feedback, i) => {
                        const config = FEEDBACK_TYPE_CONFIG[feedback.type];
                        const Icon = config.icon;
                        return (
                          <div
                            key={i}
                            className="flex gap-2 items-start p-2 rounded-lg bg-white/[0.03] border border-white/5"
                          >
                            <Icon
                              className={`w-3 h-3 mt-0.5 shrink-0 ${config.color}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-white/60 leading-snug">
                                {feedback.text}
                              </p>
                            </div>
                            <span
                              className={`text-[8px] ${config.color} uppercase tracking-wider shrink-0 mt-0.5`}
                            >
                              {config.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleDownloadFeedback}
                      className="w-full mt-2 text-center text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download Full Feedback
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
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
              onpoint.style &bull; {new Date().toLocaleDateString()}
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
                disabled={isSharingFarcaster}
                className="text-white/60 hover:text-white hover:bg-white/5 rounded-xl text-[10px] flex flex-col gap-1 py-3"
              >
                {isSharingFarcaster ? (
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                {isSharingFarcaster ? "Uploading…" : "Farcaster"}
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
            className="w-full text-center text-[10px] text-white/30 hover:text-white/60 transition-colors pt-2 pb-1"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
