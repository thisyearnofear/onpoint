"use client";

import { useState, useCallback } from "react";

export type CheckStatus = "pass" | "warn" | "fail";

export interface QualityCheck {
  name: string;
  status: CheckStatus;
  message: string;
}

interface QualityCheckResult {
  checks: QualityCheck[];
  failCount: number;
  warnCount: number;
}

/**
 * Client-side photo quality analysis.
 * All checks run in-browser — no API calls.
 *
 * Checks:
 *   1. File size — warns if < 100KB or > 10MB
 *   2. Brightness — warns if image is too dark or blown out
 *   3. Aspect ratio — warns if extremely portrait or landscape (body likely cropped)
 *   4. Resolution — warns if image is very small (< 200px on shortest side)
 */
export function usePhotoQualityCheck() {
  const [result, setResult] = useState<QualityCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const checkPhoto = useCallback((file: File): Promise<QualityCheckResult> => {
    setChecking(true);
    setResult(null);

    return new Promise((resolve) => {
      const checks: QualityCheck[] = [];

      // 1. File size check
      const sizeKB = file.size / 1024;
      if (sizeKB < 100) {
        checks.push({ name: "file_size", status: "warn", message: "File is very small — may be low quality" });
      } else if (sizeKB > 10 * 1024) {
        checks.push({ name: "file_size", status: "warn", message: "Large file — upload may be slow" });
      } else {
        checks.push({ name: "file_size", status: "pass", message: "Good file size" });
      }

      // 2-4 require loading the image
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        // 2. Resolution check
        const shortestSide = Math.min(img.naturalWidth, img.naturalHeight);
        if (shortestSide < 200) {
          checks.push({ name: "resolution", status: "fail", message: "Image resolution too low for good results" });
        } else if (shortestSide < 400) {
          checks.push({ name: "resolution", status: "warn", message: "Low resolution — results may be blurry" });
        } else {
          checks.push({ name: "resolution", status: "pass", message: "Good resolution" });
        }

        // 3. Aspect ratio check
        const ratio = img.naturalWidth / img.naturalHeight;
        if (ratio < 0.4 || ratio > 2.5) {
          checks.push({ name: "aspect_ratio", status: "warn", message: "Extreme aspect ratio — body may be cropped" });
        } else if (ratio < 0.5 || ratio > 2.0) {
          checks.push({ name: "aspect_ratio", status: "warn", message: "Unusual aspect ratio — consider a more standard photo" });
        } else {
          checks.push({ name: "aspect_ratio", status: "pass", message: "Good aspect ratio" });
        }

        // 4. Brightness check via canvas sampling
        try {
          const canvas = document.createElement("canvas");
          // Downsample for performance
          const sampleSize = 100;
          canvas.width = sampleSize;
          canvas.height = sampleSize;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
            const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

            let totalBrightness = 0;
            const pixelCount = sampleSize * sampleSize;
            for (let i = 0; i < data.length; i += 4) {
              // Perceived brightness formula (ITU-R BT.601)
              totalBrightness += 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
            }
            const avgBrightness = totalBrightness / pixelCount; // 0-255

            if (avgBrightness < 50) {
              checks.push({ name: "brightness", status: "warn", message: "Very dark — try better lighting" });
            } else if (avgBrightness < 80) {
              checks.push({ name: "brightness", status: "warn", message: "Somewhat dark — consider brighter lighting" });
            } else if (avgBrightness > 240) {
              checks.push({ name: "brightness", status: "warn", message: "Very bright — may be overexposed" });
            } else {
              checks.push({ name: "brightness", status: "pass", message: "Good lighting" });
            }
          } else {
            checks.push({ name: "brightness", status: "pass", message: "Could not check lighting" });
          }
        } catch {
          checks.push({ name: "brightness", status: "pass", message: "Could not check lighting" });
        }

        URL.revokeObjectURL(url);

        const qualityResult = {
          checks,
          failCount: checks.filter((c) => c.status === "fail").length,
          warnCount: checks.filter((c) => c.status === "warn").length,
        };

        setResult(qualityResult);
        setChecking(false);
        resolve(qualityResult);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Can't analyze — don't block
        const fallback: QualityCheckResult = { checks: [], failCount: 0, warnCount: 0 };
        setResult(fallback);
        setChecking(false);
        resolve(fallback);
      };

      img.src = url;
    });
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setChecking(false);
  }, []);

  return { result, checking, checkPhoto, reset };
}
