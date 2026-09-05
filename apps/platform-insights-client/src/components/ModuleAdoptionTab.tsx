import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MODULE_KEYS, type InsightsSnapshot } from "../../electron/preload/types";

const MODULE_LABELS: Record<string, string> = {
  admissions: "Admissions",
  timetable: "Timetable",
  attendance: "Attendance",
  syllabus: "Syllabus",
  assignments: "Assignments",
  knowledgeChecks: "Knowledge Checks",
  exams: "Exams",
  finance: "Finance",
  leave: "Leave",
  payroll: "Payroll",
  transport: "Transport",
  hostel: "Hostel",
  inventory: "Inventory",
  communication: "Communication",
  certificates: "Certificates",
  alumni: "Alumni",
};

const EDITION_LABELS: Record<string, string> = {
  FREE: "Free",
  PROFESSIONAL: "Professional",
  ULTRA: "Ultra",
};

export function ModuleAdoptionTab({ snapshot }: { snapshot: InsightsSnapshot }) {
  const total = snapshot.organizations.length;

  const moduleAdoption = useMemo(
    () =>
      MODULE_KEYS.map((key) => {
        const orgsUsingIt = snapshot.organizations.filter((org) => org.moduleUsage[key] > 0).length;
        return {
          key,
          label: MODULE_LABELS[key],
          orgsUsingIt,
          percent: total === 0 ? 0 : Math.round((orgsUsingIt / total) * 100),
        };
      }).sort((a, b) => b.orgsUsingIt - a.orgsUsingIt),
    [snapshot, total],
  );

  const editionCounts = useMemo(() => {
    const counts: Record<string, number> = { FREE: 0, PROFESSIONAL: 0, ULTRA: 0 };
    for (const org of snapshot.organizations) counts[org.edition] = (counts[org.edition] ?? 0) + 1;
    return Object.entries(counts).map(([edition, count]) => ({ edition: EDITION_LABELS[edition] ?? edition, count }));
  }, [snapshot]);

  return (
    <div className="tab-content">
      <div className="card">
        <h2>Edition distribution</h2>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={editionCounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="edition" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0e7490" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>
          Which modules do organizations actually use? <span className="muted">({total} organizations)</span>
        </h2>
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Organizations that have used it</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {moduleAdoption.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>
                  {m.orgsUsingIt} / {total}
                </td>
                <td>
                  <div className="bar-cell">
                    <div className="bar-cell-fill" style={{ width: `${m.percent}%` }} />
                    <span>{m.percent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
