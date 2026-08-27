import * as ExcelJS from "exceljs";

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
