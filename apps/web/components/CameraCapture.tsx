"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Camera, RefreshCw, X } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

// Function to compress image
const compressImage = (file: File, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Set maximum dimensions
      const maxWidth = 1024;
      const maxHeight = 1024;
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Could not load image'));
    };

    img.src = URL.createObjectURL(file);
  });
};

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        setLoading(true);
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" },
          audio: false 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Could not access camera. Please ensure you've granted permission and that your camera is working.");
      } finally {
        setLoading(false);
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob and compress
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              // Compress the image
              const compressedBlob = await compressImage(new File([blob], "camera-capture.jpg"));
              const compressedFile = new File([compressedBlob], "camera-capture.jpg", { type: "image/jpeg" });
              
              setCapturedImage(URL.createObjectURL(compressedBlob));
              onCapture(compressedFile);
            } catch (err) {
              console.error("Error compressing image:", err);
              // Fallback to original if compression fails
              const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
              setCapturedImage(URL.createObjectURL(blob));
              onCapture(file);
            }
          }
        }, "image/jpeg", 0.95);
      }
    }
  };

  const retakeImage = () => {
    setCapturedImage(null);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Camera Capture
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <div className="text-destructive mb-4">{error}</div>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2">Accessing camera...</span>
          </div>
        ) : capturedImage ? (
          <div className="flex flex-col items-center gap-4">
            <img 
              src={capturedImage} 
              alt="Captured" 
              className="max-w-full h-auto rounded-lg"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={retakeImage}>
                Retake
              </Button>
              <Button onClick={onCancel}>Use Photo</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full aspect-[3/4] max-w-sm bg-muted rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-white/50 rounded-full w-32 h-32" />
              </div>
            </div>
            <Button onClick={captureImage} className="mt-4">
              <Camera className="h-4 w-4 mr-2" />
              Capture Photo
            </Button>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}