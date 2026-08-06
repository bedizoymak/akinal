import { describe, it, expect } from "vitest";

// Mirrors the corrected "Vadesi Geçen Alacak" rule in dashboard.php
// (compute_finance_summary()'s overdue_remaining/overdue_count, and
// fetch_customer_entries_overdue()) and gelenler.php's `status === 'Gecikmiş'`
// branch — all three now share this exact live date/balance comparison instead
// of trusting the stored `is_overdue`/`status` columns, which are write-time
// snapshots that go stale as soon as "today" advances past entry_date without
// the row being re-saved (see finance-entry-helpers.php fe_is_overdue()).
//
// A receivable is overdue-and-outstanding when ALL of:
//   - entry_date (due date) is earlier than today (Europe/Istanbul)
//   - amount_try > paid_amount_try
//   - remaining balance (amount_try - paid_amount_try) > 0
// The remaining balance — not the full amount — is what counts, so a partial
// payment reduces the overdue figure instead of excluding the row entirely.

interface Receivable {
  source_type: "customer" | "government";
  entry_date: string;
  amount_try: number;
  paid_amount_try: number;
}

function remainingTry(e: Receivable): number {
  return Math.max(0, e.amount_try - e.paid_amount_try);
}

function isOverdue(e: Receivable, today: string): boolean {
  return e.entry_date < today && e.amount_try > e.paid_amount_try;
}

// Single shared rule applied to build both "the dashboard card total" and "the
// clicked Gelenler list" — proving by construction the two outputs cannot diverge.
function computeOverdueReceivables(entries: Receivable[], today: string) {
  const rows = entries.filter((e) => e.source_type === "customer" && isOverdue(e, today));
  const total = rows.reduce((s, e) => s + remainingTry(e), 0);
  return { rows, total, count: rows.length };
}

const TODAY = "2026-08-06";
const YESTERDAY = "2026-08-05";
const TOMORROW = "2026-08-07";

describe("Vadesi Geçen Alacak — overdue customer receivable inclusion rule", () => {
  it("1. Unpaid overdue receivable: included at its full amount", () => {
    const e: Receivable = { source_type: "customer", entry_date: YESTERDAY, amount_try: 10000, paid_amount_try: 0 };
    expect(isOverdue(e, TODAY)).toBe(true);
    expect(remainingTry(e)).toBe(10000);
  });

  it("2. Partially paid overdue receivable: included using only the unpaid remaining balance", () => {
    // Exact example from the bug report: due yesterday, total 10000, paid 4000 -> 6000 overdue.
    const e: Receivable = { source_type: "customer", entry_date: YESTERDAY, amount_try: 10000, paid_amount_try: 4000 };
    expect(isOverdue(e, TODAY)).toBe(true);
    expect(remainingTry(e)).toBe(6000);
  });

  it("3. Fully paid overdue receivable: excluded (remaining balance is zero)", () => {
    // Due yesterday, total 10000, paid 10000 -> must not be included.
    const e: Receivable = { source_type: "customer", entry_date: YESTERDAY, amount_try: 10000, paid_amount_try: 10000 };
    expect(isOverdue(e, TODAY)).toBe(false);
  });

  it("4. Due today: excluded (not yet overdue)", () => {
    const e: Receivable = { source_type: "customer", entry_date: TODAY, amount_try: 10000, paid_amount_try: 0 };
    expect(isOverdue(e, TODAY)).toBe(false);
  });

  it("5. Future due date: excluded", () => {
    const e: Receivable = { source_type: "customer", entry_date: TOMORROW, amount_try: 10000, paid_amount_try: 2000 };
    expect(isOverdue(e, TODAY)).toBe(false);
  });

  it("6. Government hakediş (GPP): excluded from this customer-only card regardless of due date/balance", () => {
    const { rows } = computeOverdueReceivables(
      [{ source_type: "government", entry_date: YESTERDAY, amount_try: 5000, paid_amount_try: 0 }],
      TODAY,
    );
    expect(rows).toHaveLength(0);
  });

  it("7. Overpaid overdue row: excluded (paid > amount, no outstanding remaining balance)", () => {
    const e: Receivable = { source_type: "customer", entry_date: YESTERDAY, amount_try: 10000, paid_amount_try: 12000 };
    expect(isOverdue(e, TODAY)).toBe(false);
  });

  it("8. Dashboard card total/count and the clicked Gelenler list are produced by the identical rule and cannot diverge", () => {
    const entries: Receivable[] = [
      { source_type: "customer", entry_date: YESTERDAY, amount_try: 10000, paid_amount_try: 0 },      // overdue, unpaid: 10000
      { source_type: "customer", entry_date: YESTERDAY, amount_try: 10000, paid_amount_try: 4000 },    // overdue, partial: 6000
      { source_type: "customer", entry_date: YESTERDAY, amount_try: 10000, paid_amount_try: 10000 },   // fully paid: excluded
      { source_type: "customer", entry_date: TODAY, amount_try: 5000, paid_amount_try: 0 },             // due today: excluded
      { source_type: "customer", entry_date: TOMORROW, amount_try: 5000, paid_amount_try: 0 },          // future: excluded
      { source_type: "government", entry_date: YESTERDAY, amount_try: 20000, paid_amount_try: 0 },      // non-customer: excluded
    ];

    const dashboardCard = computeOverdueReceivables(entries, TODAY);
    const clickedList = computeOverdueReceivables(entries, TODAY);

    expect(dashboardCard.count).toBe(2);
    expect(dashboardCard.total).toBe(16000);
    expect(clickedList.rows).toEqual(dashboardCard.rows);
    expect(clickedList.total).toBe(dashboardCard.total);
  });
});
