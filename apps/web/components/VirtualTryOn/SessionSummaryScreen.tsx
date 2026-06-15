"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import { Sparkles, CheckCircle, Eye, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MintLookButton } from "./MintLookButton";
import { AgentStatus } from "../Agent/AgentStatus";
import { AgentActionCard } from "../Agent/AgentActionCard";
import { AgentPermissionDashboard } from "../Agent/AgentPermissionDashboard";
import { TipSheet } from "../Agent/TipModal";
import { AgentApprovalModal } from "../Agent/AgentApprovalModal";
import type { ApprovalRequest } from "../Agent/AgentApprovalModal";
import { SuggestionHistoryPanel } from "../Agent/SuggestionHistoryPanel";
import type { AgentSuggestion } from "../Agent/AgentSuggestionToast";
import { StyleReportCard } from "./StyleReportCard";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import type { StylistPersona } from "@repo/ai-client";
import { generateShareText } from "../../lib/utils/score-utils";
import { SocialUtils } from "../../lib/utils/social";
import { AnimatedScore } from "./AnimatedScore";
import type {
  SessionSummary,
  CaptureOption,
  SessionFeedback,
} from "./hooks/useLiveSession";
import type { PersonaConfig } from "../../lib/utils/persona-config";

interface SessionSummaryScreenProps {
  sessionSummary: SessionSummary;
  personaStyling: PersonaConfig;
  selectedPersona: string | null;
  onBack: () => void;
  hasCaptures: boolean;
  captures: CaptureOption[];
  selectedCaptureIndex: number | null;
  onSelectCapture: (i: number | null) => void;
  selectedCapture: CaptureOption | null;
  suggestions: AgentSuggestion[];
  finalAdvice: string;
  sessionGoal: string | null;
  isApprovalModalOpen: boolean;
  currentApproval: ApprovalRequest | null;
  onApprove: () => void;
  onReject: () => void;
  showStyleReport: boolean;
  onSetShowStyleReport: (v: boolean) => void;
  showTipModal: boolean;
  onSetShowTipModal: (v: boolean) => void;
  /** Whether this screen renders from a live session or a rehydrated history record. */
  source?: "live" | "history";
}

