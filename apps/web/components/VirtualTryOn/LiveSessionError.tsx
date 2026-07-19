"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import {
  AlertCircle,
  Upload,
  ArrowLeft,
  AlertTriangle,
  Clock,
  WifiOff,
  Camera,
  Search,
} from "lucide-react";
import { GeminiLivePaymentButton } from "./GeminiLivePaymentButton";
import { findPremiumProvider, type CameraError, type CameraErrorKind } from "@repo/ai-client";

interface LiveSessionErrorProps {
  /** Generic error message (payment, network, server). */
  error?: string;
  /**
   * Structured camera error. When set, the component renders a dedicated
   * recovery layout (guidance, not "something went wrong") with
   * browser-specific steps and the "Upload a Photo" affordance.
   */
  cameraError?: CameraError | null;
  isPremium: boolean;
  supportsByok: boolean;
  geminiPaymentToken: string | null;
  showByokInput: boolean;
  userApiKey: string;
  sessionGoal: string | null;
  onStopSession: () => void;
  onGoBack: () => void;
  onPaymentSuccess: (token: string) => void;
  onStartSession: (goal: string | null, apiKey?: string) => void;
  onShowByok: () => void;
  onSetUserApiKey: (key: string) => void;
  /**
   * Optional handler to switch to the photo-upload mode. Always wired
   * for the camera-recovery layout; for the generic-error layout, it's
   * also surfaced when the error string looks camera-related.
   */
  onUseUploadPhoto?: () => void;
}

export function LiveSessionError({
  error,
  cameraError,
  isPremium,
  supportsByok,
  geminiPaymentToken,
  showByokInput,
  userApiKey,
  sessionGoal,
  onStopSession,
  onGoBack,
  onPaymentSuccess,
  onStartSession,
  onShowByok,
  onSetUserApiKey,
  onUseUploadPhoto,
}: LiveSessionErrorProps) {
  // ── Variant: camera error (structured) ──
  // Renders "guidance", not "error" — different visual treatment, numbered
  // recovery steps, and the upload fallback is always the primary action.
  if (cameraError) {
    return (
      <CameraRecovery
        error={cameraError}
        onUseUploadPhoto={onUseUploadPhoto}
        onGoBack={onGoBack}
      />
    );
  }

  // ── Variant: generic error ──
  // Below here is the existing payment/network/server error layout.
  if (!error) return null;
  return (
    <GenericError
      error={error}
      isPremium={isPremium}
      supportsByok={supportsByok}
      geminiPaymentToken={geminiPaymentToken}
      showByokInput={showByokInput}
      userApiKey={userApiKey}
      sessionGoal={sessionGoal}
      onGoBack={onGoBack}
      onPaymentSuccess={onPaymentSuccess}
      onStartSession={onStartSession}
      onShowByok={onShowByok}
      onSetUserApiKey={onSetUserApiKey}
      onUseUploadPhoto={onUseUploadPhoto}
    />
  );
}

// ── Camera recovery variant ──

