"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught:", error, errorInfo);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // In production, send to error tracking service
    if (process.env.NODE_ENV === "production") {
      // TODO: Send to Sentry/Bugsnag
      // Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-950">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-10 h-10 text-rose-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Something went wrong</h2>
          <p className="text-slate-400 text-sm">
            The Live AR Stylist encountered an unexpected error. Your data is
            safe — this is just a UI glitch.
          </p>
        </div>

        {isDevelopment && error && (
          <div className="p-4 bg-slate-900 rounded-xl border border-rose-500/20 text-left">
            <p className="text-rose-400 text-xs font-mono break-all">
              {error.message}
            </p>
            {error.stack && (
              <pre className="text-rose-300/60 text-[10px] mt-2 overflow-auto max-h-32">
                {error.stack}
              </pre>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={onReset}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <p className="text-slate-500 text-xs">
            If this keeps happening, try refreshing the page or switching to a
            different browser.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook-based error boundary wrapper for easier use
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `WithErrorBoundary(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent;
}
