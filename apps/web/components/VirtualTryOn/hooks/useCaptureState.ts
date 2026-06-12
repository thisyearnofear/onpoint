/**
 * useCaptureState — Capture management for live sessions
 *
 * Single responsibility: manage capture array, flash, countdown, and toast.
 * Extracted from useLiveSession for CLEAN separation of concerns.
 */

import { useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export interface CaptureOption {
  image: string;
  comment: string;
}

export function useCaptureState(maxCaptures: number) {
  const [captures, setCaptures] = useState<CaptureOption[]>([]);
  const [selectedCaptureIndex, setSelectedCaptureIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captureToast, setCaptureToast] = useState<string | null>(null);

  const capturesRemaining = Math.max(0, maxCaptures - captures.length);
  const capturesExhausted = capturesRemaining <= 0;
  const hasCaptures = captures.length > 0;
  const selectedCapture = hasCaptures ? captures[selectedCaptureIndex] : null;

  const reset = useCallback(() => {
    setCaptures([]);
    setSelectedCaptureIndex(0);
    setIsCapturing(false);
    setShowFlash(false);
    setCountdown(null);
    setCaptureToast(null);
  }, []);

  const handleCapture = useCallback(async (
    videoRef: React.RefObject<HTMLVideoElement | null>,
    reasoning: string[],
  ) => {
    if (!videoRef.current || isCapturing) return;
    if (captures.length >= maxCaptures) return;

    try {
      setIsCapturing(true);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 150);

      try {
        sdk.actions.ready();
      } catch {}

      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const image = canvas.toDataURL("image/jpeg", 0.82);

        const newCapture = {
          image,
          comment: reasoning[0] || "Analyzing style selection…",
        };

        setCaptures((prev) => [...prev, newCapture]);
        setSelectedCaptureIndex(captures.length);

        const captureCount = captures.length + 1;
        const maxLabel = maxCaptures === Infinity ? "∞" : `${maxCaptures}`;
        setCaptureToast(`Capture saved! (${captureCount}/${maxLabel})`);
        setTimeout(() => setCaptureToast(null), 2000);
      }
    } catch (err) {
      console.error("Capture error:", err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, captures.length, maxCaptures]);

  const startTimerCapture = useCallback((
    videoRef: React.RefObject<HTMLVideoElement | null>,
    reasoning: string[],
  ) => {
    if (countdown !== null) return;
    setCountdown(10);

    try {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const playBeep = async (freq: number) => {
        if (ctx.state === "suspended") await ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      };

      let count = 10;
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          if (count <= 3) playBeep(880);
          else if (count % 2 === 0) playBeep(440);
          setCountdown(count);
        } else {
          clearInterval(interval);
          playBeep(1760);
          setCountdown(null);
          handleCapture(videoRef, reasoning);
        }
      }, 1000);
      playBeep(440);
    } catch {
      let count = 10;
      const interval = setInterval(() => {
        count--;
        if (count > 0) setCountdown(count);
        else {
          clearInterval(interval);
          setCountdown(null);
          handleCapture(videoRef, reasoning);
        }
      }, 1000);
    }
  }, [countdown, handleCapture]);

  return {
    captures,
    selectedCaptureIndex,
    setSelectedCaptureIndex,
    isCapturing,
    showFlash,
    countdown,
    captureToast,
    capturesRemaining,
    capturesExhausted,
    hasCaptures,
    selectedCapture,
    handleCapture,
    startTimerCapture,
    reset,
  };
}
