"use client";

export default function StyleError({
  _error,
  reset,
}: {
  _error: Error & { digest?: string };
  reset: () => void;
}) {
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
        onClick={reset}
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
