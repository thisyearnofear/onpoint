"use client";

import type { ErrorInfo } from "next/error";

export default function GlobalError({ error, unstable_retry }: ErrorInfo) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-muted-foreground">An unexpected error occurred. Please try again.</p>
          <button
            onClick={() => unstable_retry()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
