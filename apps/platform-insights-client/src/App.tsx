import { useState } from "react";
import type { InsightsSnapshot } from "../electron/preload/types";
import { LoadSnapshotScreen } from "./screens/LoadSnapshotScreen";
import { DashboardScreen } from "./screens/DashboardScreen";

export default function App() {
  const [snapshot, setSnapshot] = useState<InsightsSnapshot | null>(null);

  if (!snapshot) {
    return <LoadSnapshotScreen onLoaded={setSnapshot} />;
  }

  return <DashboardScreen snapshot={snapshot} onLoadDifferent={() => setSnapshot(null)} />;
}
