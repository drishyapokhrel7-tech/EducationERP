// Shared pdfkit helpers for the app's formatted PDF documents (Fee
// Invoice, Payment Receipt, Employee Payslip) — the letterhead, the
// billed-to / received-from block, the footer, and the
// stream-to-Buffer render loop. Distinct from
// analytics/export-helpers.ts's toPdf, which is a bare data-table
// dump; these documents carry the org's letterhead (the Organization
// name/address/phone/email/website/logoUrl the Institutions > Branding
// form edits).
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require("pdfkit");
import type { Prisma } from "@prisma/client";

// pdfkit loads its standard-font metric files (Helvetica etc.) with a
// require() whose path it builds at runtime, so Vercel's file tracer
// never bundled js/standard-fonts/*.cjs and doc.font("Helvetica")
// threw "Cannot find module .../Helvetica.cjs" in production. These
// string-literal require.resolve() calls ARE traceable, so nft
// includes the files (also covered by includeFiles in vercel.json —
// belt and suspenders). Wrapped in try/catch for non-bundled
// environments (local dev, tests); the return value is never used.
function pinPdfkitFonts(): void {
  try {
    require.resolve("pdfkit/js/standard-fonts/Helvetica.cjs");
    require.resolve("pdfkit/js/standard-fonts/Helvetica-Bold.cjs");
    require.resolve("pdfkit/js/standard-fonts/Helvetica-Oblique.cjs");
    require.resolve("pdfkit/js/standard-fonts/Helvetica-BoldOblique.cjs");
  } catch {
    /* not bundled here — fine */
  }
}
pinPdfkitFonts();

export type Doc = InstanceType<typeof PDFDocument>;

export function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export function money(value: Prisma.Decimal | number): string {
  return `NPR ${toNumber(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export interface LetterheadOrg {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
}

// Best-effort — a letterhead logo is nice, never load-bearing. Any
// failure (bad URL, slow host, non-image bytes) just falls through to
// the text-only letterhead.
async function fetchLogo(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 && buf.length < 5 * 1024 * 1024 ? buf : null;
  } catch {
    return null;
  }
}

export async function drawLetterhead(doc: Doc, org: LetterheadOrg): Promise<void> {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const logo = org.logoUrl ? await fetchLogo(org.logoUrl) : null;
  let textX = left;
  if (logo) {
    try {
      doc.image(logo, left, top, { fit: [110, 55] });
      textX = left + 125;
    } catch {
      textX = left;
    }
  }
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111111").text(org.name, textX, top, { width: 340 });
  doc.font("Helvetica").fontSize(9).fillColor("#444444");
  const lines = [org.address, org.phone, org.email, org.website].filter((v): v is string => !!v && v.trim().length > 0);
  for (const line of lines) doc.text(line, textX, doc.y, { width: 340 });

  const dividerY = Math.max(doc.y, top + 60) + 8;
  doc
    .moveTo(left, dividerY)
    .lineTo(doc.page.width - doc.page.margins.right, dividerY)
    .strokeColor("#cccccc")
    .lineWidth(1)
    .stroke();
  doc.fillColor("#000000");
  doc.x = left;
  doc.y = dividerY + 16;
}

export function drawDocTitle(doc: Doc, title: string, ref: string | null, dateLabel: string, dateValue: string): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111111").text(title, left, y);
  doc.font("Helvetica").fontSize(9).fillColor("#444444");
  if (ref) doc.text(ref, left, y, { width: right - left, align: "right" });
  doc.text(`${dateLabel}: ${dateValue}`, left, doc.y, { width: right - left, align: "right" });
  doc.fillColor("#000000");
  doc.x = left;
  doc.moveDown(1);
}

// A "BILLED TO" / "RECEIVED FROM" / "EMPLOYEE" block: bold heading,
// first line at 11pt black, the rest at 9pt grey.
export function drawPartyBlock(doc: Doc, heading: string, lines: string[]): void {
  const left = doc.page.margins.left;
  doc.x = left;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444").text(heading);
  doc.font("Helvetica").fontSize(11).fillColor("#000000").text(lines[0] ?? "");
  doc.fontSize(9).fillColor("#444444");
  for (const line of lines.slice(1)) doc.text(line);
  doc.fillColor("#000000");
  doc.moveDown(1);
}

export function drawFooter(doc: Doc): void {
  const left = doc.page.margins.left;
  const bottom = doc.page.height - doc.page.margins.bottom;
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#999999")
    .text("This is a computer-generated document and does not require a signature.", left, bottom - 14, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      align: "center",
    });
  doc.fillColor("#000000");
}

export function renderPdf(build: (doc: Doc) => Promise<void> | void): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    void (async () => {
      try {
        await build(doc);
        doc.end();
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  });
}
