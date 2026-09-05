import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InsightsSnapshot } from "../../electron/preload/types";

function toDay(iso: string): string {
  return iso.slice(0, 10);
}

export function RegistrationsTab({ snapshot }: { snapshot: InsightsSnapshot }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "name">("createdAt");

  const dailyCounts = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const org of snapshot.organizations) {
      const day = toDay(org.createdAt);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return Array.from(byDay.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [snapshot]);

  const rows = useMemo(() => {
    const filtered = snapshot.organizations.filter((org) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return org.name.toLowerCase().includes(needle) || org.slug.toLowerCase().includes(needle);
    });
    return [...filtered].sort((a, b) =>
      sortBy === "name" ? a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt),
    );
  }, [snapshot, query, sortBy]);

  return (
    <div className="tab-content">
      <div className="card">
        <h2>Registrations per day</h2>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={dailyCounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0e7490" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <input
            type="text"
            placeholder="Search by name or code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "createdAt" | "name")}>
            <option value="createdAt">Sort: newest first</option>
            <option value="name">Sort: name (A–Z)</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>Institution</th>
              <th>Code</th>
              <th>Registered</th>
              <th>Edition</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((org) => (
              <tr key={org.id}>
                <td>{org.name}</td>
                <td className="muted">{org.slug}</td>
                <td>{new Date(org.createdAt).toLocaleString()}</td>
                <td>{org.edition}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="muted">No organizations match that search.</p> : null}
      </div>
    </div>
  );
}
