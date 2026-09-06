import { useEffect, useRef, useState } from "react";
import type { InsightsSnapshot } from "../electron/preload/types";
import { LoadSnapshotScreen } from "./screens/LoadSnapshotScreen";
import { DashboardScreen } from "./screens/DashboardScreen";

export default function App() {
  const [snapshot, setSnapshot] = useState<InsightsSnapshot | null>(null);
  // Auto-load runs once, on the app's own startup — not on every
  // return to the picker (a user who clicks "load different" wants
  // the manual dialog, not to be bounced straight back to the same
  // latest file).
  const autoLoadAttempted = useRef(false);
  const [autoLoading, setAutoLoading] = useState(true);

  useEffect(() => {
    if (autoLoadAttempted.current) return;
    autoLoadAttempted.current = true;
    window.platformInsights
      .openLatestSnapshot()
      .then((found) => {
        if (found) setSnapshot(found);
      })
      .catch(() => {
        // No snapshot found, or it failed to parse — fall through to
        // the manual picker below rather than surfacing an error for
        // what's often just "nothing exported yet".
      })
      .finally(() => setAutoLoading(false));
  }, []);

  if (autoLoading) {
    return (
      <div className="screen centered">
        <p className="muted">Looking for a snapshot to open…</p>
      </div>
    );
  }

  if (!snapshot) {
    return <LoadSnapshotScreen onLoaded={setSnapshot} />;
  }

  return <DashboardScreen snapshot={snapshot} onLoadDifferent={() => setSnapshot(null)} />;
}
