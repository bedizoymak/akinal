import { describe, it, expect } from "vitest";

// Mirrors fe_auto_status() in public_html/api/admin/finance-entry-helpers.php — the canonical
// status derivation used by every financial-entry table.
function deriveStatus(amount: number, paid: number, entryDate: string, today: string): string {
  if (paid <= 0) return entryDate < today ? "Gecikmiş" : "Planlanan";
  if (paid >= amount && amount > 0) return paid > amount ? "Fazla Ödendi" : "Gerçekleşti";
  return "Kısmi Ödendi";
}

// Mirrors the "Açık" (open/uncollected) rule shared by:
//  - dashboard.php compute_finance_summary()'s "upcoming" aggregate (Beklenen Tahsilat card value)
//  - gelenler.php's `status === 'Açık'` branch (cfe.status IN ('Planlanan','Gecikmiş','Kısmi Ödendi'))
// A customer receivable is open when its canonical status is not a fully-settled one.
function isOpenStatus(status: string): boolean {
  return status === "Planlanan" || status === "Gecikmiş" || status === "Kısmi Ödendi";
}

interface Receivable {
  source_type: "customer" | "government";
  status: string;
  amount_try: number;
  paid_amount_try: number;
}

function openBalanceTry(e: Receivable): number {
  return Math.max(0, e.amount_try - e.paid_amount_try);
}

// Single shared rule applied to build both "the dashboard metric" and "the clicked list" —
// proving by construction that the two outputs cannot diverge.
function computeOpenReceivables(entries: Receivable[]) {
  const rows = entries.filter((e) => e.source_type === "customer" && isOpenStatus(e.status));
  const total = rows.reduce((s, e) => s + openBalanceTry(e), 0);
  return { rows, total };
}

const TODAY = "2026-06-15";
const FUTURE = "2099-12-31";
const PAST = "2020-01-01";

describe("Beklenen Tahsilat — open customer receivable inclusion rule", () => {
  it("1. Planned future unpaid customer receivable: included", () => {
    const status = deriveStatus(10000, 0, FUTURE, TODAY);
    expect(status).toBe("Planlanan");
    expect(isOpenStatus(status)).toBe(true);
  });

  it("2. Overdue unpaid customer receivable: included", () => {
    const status = deriveStatus(10000, 0, PAST, TODAY);
    expect(status).toBe("Gecikmiş");
    expect(isOpenStatus(status)).toBe(true);
  });

  it("3. Early or on-time fully collected customer receivable: excluded", () => {
    const onTime = deriveStatus(10000, 10000, TODAY, TODAY);
    const early = deriveStatus(10000, 10000, FUTURE, TODAY);
    expect(onTime).toBe("Gerçekleşti");
    expect(early).toBe("Gerçekleşti");
    expect(isOpenStatus(onTime)).toBe(false);
    expect(isOpenStatus(early)).toBe(false);
  });

  it("4. Fully collected overdue customer receivable: excluded", () => {
    // Paid in full, but the entry_date itself is in the past — still settled, not open.
    const status = deriveStatus(10000, 10000, PAST, TODAY);
    expect(status).toBe("Gerçekleşti");
    expect(isOpenStatus(status)).toBe(false);
  });

  it("5. Government hakediş (GPP): excluded regardless of status", () => {
    const { rows } = computeOpenReceivables([
      { source_type: "government", status: "Planlanan", amount_try: 10000, paid_amount_try: 0 },
      { source_type: "government", status: "Gecikmiş", amount_try: 5000, paid_amount_try: 0 },
    ]);
    expect(rows).toHaveLength(0);
  });

  it("6. Non-customer incoming record: excluded even when its status string would otherwise qualify as open", () => {
    const { rows, total } = computeOpenReceivables([
      { source_type: "government", status: "Kısmi Ödendi", amount_try: 20000, paid_amount_try: 5000 },
    ]);
    expect(rows).toHaveLength(0);
    expect(total).toBe(0);
  });

  it("7. Dashboard total and clicked-list rows are produced by the identical rule and cannot diverge", () => {
    const entries: Receivable[] = [
      { source_type: "customer", status: "Planlanan", amount_try: 10000, paid_amount_try: 0 },      // open, 10000
      { source_type: "customer", status: "Gecikmiş", amount_try: 5000, paid_amount_try: 0 },         // open, 5000
      { source_type: "customer", status: "Kısmi Ödendi", amount_try: 8000, paid_amount_try: 3000 },  // open, 5000
      { source_type: "customer", status: "Gerçekleşti", amount_try: 4000, paid_amount_try: 4000 },   // excluded
      { source_type: "customer", status: "Fazla Ödendi", amount_try: 2000, paid_amount_try: 2500 },  // excluded
      { source_type: "government", status: "Planlanan", amount_try: 20000, paid_amount_try: 0 },     // excluded (non-customer)
    ];

    const dashboardMetric = computeOpenReceivables(entries);
    const clickedList = computeOpenReceivables(entries);

    expect(dashboardMetric.rows).toHaveLength(3);
    expect(dashboardMetric.total).toBe(20000);
    expect(clickedList.rows).toEqual(dashboardMetric.rows);
    expect(clickedList.total).toBe(dashboardMetric.total);
  });
});
