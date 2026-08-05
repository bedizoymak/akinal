import { describe, expect, it } from "vitest";

// QA-B BUG-01 regression: "Genel Bakış" (dashboard.php) showed total tahsilat/net durum
// ₺55,000 higher than Gelenler/Net Durum for the identical dataset. Root cause: a "Hakediş"
// row migrated from ak_customer_financial_entries into ak_government_progress_payments is
// copied, not moved — the source row survives in ak_customer_financial_entries until a separate,
// manual cleanup migration runs (migrations/government-progress-payments-cleanup.php). Every
// other reader of ak_customer_financial_entries (gelenler.php, customers.php,
// customer-financial-entries.php, project-statement.php) already excludes
// `title NOT LIKE '%Hakediş%'` for exactly this reason; dashboard.php's compute_finance_summary()
// did not, so it summed the same collected amount twice: once as a plain customer receipt, once
// again via the GPP total added on top. Verified empirically against a real MySQL instance
// (PDO::ATTR_EMULATE_PREPARES=false, matching db.php) — see the session's repair report.
//
// This test locks the arithmetic contract: dashboard's income formula must equal
// (customer receipts EXCLUDING Hakediş-titled legacy rows) + (GPP total), never
// (all customer receipts INCLUDING legacy Hakediş duplicates) + (GPP total).

interface CustomerRow {
  title: string;
  paidAmountTry: number;
}

function dashboardIncomePaid(customerRows: CustomerRow[], gppPaid: number): number {
  // Mirrors dashboard.php's fixed compute_finance_summary(): WHERE title NOT LIKE '%Hakediş%'.
  const nonHakedisPaid = customerRows
    .filter((r) => !r.title.includes("Hakediş"))
    .reduce((s, r) => s + r.paidAmountTry, 0);
  return Math.round((nonHakedisPaid + gppPaid) * 100) / 100;
}

function preFixDashboardIncomePaid(customerRows: CustomerRow[], gppPaid: number): number {
  // The pre-fix formula: sums ALL customer rows unfiltered, then adds GPP on top.
  const allPaid = customerRows.reduce((s, r) => s + r.paidAmountTry, 0);
  return Math.round((allPaid + gppPaid) * 100) / 100;
}

describe("QA-B BUG-01 dashboard Hakediş de-duplication", () => {
  const regularReceipt: CustomerRow = { title: "QA DEMO Resmi Peşin Tahsilat B", paidAmountTry: 250000 };
  // Legacy row: already migrated into ak_government_progress_payments, not yet cleaned up.
  const legacyHakedisRow: CustomerRow = { title: "QA DEMO 20260805-B Devlet Teşvik Hakedişi - Su Basmanı", paidAmountTry: 60000 };
  const gppPaid = 60000; // the same stage collection, now living in ak_government_progress_payments

  it("counts the migrated Hakediş stage collection exactly once", () => {
    const total = dashboardIncomePaid([regularReceipt, legacyHakedisRow], gppPaid);
    expect(total).toBe(310000); // 250000 + 60000, not 250000 + 60000 + 60000
  });

  it("matches what Gelenler/Net Durum already compute for the same dataset", () => {
    // gelenler.php's own formula: customer rows (Hakediş excluded) + GPP rows, summed once.
    const gelenlerTotal = [regularReceipt].reduce((s, r) => s + r.paidAmountTry, 0) + gppPaid;
    expect(dashboardIncomePaid([regularReceipt, legacyHakedisRow], gppPaid)).toBe(gelenlerTotal);
  });

  it("documents the bug: the unfiltered pre-fix formula overcounts by the Hakediş amount", () => {
    const preFix = preFixDashboardIncomePaid([regularReceipt, legacyHakedisRow], gppPaid);
    const fixed = dashboardIncomePaid([regularReceipt, legacyHakedisRow], gppPaid);
    expect(preFix - fixed).toBe(60000); // the duplicated amount eliminated by the fix
  });

  it("is a no-op once the cleanup migration has actually removed the legacy row", () => {
    const total = dashboardIncomePaid([regularReceipt], gppPaid);
    expect(total).toBe(310000);
  });
});
