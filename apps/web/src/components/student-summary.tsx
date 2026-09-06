import type { StudentDashboard } from "@education-erp/api-client";

export const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Shared by the admin learning-dashboards view (which fetches any
// student's data by ID) and the student portal (which fetches only the
// logged-in student's own data) — same rendering, different data source.
export function StudentSummary({ data }: { data: StudentDashboard }) {
  const { attendanceSummary: a } = data;
  const attendancePct = a.total > 0 ? Math.round((a.present / a.total) * 100) : null;
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium">Active enrollment</p>
        {data.activeEnrollment ? (
          <p className="text-muted-foreground">
            {data.activeEnrollment.program.name} · {data.activeEnrollment.section.name} ·{" "}
            {data.activeEnrollment.semester.name}
          </p>
        ) : (
          <p className="text-muted-foreground">No active enrollment.</p>
        )}
      </div>
      <div>
        <p className="font-medium">Attendance</p>
        <p className="text-muted-foreground">
          {a.total === 0
            ? "No attendance recorded yet."
            : `${attendancePct}% present (${a.present} present, ${a.absent} absent, ${a.late} late, ${a.excused} excused of ${a.total})`}
        </p>
      </div>
      <div>
        <p className="font-medium">Weekly timetable</p>
        {data.weeklyTimetable.length === 0 ? (
          <p className="text-muted-foreground">No scheduled classes.</p>
        ) : (
          <ul className="text-muted-foreground list-disc pl-5">
            {data.weeklyTimetable.map((c) => (
              <li key={c.id}>
                {DAYS[c.dayOfWeek]} · {c.period.name} — {c.teachingAssignment.subject.name} with{" "}
                {c.teachingAssignment.employee.firstName} {c.teachingAssignment.employee.lastName} in{" "}
                {c.room.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-medium">Assignment submissions</p>
        {data.assignmentSubmissions.length === 0 ? (
          <p className="text-muted-foreground">None yet.</p>
        ) : (
          <ul className="text-muted-foreground list-disc pl-5">
            {data.assignmentSubmissions.map((s) => (
              <li key={s.id}>
                {s.assignment.title} — {s.status}
                {s.score !== null ? ` (${s.score})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-medium">Knowledge check attempts</p>
        {data.knowledgeCheckAttempts.length === 0 ? (
          <p className="text-muted-foreground">None yet.</p>
        ) : (
          <ul className="text-muted-foreground list-disc pl-5">
            {data.knowledgeCheckAttempts.map((a2) => (
              <li key={a2.id}>
                {a2.knowledgeCheck.title} — {a2.score.toFixed(0)}%
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-medium">Syllabus progress</p>
        {data.syllabusProgress.length === 0 ? (
          <p className="text-muted-foreground">No syllabi for the current term yet.</p>
        ) : (
          <ul className="text-muted-foreground list-disc pl-5">
            {data.syllabusProgress.map((g) => {
              const completed = g.nodes.filter((n) => n.status === "COMPLETED").length;
              return (
                <li key={g.subjectName}>
                  {g.subjectName}: {completed} / {g.nodes.length} topics completed
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
