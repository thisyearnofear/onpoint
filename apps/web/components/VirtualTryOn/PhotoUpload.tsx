"use client";

import React, { useRef, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Camera, Upload } from "lucide-react";

interface PhotoUploadProps {
  onPhotoSelect: (file: File) => void;
  disabled?: boolean;
}

export function PhotoUpload({ onPhotoSelect, disabled }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0] && files[0].type.startsWith("image/")) {
        onPhotoSelect(files[0]);
      }
    },
    [onPhotoSelect],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && files[0]) {
        onPhotoSelect(files[0]);
      }
    },
    [onPhotoSelect],
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
      </CardContent>
    </Card>
  );
}