function CameraRecovery({
  error,
  onUseUploadPhoto,
  onGoBack,
}: {
  error: CameraError;
  onUseUploadPhoto?: () => void;
  onGoBack: () => void;
}) {
  const Icon = iconForKind(error.kind);
  return (
    <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl px-6 py-8">
      <div className="max-w-md w-full rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
            <Icon className="w-6 h-6 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
              {error.title}
            </h2>
            <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
              {error.message}
            </p>
          </div>
        </div>

        {error.steps.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2.5">
              How to fix
            </p>
            <ol className="space-y-2">
              {error.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-sm text-slate-200 leading-relaxed"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 border border-white/10 text-muted-foreground/70 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {onUseUploadPhoto && (
            <Button
              onClick={onUseUploadPhoto}
              className="w-full bg-success hover:bg-success active:bg-success text-white rounded-full font-bold gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload a Photo instead
            </Button>
          )}
          {onGoBack && error.canGoBack && (
            <Button
              variant="ghost"
              onClick={onGoBack}
              className="w-full text-muted-foreground/70 hover:text-white hover:bg-white/5 font-medium gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go Back
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function iconForKind(kind: CameraErrorKind): React.ElementType {
  switch (kind) {
    case "permission_denied":
      return AlertTriangle;
    case "in_use":
    case "no_camera":
    case "unsupported":
    case "playback_blocked":
      return Camera;
    case "constraints_not_met":
      return Search;
    case "timeout":
      return Clock;
    default:
      return WifiOff;
  }
}

// ── Generic error variant (preserved from previous behavior) ──

interface GenericErrorProps {
  error: string;
  isPremium: boolean;
  supportsByok: boolean;
  geminiPaymentToken: string | null;
  showByokInput: boolean;
  userApiKey: string;
  sessionGoal: string | null;
  onGoBack: () => void;
  onPaymentSuccess: (token: string) => void;
  onStartSession: (goal: string | null, apiKey?: string) => void;
  onShowByok: () => void;
  onSetUserApiKey: (key: string) => void;
  onUseUploadPhoto?: () => void;
}

function GenericError({
  error,
  isPremium,
  supportsByok,
  geminiPaymentToken,
  showByokInput,
  userApiKey,
  sessionGoal,
  onGoBack,
  onPaymentSuccess,
  onStartSession,
  onShowByok,
  onSetUserApiKey,
  onUseUploadPhoto,
}: GenericErrorProps) {
  const errorLower = error.toLowerCase();
  const isCameraError =
    errorLower.includes("camera") ||
    errorLower.includes("permission") ||
    errorLower.includes("setup") ||
    errorLower.includes("timed out");

  const title =
    errorLower.includes("rate limit")
      ? "Session Limit Reached"
      : errorLower.includes("camera") || errorLower.includes("permission")
        ? "Camera Access Required"
        : errorLower.includes("payment") || errorLower.includes("verification")
          ? "Payment Issue"
          : "Connection Issue";

  const isPaymentError =
    supportsByok &&
    (errorLower.includes("payment") ||
      errorLower.includes("api key") ||
      errorLower.includes("requires payment"));

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center p-6 bg-rose-950/20 backdrop-blur-3xl">
      <div className="bg-slate-900/90 border border-rose-500/30 p-8 rounded-3xl max-w-sm w-full shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mb-6 mx-auto">
          <AlertCircle className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-2">{title}</h2>
        <div className="text-center mb-8 space-y-3">
          <p className="text-muted-foreground/70 text-sm">{error}</p>
          {!isPremium && errorLower.includes("rate limit") && (() => {
            const premium = findPremiumProvider();
            if (!premium) return null;
            return (
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <p className="text-indigo-300 text-xs">
                  Upgrade to <strong>Premium</strong> for unlimited sessions
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs"
                  onClick={onGoBack}
                >
                  Go Back
                </Button>
              </div>
            );
          })()}
          {errorLower.includes("camera") && (
            <div className="p-3 bg-warning/10 rounded-xl border border-warning/20">
              <p className="text-amber-300 text-xs">
                Please allow camera access in your browser settings.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {isPaymentError && (
            <div className="space-y-3">
              {!geminiPaymentToken && !showByokInput && (
                <>
                  <GeminiLivePaymentButton
                    onSuccess={(token: string) => onPaymentSuccess(token)}
                  />
                  <button
                    onClick={onShowByok}
                    className="w-full text-xs text-muted-foreground/70 hover:text-white transition-colors py-1"
                  >
                    Or use your own API key
                  </button>
                </>
              )}
              {showByokInput && (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={userApiKey}
                    onChange={(e) => onSetUserApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50"
                  />
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold"
                    disabled={!userApiKey.trim()}
                    onClick={() => onStartSession(sessionGoal, userApiKey)}
                  >
                    Start with API Key
                  </Button>
                </div>
              )}
            </div>
          )}
          {!isPaymentError && (
            <div className="flex flex-col gap-2">
              {isCameraError && onUseUploadPhoto && (
                <Button
                  className="w-full bg-success hover:bg-success active:bg-success text-white rounded-full font-bold gap-2"
                  onClick={onUseUploadPhoto}
                >
                  <Upload className="w-4 h-4" />
                  Upload a Photo instead
                </Button>
              )}
              <Button
                variant="ghost"
                className="text-muted-foreground/70 hover:text-white hover:bg-white/5 font-bold"
                onClick={onGoBack}
              >
                Go Back
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
