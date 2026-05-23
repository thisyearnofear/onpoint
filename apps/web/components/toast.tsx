"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <AlertCircle className="h-5 w-5 text-destructive" />,
  info: <Info className="h-5 w-5 text-primary" />,
  warning: <AlertTriangle className="h-5 w-5 text-accent" />,
};

const STYLES: Record<ToastType, string> = {
  success: "border-green-500/30",
  error: "border-destructive/30",
  info: "border-primary/30",
  warning: "border-accent/30",
};

let toastId = 0;

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Defer portal rendering to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => removeToast(id), 4000);
      timersRef.current.set(id, timer);
    },
    [removeToast],
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const toastContainer = (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-3 p-4 rounded-xl border bg-card shadow-lg backdrop-blur-md animate-in slide-in-from-right-2 pointer-events-auto",
            STYLES[t.type],
          )}
        >
          <span className="mt-0.5 shrink-0">{ICONS[t.type]}</span>
          <p className="text-sm text-foreground flex-1">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            aria-label="Dismiss"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted && createPortal(toastContainer, document.body)}
    </ToastContext.Provider>
  );
}
