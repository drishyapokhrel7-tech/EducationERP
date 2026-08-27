import * as ExcelJS from "exceljs";
// pdfkit's type declarations use `export =`, so the correct import
// form without esModuleInterop (not set in this project's tsconfig,
// same as the existing argon2/csv-parse imports elsewhere) is
// `import X = require(...)`, not a default or namespace import —
// this is TypeScript's own `import ... = require(...)` syntax, not a
// plain CommonJS `require()` call, but the lint rule can't tell the
// difference.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require("pdfkit");

export interface ExportTable {
  headers: string[];
  rows: (string | number)[][];
}

// Hand-rolled, no library — same pattern as students.service.ts's
// exportStudentsCsv (this project's one existing CSV-export
// precedent), generalized to any headers/rows shape.
export function toCsv(table: ExportTable): string {
  const escape = (field: string | number) => {
    const s = String(field);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [table.headers.map(escape).join(","), ...table.rows.map((row) => row.map(escape).join(","))];
  return lines.join("\n");
}

export async function toXlsx(table: ExportTable, sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(table.headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of table.rows) sheet.addRow(row);
  sheet.columns.forEach((column) => {
    column.width = 20;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// A simple, honest table layout — no attempt at column-width auto-
// sizing or multi-page pagination beyond PDFKit's own automatic page
// breaks. This is a plain tabular report (the same data as the csv/
// xlsx exports), not a formatted document; a genuinely designed
// report-card-style PDF is a different, unrequested scope.
export function toPdf(table: ExportTable, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(title, { align: "left" });
    doc.moveDown();

    const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / table.headers.length;
    const startX = doc.page.margins.left;

    doc.fontSize(10).font("Helvetica-Bold");
    let y = doc.y;
    table.headers.forEach((header, i) => {
      doc.text(String(header), startX + i * columnWidth, y, { width: columnWidth });
    });
    doc.moveDown(0.5);
    doc.font("Helvetica");

    for (const row of table.rows) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }
      y = doc.y;
      row.forEach((cell, i) => {
        doc.text(String(cell), startX + i * columnWidth, y, { width: columnWidth });
      });
      doc.moveDown(0.5);
    }

    doc.end();
  });
}
