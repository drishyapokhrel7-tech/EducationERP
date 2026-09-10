// Printable Fee Invoice and Payment Receipt PDFs. Same pdfkit +
// stream-to-Buffer approach as analytics/export-helpers.ts's toPdf,
// but these are formatted documents (letterhead, billed-to block,
// totals) rather than a bare data table. The letterhead is driven by
// the Organization fields (name/address/phone/email/website/logoUrl)
// that the Institutions > Branding form edits.
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

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

function money(value: Prisma.Decimal | number): string {
  return `NPR ${toNumber(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date): string {
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

// Minimal shapes — whatever FinanceService.getInvoice / the receipt
// query actually return satisfies these structurally.
interface DocStudent {
  firstName: string;
  lastName: string;
  studentCode: string;
}
interface DocItem {
  description: string | null;
  amount: Prisma.Decimal | number;
  feeCategory: { name: string };
}
interface DocDiscount {
  reason: string;
  amount: Prisma.Decimal | number;
}
interface DocPayment {
  receiptNumber: string | null;
  amount: Prisma.Decimal | number;
  method: string;
  reference: string | null;
  paidAt: Date;
}
export interface DocInvoice {
  invoiceNumber: string | null;
  totalAmount: Prisma.Decimal | number;
  dueDate: Date;
  status: string;
  createdAt: Date;
  student: DocStudent;
  items: DocItem[];
  discounts: DocDiscount[];
  payments: DocPayment[];
}

type Doc = InstanceType<typeof PDFDocument>;

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

async function drawLetterhead(doc: Doc, org: LetterheadOrg): Promise<void> {
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

function drawDocTitle(doc: Doc, title: string, ref: string | null, dateLabel: string, dateValue: string): void {
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

function drawBilledTo(doc: Doc, heading: string, student: DocStudent): void {
  const left = doc.page.margins.left;
  doc.x = left;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444").text(heading);
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#000000")
    .text(`${student.firstName} ${student.lastName}`)
    .fontSize(9)
    .fillColor("#444444")
    .text(student.studentCode);
  doc.fillColor("#000000");
  doc.moveDown(1);
}

function drawFooter(doc: Doc): void {
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

function render(build: (doc: Doc) => Promise<void> | void): Promise<Buffer> {
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

export function buildInvoicePdf(org: LetterheadOrg, invoice: DocInvoice): Promise<Buffer> {
  return render(async (doc) => {
    await drawLetterhead(doc, org);
    drawDocTitle(doc, "INVOICE", invoice.invoiceNumber, "Date", formatDate(invoice.createdAt));
    drawBilledTo(doc, "BILLED TO", invoice.student);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const amountX = right - 120;

    // Line-item table
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444");
    let y = doc.y;
    doc.text("DESCRIPTION", left, y);
    doc.text("AMOUNT", amountX, y, { width: 120, align: "right" });
    y = doc.y + 4;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#dddddd").lineWidth(1).stroke();
    doc.font("Helvetica").fontSize(10).fillColor("#000000");
    doc.y = y + 8;

    for (const item of invoice.items) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 120) doc.addPage();
      const rowY = doc.y;
      const label = item.description?.trim() || item.feeCategory.name;
      doc.text(label, left, rowY, { width: amountX - left - 12 });
      doc.text(money(item.amount), amountX, rowY, { width: 120, align: "right" });
      doc.moveDown(0.4);
    }

    doc.moveDown(0.5);
    y = doc.y;
    doc.moveTo(amountX - 60, y).lineTo(right, y).strokeColor("#dddddd").stroke();
    doc.y = y + 8;

    const itemsTotal = invoice.items.reduce((s, i) => s + toNumber(i.amount), 0);
    const discountTotal = invoice.discounts.reduce((s, d) => s + toNumber(d.amount), 0);
    const paidTotal = invoice.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    const balance = toNumber(invoice.totalAmount) - discountTotal - paidTotal;

    const totalsRow = (label: string, value: string, bold = false) => {
      const rowY = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10);
      doc.text(label, amountX - 130, rowY, { width: 120, align: "right" });
      doc.text(value, amountX, rowY, { width: 120, align: "right" });
      doc.moveDown(0.4);
    };
    totalsRow("Subtotal", money(itemsTotal));
    if (discountTotal > 0) totalsRow("Discounts", `- ${money(discountTotal)}`);
    totalsRow("Invoice total", money(invoice.totalAmount));
    if (paidTotal > 0) totalsRow("Amount paid", `- ${money(paidTotal)}`);
    totalsRow("Balance due", money(Math.max(0, balance)), true);

    doc.moveDown(1.5);
    doc.x = left;
    doc.font("Helvetica").fontSize(9).fillColor("#444444");
    doc.text(`Due date: ${formatDate(invoice.dueDate)}`);
    doc.text(`Status: ${invoice.status.replace(/_/g, " ")}`);
    doc.fillColor("#000000");

    if (invoice.payments.length > 0) {
      doc.moveDown(1);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444").text("PAYMENTS RECEIVED");
      doc.font("Helvetica").fontSize(9).fillColor("#000000");
      for (const p of invoice.payments) {
        doc.text(
          `${p.receiptNumber ? `${p.receiptNumber} — ` : ""}${formatDate(p.paidAt)} — ${money(p.amount)} via ${p.method}${p.reference ? ` (${p.reference})` : ""}`,
        );
      }
    }

    drawFooter(doc);
  });
}

export function buildReceiptPdf(org: LetterheadOrg, invoice: DocInvoice, payment: DocPayment): Promise<Buffer> {
  return render(async (doc) => {
    await drawLetterhead(doc, org);
    drawDocTitle(doc, "PAYMENT RECEIPT", payment.receiptNumber, "Date", formatDate(payment.paidAt));
    drawBilledTo(doc, "RECEIVED FROM", invoice.student);

    const left = doc.page.margins.left;

    // Amount, prominent
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#111111").text(money(payment.amount), left, doc.y);
    doc.moveDown(0.75);

    doc.font("Helvetica").fontSize(10).fillColor("#000000");
    const kv = (k: string, v: string) => {
      const rowY = doc.y;
      doc.font("Helvetica-Bold").fillColor("#444444").text(k, left, rowY, { width: 120 });
      doc.font("Helvetica").fillColor("#000000").text(v, left + 130, rowY);
      doc.moveDown(0.5);
    };
    kv("Payment method", payment.method);
    if (payment.reference) kv("Reference", payment.reference);
    kv("Applied to invoice", invoice.invoiceNumber ?? "—");

    const discountTotal = invoice.discounts.reduce((s, d) => s + toNumber(d.amount), 0);
    const paidTotal = invoice.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    const balance = Math.max(0, toNumber(invoice.totalAmount) - discountTotal - paidTotal);
    kv("Invoice total", money(invoice.totalAmount));
    kv("Balance remaining", money(balance));

    drawFooter(doc);
  });
}
