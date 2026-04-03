"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        Something went wrong
      </h2>
      <p style={{ color: "#666", marginBottom: "1.5rem", maxWidth: "400px" }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.75rem 1.5rem",
          borderRadius: "8px",
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        Try again
      </button>
    </div>
  );
}
