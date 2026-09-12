#!/usr/bin/env node
// Post-deploy smoke test — no auth, no captcha, no DB writes.
//
// It exists because the analytics PDF export (and later the invoice /
// receipt PDFs) were broken in production for weeks — a bundling
// failure that only surfaced at runtime — with nothing to catch it.
// This checks two cheap things per route:
//   1. /health returns 200 with database: "ok"
//   2. every protected route below returns 401 (not 404 = route
//      dropped, not 500 = module crashed on cold start / bundle broke)
//
// Usage:  node scripts/smoke.mjs [baseUrl]
//   baseUrl defaults to https://education-erp-api.vercel.app
// Exit code 0 = all good, 1 = something regressed.

const BASE = (process.argv[2] || "https://education-erp-api.vercel.app").replace(/\/$/, "");

// Protected GET routes that should 401 unauthenticated. Kept broad
// enough to notice a whole module failing to register; the PDF /
// export routes are here on purpose — they're the ones that failed
// silently before.
const PROTECTED = [
  "/organizations/me",
  "/organizations/me/campuses",
  "/organizations/me/students/picker",
  "/organizations/me/employees/picker",
  "/organizations/me/invoices",
  "/organizations/me/invoices/x/pdf",
  "/organizations/me/payments/x/receipt",
  "/organizations/me/payroll",
  "/organizations/me/payroll/x/payslip",
  "/organizations/me/students/x/id-card",
  "/organizations/me/exams/x/students/y/report-card/pdf",
  "/organizations/me/exams/x/students/y/admit-card",
  "/organizations/me/fine-rules",
  "/organizations/me/analytics/financial",
  "/organizations/me/analytics/financial/export?format=pdf",
  "/organizations/me/analytics/receivable-aging",
  "/organizations/me/analytics/receivable-aging/export?format=pdf",
  "/organizations/me/accounting/accounts",
  "/organizations/me/accounting/journal-entries",
  "/organizations/me/accounting/reports/trial-balance",
  "/organizations/me/accounting/reports/trial-balance/export?format=pdf",
  "/organizations/me/accounting/reports/balance-sheet",
  "/organizations/me/accounting/reports/balance-sheet/export?format=pdf",
  "/organizations/me/accounting/reports/income-statement",
  "/organizations/me/accounting/reports/income-statement/export?format=pdf",
];

const CRON = ["/internal/apply-late-fees", "/internal/health-watchdog"];

let failures = 0;
const line = (ok, msg) => {
  console.log(`${ok ? "  ok " : "FAIL "} ${msg}`);
  if (!ok) failures++;
};

async function get(path) {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    return { status: res.status, body: await res.text().catch(() => "") };
  } catch (err) {
    return { status: 0, body: String(err) };
  }
}

console.log(`Smoke test: ${BASE}\n`);

// 1. health
{
  const { status, body } = await get("/health");
  let db = "";
  try {
    db = JSON.parse(body).database;
  } catch {
    /* not json */
  }
  line(status === 200 && db === "ok", `/health -> ${status} database=${db || "?"}`);
}

// 2. protected routes: expect 401
for (const path of PROTECTED) {
  const { status } = await get(path);
  line(status === 401, `${path} -> ${status} (expected 401)`);
}

// 3. cron routes: expect 401 (CRON_SECRET-gated), never 404
for (const path of CRON) {
  const { status } = await get(path);
  line(status === 401, `${path} -> ${status} (expected 401)`);
}

console.log("");
if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
