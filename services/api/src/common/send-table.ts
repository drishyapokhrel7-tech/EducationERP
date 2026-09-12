import { BadRequestException } from "@nestjs/common";
import type { Response } from "express";
import { ExportTable, toCsv, toPdf, toXlsx } from "../modules/analytics/export-helpers";

// Extracted from AnalyticsController's own private method (which
// wrapped this with its report-exported audit-log signal) so
// AccountingController's report exports (Trial Balance/Balance
// Sheet/Income Statement) can reuse the exact same csv/xlsx/pdf
// format-switch instead of duplicating it — no behavior change to
// analytics' own exports, which now just call this then log.
export async function sendTableResponse(
  res: Response,
  table: ExportTable,
  filenameBase: string,
  title: string,
  format: string,
): Promise<void> {
  if (format === "xlsx") {
    const buffer = await toXlsx(table, filenameBase);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
    return;
  }
  if (format === "csv") {
    res.set("Content-Type", "text/csv");
    res.set("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
    res.send(toCsv(table));
    return;
  }
  if (format === "pdf") {
    const buffer = await toPdf(table, title);
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `attachment; filename="${filenameBase}.pdf"`);
    res.send(buffer);
    return;
  }
  throw new BadRequestException('format must be "csv", "xlsx", or "pdf"');
}
