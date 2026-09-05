import { useState } from "react";
import type { InsightsSnapshot } from "../../electron/preload/types";

export function LoadSnapshotScreen({ onLoaded }: { onLoaded: (snapshot: InsightsSnapshot) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function openSnapshot() {
    setError(null);
    setLoading(true);
    try {
      const snapshot = await window.platformInsights.openSnapshot();
      if (snapshot) onLoaded(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that file.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen centered">
      <div className="card" style={{ maxWidth: 480, textAlign: "center" }}>
        <h1>Platform Insights</h1>
        <p className="muted">
          Open a snapshot exported with <code>pnpm run insights:export</code> (run from{" "}
          <code>services/api</code>) to see registration trends, module adoption, and product
          recommendations.
        </p>
        <button type="button" onClick={openSnapshot} disabled={loading}>
          {loading ? "Opening…" : "Open snapshot…"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
