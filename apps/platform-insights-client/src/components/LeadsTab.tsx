import { useMemo, useState } from "react";
import type { InsightsSnapshot } from "../../electron/preload/types";

const SOURCE_LABELS: Record<string, string> = {
  site: "ovexatechnology.com",
  school: "school.ovexa.com",
};

export function LeadsTab({ snapshot }: { snapshot: InsightsSnapshot }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | string>("all");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.leads.filter((lead) => {
      if (source !== "all" && lead.source !== source) return false;
      if (!needle) return true;
      return (
        lead.name.toLowerCase().includes(needle) ||
        lead.email.toLowerCase().includes(needle) ||
        (lead.company ?? "").toLowerCase().includes(needle) ||
        lead.message.toLowerCase().includes(needle)
      );
    });
  }, [snapshot, query, source]);

  const sources = useMemo(() => Array.from(new Set(snapshot.leads.map((lead) => lead.source))), [snapshot]);

  return (
    <div className="tab-content">
      <div className="card">
        <h2>Contact, demo &amp; feedback enquiries</h2>
        <p className="muted">
          Submitted through the public marketing sites — {snapshot.leads.length} total.
        </p>

        <div className="table-toolbar">
          <input
            type="text"
            placeholder="Search by name, email, company, or message…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sites</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <p className="muted">
            {snapshot.leads.length === 0 ? "No enquiries yet." : "No enquiries match that search."}
          </p>
        ) : (
          <ul className="lead-list">
            {rows.map((lead) => (
              <li key={lead.id} className="lead-item">
                <div className="lead-item-header">
                  <span className="lead-item-name">{lead.name}</span>
                  <span className="badge">{SOURCE_LABELS[lead.source] ?? lead.source}</span>
                  <span className="muted lead-item-date">{new Date(lead.createdAt).toLocaleString()}</span>
                </div>
                <div className="muted lead-item-contact">
                  {lead.email}
                  {lead.company ? ` · ${lead.company}` : ""}
                </div>
                <p className="lead-item-message">{lead.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
