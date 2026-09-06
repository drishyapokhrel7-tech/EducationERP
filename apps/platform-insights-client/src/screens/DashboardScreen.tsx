import { useState } from "react";
import type { InsightsSnapshot } from "../../electron/preload/types";
import { RegistrationsTab } from "../components/RegistrationsTab";
import { ModuleAdoptionTab } from "../components/ModuleAdoptionTab";
import { LeadsTab } from "../components/LeadsTab";
import { RecommendationsTab } from "../components/RecommendationsTab";

type Tab = "registrations" | "adoption" | "leads" | "recommendations";

const TABS: { id: Tab; label: string }[] = [
  { id: "registrations", label: "Registrations" },
  { id: "adoption", label: "Module adoption" },
  { id: "leads", label: "Leads & feedback" },
  { id: "recommendations", label: "Recommendations" },
];

export function DashboardScreen({
  snapshot,
  onLoadDifferent,
}: {
  snapshot: InsightsSnapshot;
  onLoadDifferent: () => void;
}) {
  const [tab, setTab] = useState<Tab>("registrations");

  return (
    <div className="screen dashboard">
      <header>
        <h1>Platform Insights</h1>
        <p className="muted">
          Snapshot generated {new Date(snapshot.generatedAt).toLocaleString()} ·{" "}
          {snapshot.organizations.length} organizations
        </p>
        <button type="button" className="link-button" onClick={onLoadDifferent}>
          Load a different snapshot
        </button>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="dashboard-content">
        {tab === "registrations" ? <RegistrationsTab snapshot={snapshot} /> : null}
        {tab === "adoption" ? <ModuleAdoptionTab snapshot={snapshot} /> : null}
        {tab === "leads" ? <LeadsTab snapshot={snapshot} /> : null}
        {tab === "recommendations" ? <RecommendationsTab /> : null}
      </main>
    </div>
  );
}