export function SessionSummaryScreen({
  sessionSummary,
  personaStyling,
  selectedPersona,
  onBack,
  hasCaptures,
  captures,
  selectedCaptureIndex,
  onSelectCapture,
  selectedCapture,
  suggestions,
  finalAdvice,
  sessionGoal,
  isApprovalModalOpen,
  currentApproval,
  onApprove,
  onReject,
  showStyleReport,
  onSetShowStyleReport,
  showTipModal,
  onSetShowTipModal,
  source = "live",
}: SessionSummaryScreenProps) {
  const isReadOnly = source === "history";
  const PersonaIcon = personaStyling.icon;

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto pb-20">
      {/* Header */}
      <div
        className={`p-6 flex items-center justify-between border-b border-${personaStyling.color}/20 bg-card/80 backdrop-blur-md sticky top-0 z-50`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full bg-${personaStyling.color}/20 flex items-center justify-center border border-${personaStyling.color}/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]`}
          >
            <PersonaIcon
              className={`w-5 h-5 text-${personaStyling.accent}`}
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Session Summary
            </h1>
            <p
              className={`text-[10px] text-${personaStyling.text}/60 uppercase tracking-widest font-mono`}
            >
              Proof of Style Verified
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-foreground bg-muted/30 hover:bg-muted rounded-full"
          onClick={onBack}
        >
          Done
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Style Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-${personaStyling.color} to-card p-6 sm:p-8 shadow-2xl shadow-${personaStyling.color}/20`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-16 -mt-16" />
          <div className="relative z-10">
            <div className="flex items-center gap-6">
              {/* Score — compact with animation */}
              <div className="flex flex-col items-center shrink-0">
                <AnimatedScore
                  score={sessionSummary.score}
                  delay={0.2}
                  size="md"
                />
                <p className="mt-2 text-[9px] uppercase tracking-widest text-muted-foreground">
                  {Math.round(sessionSummary.scoreConfidence * 100)}%
                  {" "}
                  {sessionSummary.scoreSource === "model"
                    ? "AI confidence"
                    : "derived confidence"}
                </p>
              </div>

              {/* Adjacent takeaway */}
              {sessionSummary.takeaways.length > 0 && (
                <div className="flex-1 min-w-0 border-l border-border pl-5">
                  <p
                    className={`text-[9px] text-${personaStyling.text}/60 uppercase tracking-widest mb-1.5 font-bold`}
                  >
                    Top Insight
                  </p>
                  <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                    &ldquo;{sessionSummary.takeaways[0]}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Key Takeaways */}
        <div className="space-y-4">
          <h2 className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-1 flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            AI Stylist Insights
          </h2>
          {sessionSummary.takeaways.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {sessionSummary.takeaways.map((takeaway, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`bg-card border border-${personaStyling.color}/20 p-4 rounded-2xl flex gap-3 items-start`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg bg-${personaStyling.color}/10 flex items-center justify-center shrink-0 mt-0.5`}
                  >
                    <CheckCircle
                      className={`w-3.5 h-3.5 text-${personaStyling.accent}`}
                    />
                  </div>
                  <p className="text-sm text-foreground/80 leading-snug">
                    {takeaway}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No specific insights captured this session.
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                Try a longer session for deeper analysis.
              </p>
            </div>
          )}
        </div>

        {/* Analyzed Topics */}
        {sessionSummary.topics.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-1">
              Style Analysis Focus
            </h2>
            <div className="flex flex-wrap gap-2">
              {sessionSummary.topics.map((topic, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded-xl bg-${personaStyling.color}/5 border border-${personaStyling.color}/10 flex items-center gap-2`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full bg-${personaStyling.color}/40`}
                  />
                  <span
                    className={`text-xs text-${personaStyling.accent}/80`}
                  >
                    {topic}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score Evidence */}
        {sessionSummary.scoreEvidence.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h2 className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-1 flex items-center gap-2">
              <Eye className="w-3 h-3" />
              Score Evidence
            </h2>
            <div className="space-y-2">
              {sessionSummary.scoreEvidence.map((evidence, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-card border border-border"
                >
                  <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {evidence}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground/70 px-1">
              {sessionSummary.scoreSource === "model"
                ? "Evidence extracted from AI analysis"
                : "Derived from session sentiment"}
              {" · "}
              {Math.round(sessionSummary.scoreConfidence * 100)}% confidence
            </p>
          </motion.div>
        )}

        {/* Photo Gallery */}
        {hasCaptures && (
          <div className="space-y-4">
            <h2 className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-1">
              Proof of Style Artifacts
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 no-scrollbar">
              {captures.map((cap, i) => (
                <motion.div
                  key={i}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelectCapture(i)}
                  className={`relative w-40 h-56 rounded-2xl overflow-hidden shrink-0 transition-all border-2 ${
                    selectedCaptureIndex === i
                      ? "border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                      : "border-border grayscale-[0.8] opacity-60"
                  }`}
                >
                  <img
                    src={cap.image}
                    alt={`Style capture ${i + 1} of ${captures.length}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                    <p className="text-[10px] text-white/50 font-mono">
                      0x{cap.image.slice(22, 28)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-4">
          {!isReadOnly && <SuggestionHistoryPanel suggestions={suggestions} />}

          {/* Style Report Card Button */}
          <Button
            className={`w-full bg-gradient-to-r from-${personaStyling.color} to-${personaStyling.accent} hover:opacity-90 text-white rounded-full py-5 text-sm font-bold shadow-lg shadow-${personaStyling.color}/20 gap-2`}
            onClick={() => onSetShowStyleReport(true)}
          >
            <Sparkles className="w-4 h-4" />
            View Style Report
          </Button>

          {/* Shop CTA — save analysis to sessionStorage and navigate */}
          <Button
            variant="outline"
            className="w-full rounded-full py-5 text-sm font-bold gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.setItem(
                  "stylistAnalysis",
                  JSON.stringify({
                    bodyType: "analyzed",
                    styleRecommendations: sessionSummary.takeaways,
                    curationContext: {
                      score: sessionSummary.score,
                      takeaways: sessionSummary.takeaways,
                      topics: sessionSummary.topics,
                      recommendations: sessionSummary.recommendations || [],
                      persona: selectedPersona,
                      sessionGoal: sessionGoal,
                    },
                  }),
                );
              }
              onBack();
              window.dispatchEvent(new CustomEvent("onpoint:navigate", { detail: "shop" }));
              window.location.href = "/shop";
            }}
          >
            <ShoppingBag className="w-4 h-4" />
            Shop Recommended Items
          </Button>

          {/* Session recommendations from AI analysis */}
          {sessionSummary.recommendations && sessionSummary.recommendations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Recommended For You
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {sessionSummary.recommendations.slice(0, 3).map((rec, i) => {
                  const catalogMatch = CANVAS_ITEMS.find(
                    (item) =>
                      item.name.toLowerCase() === rec.name.toLowerCase() ||
                      item.category.toLowerCase() === rec.category.toLowerCase(),
                  );
                  return (
                    <div
                      key={i}
                      className="rounded-xl overflow-hidden border border-border bg-muted/30 text-left"
                    >
                      {catalogMatch?.modelSrc && (
                        <div className="aspect-square bg-muted">
                          <img
                            src={catalogMatch.modelSrc}
                            alt={rec.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-1.5">
                        <p className="text-[10px] text-foreground font-medium truncate">{rec.name}</p>
                        <p className="text-[10px] font-bold text-amber-400">${rec.price}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedCapture && !isReadOnly && (
            <MintLookButton
              imageUrl={selectedCapture.image}
              ipfsCid=""
              aiCritique={finalAdvice}
              onUpload={async () => {
                const res = await fetch("/api/ipfs/upload", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    data: selectedCapture.image,
                    name: "outfit.jpg",
                  }),
                });
                return res.json();
              }}
            />
          )}
          {!isReadOnly && (
            <Button
              className="w-full bg-muted/30 hover:bg-muted text-foreground border border-border rounded-full py-6 text-lg font-bold gap-2"
              onClick={async () => {
                if (!selectedCapture) return;
                const text = generateShareText({
                  score: sessionSummary.score,
                  personaLabel: personaStyling.label,
                  topics: sessionSummary.topics,
                  takeaways: sessionSummary.takeaways,
                  sessionGoal: sessionGoal || undefined,
                });
                await SocialUtils.shareContent({
                  text,
                  imageDataUrl: selectedCapture.image,
                });
              }}
            >
              Share to Farcaster
            </Button>
          )}

          {!isReadOnly && (
            <>
              <AgentStatus
                compact
                showActions
                onTipClick={() => onSetShowTipModal(true)}
              />
              <AgentActionCard
                score={sessionSummary?.score}
                onMintClick={selectedCapture ? () => {} : undefined}
              />
              <AgentPermissionDashboard />
            </>
          )}

          <button
            onClick={() => {
              onBack();
              window.dispatchEvent(
                new CustomEvent("onpoint:navigate", { detail: "my-looks" }),
              );
            }}
            className="w-full text-center text-[11px] text-emerald-500/70 hover:text-emerald-400 transition-colors py-2"
          >
            Saved to My Looks — View all →
          </button>
        </div>

        {!isReadOnly && (
          <>
            <TipSheet
              isOpen={showTipModal}
              onClose={() => onSetShowTipModal(false)}
              score={sessionSummary?.score}
            />
            <AgentApprovalModal
              isOpen={isApprovalModalOpen}
              onClose={() => onSetShowTipModal(false)}
              onApprove={(requestId: string) => {
                onApprove();
                return Promise.resolve();
              }}
              onReject={(requestId: string) => {
                onReject();
              }}
              request={currentApproval}
            />
          </>
        )}

        {/* Style Report Card Modal */}
        <AnimatePresence>
          {showStyleReport && (
            <StyleReportCard
              score={sessionSummary.score}
              persona={(selectedPersona as StylistPersona) || "luxury"}
              takeaways={sessionSummary.takeaways}
              topics={sessionSummary.topics}
              fullFeedback={sessionSummary.fullFeedback}
              captureImage={selectedCapture?.image}
              sessionGoal={sessionGoal || undefined}
              onClose={() => onSetShowStyleReport(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
