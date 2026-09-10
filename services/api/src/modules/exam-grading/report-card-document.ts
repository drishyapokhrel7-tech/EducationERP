// Printable Student Report Card PDF. Shared letterhead / render
// helpers live in common/pdf.ts.
import {
  type Doc,
  type LetterheadOrg,
  drawDocTitle,
  drawFooter,
  drawLetterhead,
  drawPartyBlock,
  formatDate,
  renderPdf,
} from "../../common/pdf";

interface DocSubjectRow {
  examSubject: {
    fullMarks: number;
    passMarks: number;
    curriculumSubject: { subject: { name: string } };
  };
  marks: { obtainedMarks: number; remarks: string | null } | null;
  grade: { percentage: number; grade: string; gpa: number | null } | null;
}

export interface DocReportCard {
  reportCard: {
    totalObtainedMarks: number;
    totalFullMarks: number;
    percentage: number;
    overallGrade: string;
    overallGpa: number | null;
    generatedAt: Date;
    exam: { name: string };
  };
  student: { firstName: string; lastName: string; studentCode: string };
  subjects: DocSubjectRow[];
}

const n1 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1));

export function buildReportCardPdf(org: LetterheadOrg, data: DocReportCard): Promise<Buffer> {
  return renderPdf(async (doc: Doc) => {
    await drawLetterhead(doc, org);
    drawDocTitle(doc, "REPORT CARD", data.reportCard.exam.name, "Issued", formatDate(data.reportCard.generatedAt));
    drawPartyBlock(doc, "STUDENT", [
      `${data.student.firstName} ${data.student.lastName}`,
      data.student.studentCode,
    ]);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    // Columns: Subject | Full | Obtained | % | Grade
    const cols = [left, right - 250, right - 180, right - 110, right - 55];
    const headers = ["SUBJECT", "FULL", "OBT.", "%", "GRADE"];

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444");
    let y = doc.y;
    headers.forEach((h, i) => doc.text(h, cols[i], y, { width: (cols[i + 1] ?? right) - cols[i] - 4 }));
    y = doc.y + 4;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#dddddd").lineWidth(1).stroke();
    doc.font("Helvetica").fontSize(10).fillColor("#000000");
    doc.y = y + 8;

    for (const row of data.subjects) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 140) doc.addPage();
      const rowY = doc.y;
      const cells = [
        row.examSubject.curriculumSubject.subject.name,
        String(row.examSubject.fullMarks),
        String(row.marks?.obtainedMarks ?? "—"),
        row.grade ? `${row.grade.percentage.toFixed(1)}` : "—",
        row.grade?.grade ?? "—",
      ];
      cells.forEach((c, i) => doc.text(c, cols[i], rowY, { width: (cols[i + 1] ?? right) - cols[i] - 4 }));
      doc.moveDown(0.4);
    }

    doc.moveDown(0.4);
    y = doc.y;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#dddddd").stroke();
    doc.y = y + 10;

    // Totals block, right-aligned
    const labelX = right - 260;
    const valX = right - 110;
    const totalsRow = (label: string, value: string, bold = false) => {
      const rowY = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10);
      doc.text(label, labelX, rowY, { width: 140, align: "right" });
      doc.text(value, valX, rowY, { width: 110, align: "right" });
      doc.moveDown(0.45);
    };
    const rc = data.reportCard;
    totalsRow("Total obtained", `${rc.totalObtainedMarks} / ${rc.totalFullMarks}`);
    totalsRow("Percentage", `${rc.percentage.toFixed(2)}%`);
    totalsRow("Overall grade", rc.overallGrade, true);
    if (rc.overallGpa != null) totalsRow("GPA", n1(rc.overallGpa), true);

    // Per-subject remarks, if any teacher left them
    const withRemarks = data.subjects.filter((s) => s.marks?.remarks?.trim());
    if (withRemarks.length > 0) {
      doc.moveDown(1);
      doc.x = left;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444").text("REMARKS");
      doc.font("Helvetica").fontSize(9).fillColor("#000000");
      for (const s of withRemarks) {
        doc.text(`${s.examSubject.curriculumSubject.subject.name}: ${s.marks?.remarks}`);
      }
    }

    drawFooter(doc);
  });
}
