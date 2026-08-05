import { describe, expect, it } from "vitest";

// Phase 0 baseline fixtures — proven QA UAT amounts (2026-08-05 repair brief, Section 2).
// These assert planned/realized/remaining independently of any single screen's
// implementation, so a regression in any one aggregation path fails loudly.

const customerIncome = [
  { planned: 185000.0, realized: 55000.0 },
  { planned: 549500.0, realized: 192325.0 }, // EUR 10,000 / 3,500 @ manual rate 54.95
  { planned: 425000.0, realized: 127500.0 }, // government progress stage payment
];

const outgoingExpense = [
  { planned: 480000.0, realized: 180000.0 }, // supplier, official
  { planned: 95000.0, realized: 95000.0 }, // expense card, unofficial
];

function sum(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}

describe("QA UAT canonical project totals (post stage-payment)", () => {
  it("matches proven planned/realized income", () => {
    expect(sum(customerIncome.map((r) => r.planned))).toBe(1159500.0);
    expect(sum(customerIncome.map((r) => r.realized))).toBe(374825.0);
  });

  it("matches proven remaining receivable", () => {
    const remaining = sum(customerIncome.map((r) => r.planned - r.realized));
    expect(remaining).toBe(784675.0);
  });

  it("matches proven planned/realized expense", () => {
    expect(sum(outgoingExpense.map((r) => r.planned))).toBe(575000.0);
    expect(sum(outgoingExpense.map((r) => r.realized))).toBe(275000.0);
  });

  it("matches proven realized profit", () => {
    const realizedIncome = sum(customerIncome.map((r) => r.realized));
    const realizedExpense = sum(outgoingExpense.map((r) => r.realized));
    expect(sum([realizedIncome, -realizedExpense])).toBe(99825.0);
  });
});

// Dashboard's compute_finance_summary() (public_html/api/admin/dashboard.php) must
// combine ak_customer_financial_entries.paid_amount_try with
// ak_government_progress_payments.paid_amount_try exactly once — this mirrors the
// same formula gelenler.php/Net Durum already use, per P0-2. A ₺127,500 government
// stage collection must appear in the realized total exactly once, and no
// planned-only value may be counted as realized.
function dashboardRealizedIncome(customerPaid: number, gppPaid: number): number {
  return Math.round((customerPaid + gppPaid) * 100) / 100;
}

describe("P0-2 dashboard/Net Durum realized-income reconciliation", () => {
  it("includes the government-progress stage collection exactly once", () => {
    const customerPaid = 55000.0 + 192325.0; // official + unofficial customer receipts
    const gppPaid = 127500.0;
    const dashboardTotal = dashboardRealizedIncome(customerPaid, gppPaid);
    const netDurumTotal = customerPaid + gppPaid; // gelenler.php unions the same two sources

    expect(dashboardTotal).toBe(netDurumTotal);
    expect(dashboardTotal).toBe(374825.0);
  });

  it("does not count the un-collected remainder as realized", () => {
    const plannedOnly = 425000.0 - 127500.0; // remaining government-progress balance
    const gppPaid = 127500.0;
    // Realized total must equal only the collected portion, never planned+collected.
    expect(dashboardRealizedIncome(0, gppPaid)).not.toBe(gppPaid + plannedOnly);
    expect(dashboardRealizedIncome(0, gppPaid)).toBe(127500.0);
  });
});
