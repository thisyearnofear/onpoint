"use client";

import type { ErrorInfo } from "next/error";

export default function StyleError({ unstable_retry }: ErrorInfo) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
        Style studio unavailable
      </h2>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Unable to load the style studio. Please try again.
      </p>
      <button
        onClick={() => unstable_retry()}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}
