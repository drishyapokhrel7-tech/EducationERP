"use client";

// Last-resort boundary: catches errors thrown by the root layout
// itself, which the segment error.tsx files can't. It replaces the
// whole document, so it renders its own <html>/<body>. No design
// system here on purpose — it has to work even if the app shell is
// what failed.

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#faf9f7",
          color: "#1a1a1a",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>The app failed to load</h1>
          <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>
            Something went wrong before the page could render. Reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#1a1a1a",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ fontSize: 11, color: "#999", marginTop: 12 }}>Reference: {error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
