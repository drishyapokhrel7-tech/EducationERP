import * as ExcelJS from "exceljs";

// Generalizes the exact pattern StudentsService.generateImportTemplate/
// parseXlsxRows originated (still the one place this was hand-written
// before this file existed) — a declarative column list drives both
// directions: building a downloadable workbook (blank template, or
// pre-filled with current data for a true edit-and-resync loop) and
// parsing an uploaded one back into plain rows, so any entity module
// wanting an Excel round-trip just describes its columns once instead of
// hand-rolling exceljs calls.
export interface ColumnSpec {
  key: string;
  header: string;
  width?: number;
  note?: string;
  // Native Excel in-cell dropdown (Data Validation) — same
  // `dataValidation: { type: "list", formulae: [...] }` technique the
  // original students.service.ts used for Gender, generalized to any
  // fixed option list (an enum, or names resolved from a DB table).
  dropdownOptions?: string[];
}

// Rows past the real data that still carry the dropdown/formatting, so
// pasting or typing further down in Excel doesn't lose it — matches the
// original 500-row precedent.
const BLANK_ROWS_WITH_VALIDATION = 500;

export async function buildWorkbook(
  sheetName: string,
  columns: ColumnSpec[],
  rows: Record<string, string>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(columns.map((c) => c.header));
  sheet.getRow(1).font = { bold: true };
  sheet.columns = columns.map((c) => ({ width: c.width ?? 18 }));

  columns.forEach((c, i) => {
    if (c.note) sheet.getCell(1, i + 1).note = c.note;
  });

  for (const row of rows) {
    sheet.addRow(columns.map((c) => row[c.key] ?? ""));
  }

  const lastDataRow = Math.max(rows.length, 0) + 1;
  const lastValidatedRow = lastDataRow + BLANK_ROWS_WITH_VALIDATION;
  columns.forEach((c, i) => {
    if (!c.dropdownOptions || c.dropdownOptions.length === 0) return;
    const colNumber = i + 1;
    for (let rowNumber = 2; rowNumber <= lastValidatedRow; rowNumber++) {
      sheet.getCell(rowNumber, colNumber).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${c.dropdownOptions.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: `Invalid ${c.header}`,
        error: `Please pick one of: ${c.dropdownOptions.join(", ")}`,
      };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function cellValueToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text;
  if (typeof value === "object" && "result" in value && typeof value.result === "string") return value.result;
  return "";
}

// Combines several single-sheet workbooks (each produced by
// buildWorkbook) into one multi-sheet workbook — used by the combined
// data-sync template/export, which is just each entity's own existing
// template/export buffer stitched together, not a separately-maintained
// column list. Reassigning `.model` (with a fresh id/name) is exceljs's
// documented way to move a worksheet's full content — cells, notes, and
// data validations alike — into a different workbook.
export async function mergeWorkbooks(buffers: Buffer[]): Promise<Buffer> {
  const combined = new ExcelJS.Workbook();
  for (const buf of buffers) {
    const source = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- same Multer-Buffer/@types/node generic mismatch as parseWorkbookRows
    await source.xlsx.load(buf as any);
    const sheet = source.worksheets[0];
    if (!sheet) continue;
    const target = combined.addWorksheet(sheet.name);
    target.model = { ...sheet.model, id: target.id, name: sheet.name };
  }
  const buffer = await combined.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// The inverse of mergeWorkbooks — pulls one named sheet back out of an
// uploaded combined workbook as its own single-sheet buffer, so it can
// be handed unchanged to that entity's existing importX(fileBuffer)
// method. Returns null if the sheet isn't present (the user is allowed
// to fill in only some of the combined template's sheets).
export async function extractSheetBuffer(buffer: Buffer, sheetName: string): Promise<Buffer | null> {
  const source = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- same Multer-Buffer/@types/node generic mismatch as parseWorkbookRows
    await source.xlsx.load(buffer as any);
  } catch (err) {
    throw new Error(`Could not parse Excel file: ${(err as Error).message}`);
  }
  const sheet = source.worksheets.find((s) => s.name.trim().toLowerCase() === sheetName.trim().toLowerCase());
  if (!sheet) return null;

  const target = new ExcelJS.Workbook();
  const targetSheet = target.addWorksheet(sheet.name);
  targetSheet.model = { ...sheet.model, id: targetSheet.id, name: sheet.name };
  const out = await target.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function parseWorkbookRows(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- same Multer-Buffer/@types/node generic mismatch as students.service.ts's own parseXlsxRows
    await workbook.xlsx.load(buffer as any);
  } catch (err) {
    throw new Error(`Could not parse Excel file: ${(err as Error).message}`);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The uploaded workbook has no sheets");

  const headerRow = sheet.getRow(1);
  const columns: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    columns[colNumber] = cellValueToString(cell.value).trim();
  });

  const records: Record<string, string>[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const record: Record<string, string> = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = columns[colNumber];
      if (!key) return;
      const raw = cell.value;
      const value = raw instanceof Date ? raw.toISOString().slice(0, 10) : cellValueToString(raw).trim();
      if (value) hasAnyValue = true;
      record[key] = value;
    });
    if (hasAnyValue) records.push(record);
  }
  return records;
}
