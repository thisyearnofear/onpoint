"use client";

import React, { useRef, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Camera, Upload, User, Sun, Eye, CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { usePhotoQualityCheck } from "./usePhotoQualityCheck";
import type { QualityCheck } from "./usePhotoQualityCheck";

interface PhotoUploadProps {
  onPhotoSelect: (file: File) => void;
  disabled?: boolean;
}

function CheckIcon({ status }: { status: QualityCheck["status"] }) {
  if (status === "pass") return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
  if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  return <XCircle className="h-3.5 w-3.5 text-red-500" />;
}

export function PhotoUpload({ onPhotoSelect, disabled }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { result: qualityResult, checking: qualityChecking, checkPhoto, reset } = usePhotoQualityCheck();

  const handleFile = useCallback(
    (file: File) => {
      onPhotoSelect(file);
      checkPhoto(file);
    },
    [onPhotoSelect, checkPhoto],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0] && files[0].type.startsWith("image/")) {
        handleFile(files[0]);
      }
    },
    [handleFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && files[0]) {
        handleFile(files[0]);
      }
    },
    [handleFile],
  );

  return (
    <Card>
      <CardHeader>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Camera className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-center text-xl">Upload Photo</CardTitle>
        <p className="text-muted-foreground text-center">
          Use an existing photo for AI analysis
        </p>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${disabled
            ? "border-muted opacity-50"
            : "border-muted-foreground/20 hover:border-primary/30"
            }`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            Drag & drop your photo here or click to browse
          </p>
          <Button variant="outline" disabled={disabled}>
            <Upload className="h-4 w-4 mr-2" />
            Select Photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
        </div>

        {/* Static quality hints (shown before upload) */}
        {!qualityResult && !qualityChecking && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1">
              <User className="h-3 w-3" />
              <span>Full body in frame</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1">
              <Sun className="h-3 w-3" />
              <span>Good, even lighting</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1">
              <Eye className="h-3 w-3" />
              <span>Face clearly visible</span>
            </div>
          </div>
        )}

        {/* Quality check in progress */}
        {qualityChecking && (
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Checking photo quality…</span>
          </div>
        )}

        {/* Quality check results */}
        {qualityResult && !qualityChecking && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {qualityResult.checks.map((check) => (
                <div
                  key={check.name}
                  className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 ${
                    check.status === "pass"
                      ? "text-green-700 bg-green-50"
                      : check.status === "warn"
                      ? "text-amber-700 bg-amber-50"
                      : "text-red-700 bg-red-50"
                  }`}
                >
                  <CheckIcon status={check.status} />
                  <span>{check.message}</span>
                </div>
              ))}
            </div>
            {qualityResult.failCount >= 2 && (
              <div className="text-xs text-center text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                For best results, consider re-uploading with a clearer, well-lit full-body photo.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
