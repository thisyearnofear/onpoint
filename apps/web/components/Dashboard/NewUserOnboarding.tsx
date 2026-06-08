"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Camera, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@repo/ui/button";
import { useRouter } from "next/navigation";

const ONBOARDING_SEEN_KEY = "onpoint-onboarding-seen";
const LIVE_AUTO_START_KEY = "onpoint-live-auto-start";
const TRYON_MODE_KEY = "onpoint-tryon-mode";

export function NewUserOnboarding() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem(ONBOARDING_SEEN_KEY);
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const close = useCallback(() => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    setIsOpen(false);
  }, []);

  const startLiveScan = useCallback(() => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    localStorage.setItem(LIVE_AUTO_START_KEY, "true");
    window.dispatchEvent(new Event("onpoint-live-auto-start"));
    setIsOpen(false);
    router.push("/lab?tab=try-on");
  }, [router]);

  const useUploadInstead = useCallback(() => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    localStorage.setItem(TRYON_MODE_KEY, "upload");
    window.dispatchEvent(new Event("onpoint-tryon-upload-mode"));
    setIsOpen(false);
    router.push("/lab?tab=try-on&mode=upload");
  }, [router]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-border bg-background shadow-2xl">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 z-10 rounded-full bg-muted p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          aria-label="Dismiss onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-6 p-6 pt-8">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/15">
              <Camera className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                First fit check
              </p>
              <h2 className="text-2xl font-black tracking-tight">
                Open the camera. Get one useful style read.
              </h2>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
                OnPoint will start with a balanced quick check. Stylist, tone,
                budget, and occasion can all wait until after the first scan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ["Fit", "silhouette"],
              ["Palette", "color"],
              ["Next", "one move"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-left"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="text-xs font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Button
              onClick={startLiveScan}
              className="h-12 w-full rounded-full bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Start live outfit check
            </Button>
            <Button
              variant="outline"
              onClick={useUploadInstead}
              className="h-11 w-full rounded-full text-sm"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload a photo instead
            </Button>
            <button
              type="button"
              onClick={close}
              className="w-full py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Explore first
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
