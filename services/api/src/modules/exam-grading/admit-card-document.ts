// Printable Admit Card / Hall Ticket PDF. Shared letterhead / render
// helpers live in common/pdf.ts.
import { type Doc, type LetterheadOrg, drawDocTitle, drawFooter, drawLetterhead, fetchImage, renderPdf } from "../../common/pdf";

interface DocSchedule {
  date: Date;
  startTime: string;
  endTime: string;
  examRooms: { room: { name: string } }[];
}
interface DocAttempt {
  examSubject: {
    curriculumSubject: { subject: { name: string } };
    examSchedule: DocSchedule | null;
  };
}
export interface DocAdmitCard {
  exam: { name: string };
  student: { firstName: string; lastName: string; studentCode: string; photoUrl: string | null };
  subjects: DocAttempt[];
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

export function buildAdmitCardPdf(org: LetterheadOrg, data: DocAdmitCard): Promise<Buffer> {
  return renderPdf(async (doc: Doc) => {
    await drawLetterhead(doc, org);
    drawDocTitle(doc, "ADMIT CARD", data.exam.name, "Issued", fmtDate(new Date()));

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const photoW = 70;
    const photoH = 85;

    // Photo, top-right of the identity block
    const photo = data.student.photoUrl ? await fetchImage(data.student.photoUrl) : null;
    const photoX = right - photoW;
    const photoY = doc.y;
    doc.rect(photoX, photoY, photoW, photoH).lineWidth(1).strokeColor("#999999").stroke();
    if (photo) {
      try {
        doc.image(photo, photoX + 1, photoY + 1, { fit: [photoW - 2, photoH - 2] });
      } catch {
        /* leave the frame empty */
      }
    }

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444").text("CANDIDATE", left, photoY);
    doc
      .font("Helvetica")
      .fontSize(13)
      .fillColor("#000000")
      .text(`${data.student.firstName} ${data.student.lastName}`, left, doc.y, { width: photoX - left - 12 });
    doc.fontSize(9).fillColor("#444444").text(data.student.studentCode, left, doc.y, { width: photoX - left - 12 });

    doc.y = Math.max(doc.y, photoY + photoH) + 20;
    doc.x = left;

    // Schedule table
    const cols = [left, right - 260, right - 160, right - 70];
    const headers = ["SUBJECT", "DATE", "TIME", "ROOM"];
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444");
    let y = doc.y;
    headers.forEach((h, i) => doc.text(h, cols[i], y, { width: (cols[i + 1] ?? right) - cols[i] - 4 }));
    y = doc.y + 4;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#dddddd").lineWidth(1).stroke();
    doc.font("Helvetica").fontSize(10).fillColor("#000000");
    doc.y = y + 8;

    const sorted = [...data.subjects].sort((a, b) => {
      const da = a.examSubject.examSchedule?.date.getTime() ?? Infinity;
      const db = b.examSubject.examSchedule?.date.getTime() ?? Infinity;
      return da - db;
    });

    for (const row of sorted) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 140) doc.addPage();
      const rowY = doc.y;
      const sched = row.examSubject.examSchedule;
      const rooms = sched?.examRooms.map((r) => r.room.name).join(", ") || "—";
      const cells = [
        row.examSubject.curriculumSubject.subject.name,
        sched ? fmtDate(sched.date) : "Not yet scheduled",
        sched ? `${sched.startTime} – ${sched.endTime}` : "—",
        rooms,
      ];
      cells.forEach((c, i) => doc.text(c, cols[i], rowY, { width: (cols[i + 1] ?? right) - cols[i] - 4 }));
      doc.moveDown(0.5);
    }

    doc.moveDown(1.5);
    doc.x = left;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#444444")
      .text("Bring this admit card and a valid ID to every exam session listed above. Arrive at least 15 minutes before the start time.", {
        width: right - left,
      });
    doc.fillColor("#000000");

    drawFooter(doc);
  });
}
