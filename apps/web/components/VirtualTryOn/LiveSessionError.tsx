"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import { AlertCircle, Upload } from "lucide-react";
import { GeminiLivePaymentButton } from "./GeminiLivePaymentButton";
import { findPremiumProvider } from "@repo/ai-client";

interface LiveSessionErrorProps {
  error: string;
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
   * Optional handler to switch to the photo-upload mode. Shown as a
   * primary action for camera-related errors so users have a clear
   * escape hatch when the camera can't launch.
   */
  onUseUploadPhoto?: () => void;
}

export function LiveSessionError({
  error,
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
          <p className="text-slate-400 text-sm">{error}</p>
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
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
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
                    className="w-full text-xs text-slate-400 hover:text-white transition-colors py-1"
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
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
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
                  className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-full font-bold gap-2"
                  onClick={onUseUploadPhoto}
                >
                  <Upload className="w-4 h-4" />
                  Upload a Photo instead
                </Button>
              )}
              <Button
                variant="ghost"
                className="text-slate-400 hover:text-white hover:bg-white/5 font-bold"
                onClick={onGoBack}
              >
                {isCameraError && onUseUploadPhoto ? "Go Back" : "Go Back"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
