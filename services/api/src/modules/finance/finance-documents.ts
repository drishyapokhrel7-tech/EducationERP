// Printable Fee Invoice and Payment Receipt PDFs. Shared letterhead /
// party-block / footer / render helpers live in common/pdf.ts.
import type { Prisma } from "@prisma/client";
import {
  type Doc,
  type LetterheadOrg,
  drawDocTitle,
  drawFooter,
  drawLetterhead,
  drawPartyBlock,
  formatDate,
  money,
  renderPdf,
  toNumber,
} from "../../common/pdf";

export type { LetterheadOrg };

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

export function buildInvoicePdf(org: LetterheadOrg, invoice: DocInvoice): Promise<Buffer> {
  return renderPdf(async (doc: Doc) => {
    await drawLetterhead(doc, org);
    drawDocTitle(doc, "INVOICE", invoice.invoiceNumber, "Date", formatDate(invoice.createdAt));
    drawPartyBlock(doc, "BILLED TO", [`${invoice.student.firstName} ${invoice.student.lastName}`, invoice.student.studentCode]);

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
  return renderPdf(async (doc: Doc) => {
    await drawLetterhead(doc, org);
    drawDocTitle(doc, "PAYMENT RECEIPT", payment.receiptNumber, "Date", formatDate(payment.paidAt));
    drawPartyBlock(doc, "RECEIVED FROM", [
      `${invoice.student.firstName} ${invoice.student.lastName}`,
      invoice.student.studentCode,
    ]);

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
