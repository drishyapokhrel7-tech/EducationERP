// Printable Employee Payslip PDF. Shared letterhead / render helpers
// live in common/pdf.ts — the same ones the Fee Invoice / Payment
// Receipt use.
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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface DocEmployee {
  firstName: string;
  lastName: string;
  employeeCode: string;
}
interface DocPayrollItem {
  type: "EARNING" | "DEDUCTION";
  name: string;
  amount: Prisma.Decimal | number;
}
export interface DocPayroll {
  periodMonth: number;
  periodYear: number;
  status: string;
  grossPay: Prisma.Decimal | number | null;
  totalDeductions: Prisma.Decimal | number | null;
  netPay: Prisma.Decimal | number | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  finalizedAt: Date | null;
  createdAt: Date;
  employee: DocEmployee;
  items: DocPayrollItem[];
}

export function buildPayslipPdf(org: LetterheadOrg, payroll: DocPayroll): Promise<Buffer> {
  return renderPdf(async (doc: Doc) => {
    await drawLetterhead(doc, org);

    const period = `${MONTHS[payroll.periodMonth - 1] ?? payroll.periodMonth} ${payroll.periodYear}`;
    const asOf = payroll.paidAt ?? payroll.finalizedAt ?? payroll.createdAt;
    drawDocTitle(doc, "PAYSLIP", `Pay period: ${period}`, "Date", formatDate(asOf));
    drawPartyBlock(doc, "EMPLOYEE", [
      `${payroll.employee.firstName} ${payroll.employee.lastName}`,
      payroll.employee.employeeCode,
    ]);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const amountX = right - 120;

    const section = (heading: string, rows: DocPayrollItem[], totalLabel: string, totalValue: Prisma.Decimal | number) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444");
      let y = doc.y;
      doc.text(heading, left, y);
      doc.text("AMOUNT", amountX, y, { width: 120, align: "right" });
      y = doc.y + 4;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#dddddd").lineWidth(1).stroke();
      doc.font("Helvetica").fontSize(10).fillColor("#000000");
      doc.y = y + 8;
      if (rows.length === 0) {
        doc.fillColor("#888888").text("—", left);
        doc.fillColor("#000000");
      }
      for (const row of rows) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 140) doc.addPage();
        const rowY = doc.y;
        doc.text(row.name, left, rowY, { width: amountX - left - 12 });
        doc.text(money(row.amount), amountX, rowY, { width: 120, align: "right" });
        doc.moveDown(0.4);
      }
      doc.moveDown(0.3);
      const ty = doc.y;
      doc.moveTo(amountX - 130, ty).lineTo(right, ty).strokeColor("#dddddd").stroke();
      doc.y = ty + 6;
      const trY = doc.y;
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text(totalLabel, amountX - 130, trY, { width: 120, align: "right" });
      doc.text(money(totalValue), amountX, trY, { width: 120, align: "right" });
      doc.moveDown(1.2);
    };

    const earnings = payroll.items.filter((i) => i.type === "EARNING");
    const deductions = payroll.items.filter((i) => i.type === "DEDUCTION");
    const gross = payroll.grossPay ?? earnings.reduce((s, i) => s + toNumber(i.amount), 0);
    const totalDed = payroll.totalDeductions ?? deductions.reduce((s, i) => s + toNumber(i.amount), 0);
    const net = payroll.netPay ?? toNumber(gross) - toNumber(totalDed);

    section("EARNINGS", earnings, "Gross pay", gross);
    section("DEDUCTIONS", deductions, "Total deductions", totalDed);

    // Net pay, prominent
    const npY = doc.y;
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111111");
    doc.text("NET PAY", left, npY);
    doc.text(money(net), amountX - 130, npY, { width: 250, align: "right" });
    doc.fillColor("#000000");
    doc.moveDown(1.5);

    doc.x = left;
    doc.font("Helvetica").fontSize(9).fillColor("#444444");
    if (payroll.paymentMethod) doc.text(`Payment method: ${payroll.paymentMethod}`);
    if (payroll.paidAt) doc.text(`Paid on: ${formatDate(payroll.paidAt)}`);
    doc.text(`Status: ${payroll.status}`);
    doc.fillColor("#000000");

    drawFooter(doc);
  });
}
