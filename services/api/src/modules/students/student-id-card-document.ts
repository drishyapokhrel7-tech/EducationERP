// Printable Student Identity Card PDF — a single card, centred on an
// A4 page so it can be printed and cut. Uses the shared common/pdf
// letterhead org fields + fetchImage helper.
import { type Doc, type LetterheadOrg, fetchImage, formatDate, renderPdf } from "../../common/pdf";

export interface DocIdCardStudent {
  firstName: string;
  lastName: string;
  studentCode: string;
  photoUrl: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  programName: string | null;
  sectionName: string | null;
}

export function buildStudentIdCardPdf(org: LetterheadOrg, student: DocIdCardStudent): Promise<Buffer> {
  return renderPdf(async (doc: Doc) => {
    const [logo, photo] = await Promise.all([
      org.logoUrl ? fetchImage(org.logoUrl) : Promise.resolve(null),
      student.photoUrl ? fetchImage(student.photoUrl) : Promise.resolve(null),
    ]);

    // Card geometry — ~ ISO ID-1 proportions, scaled up.
    const cardW = 380;
    const cardH = 240;
    const cardX = (doc.page.width - cardW) / 2;
    const cardY = 90;
    const pad = 16;

    doc.roundedRect(cardX, cardY, cardW, cardH, 10).lineWidth(1).strokeColor("#333333").stroke();

    // Header band
    doc.rect(cardX, cardY, cardW, 44).fillColor("#1e3a5f").fill();
    let headerTextX = cardX + pad;
    if (logo) {
      try {
        doc.image(logo, cardX + pad, cardY + 8, { fit: [28, 28] });
        headerTextX = cardX + pad + 36;
      } catch {
        headerTextX = cardX + pad;
      }
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#ffffff")
      .text(org.name, headerTextX, cardY + 15, { width: cardW - (headerTextX - cardX) - pad, ellipsis: true });

    // Photo
    const photoW = 96;
    const photoH = 116;
    const photoX = cardX + pad;
    const photoY = cardY + 60;
    doc.rect(photoX, photoY, photoW, photoH).lineWidth(1).strokeColor("#999999").stroke();
    if (photo) {
      try {
        doc.image(photo, photoX + 1, photoY + 1, { fit: [photoW - 2, photoH - 2], align: "center", valign: "center" });
      } catch {
        /* leave the empty frame */
      }
    } else {
      doc.font("Helvetica").fontSize(8).fillColor("#999999").text("No photo", photoX, photoY + photoH / 2 - 4, {
        width: photoW,
        align: "center",
      });
    }

    // Details
    const dx = photoX + photoW + pad;
    const dw = cardX + cardW - pad - dx;
    let dy = photoY + 2;
    const field = (label: string, value: string) => {
      doc.font("Helvetica").fontSize(7).fillColor("#666666").text(label.toUpperCase(), dx, dy, { width: dw });
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(value, dx, doc.y, { width: dw, ellipsis: true });
      dy = doc.y + 8;
    };
    field("Name", `${student.firstName} ${student.lastName}`);
    field("Student ID", student.studentCode);
    if (student.programName) {
      field("Class", [student.programName, student.sectionName].filter(Boolean).join(" · "));
    }
    if (student.dateOfBirth) field("Date of birth", formatDate(student.dateOfBirth));
    if (student.gender) field("Gender", student.gender);

    // Footer caption
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666666")
      .text("Student Identity Card", cardX, cardY + cardH - 18, { width: cardW, align: "center" });

    doc.fillColor("#000000");
  });
}
