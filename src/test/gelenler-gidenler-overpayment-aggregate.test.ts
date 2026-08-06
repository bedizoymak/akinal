import { describe, expect, it } from "vitest";

// QA-B/C BUG-08 regression: gelenler.php/gidenler.php's gelenler_summary()/gidenler_summary()
// computed total_remaining as SUM(planned) - SUM(paid) across ALL rows at once. An overpaid
// row's negative (planned - paid) contribution silently cancelled out another customer's real
// open debt in the consolidated total — reducing the reported "Kalan Alacak"/"Kalan Borç" by
// exactly the overpaid amount instead of leaving it unaffected. The fix sums
// MAX(planned - paid, 0) per row (never letting a row go negative before summing), and tracks
// the overpaid portion separately (SUM(MAX(paid - planned, 0))) so it stays visible instead of
// vanishing. This mirrors the same per-row-clamp rule the Müşteriler list's "Bekleyen Tahsilat"
// card already used correctly (Math.max(0, customer.balance) per customer).

function summarize(rows: Array<{ planned: number; paid: number }>) {
  let planned = 0, paid = 0, remaining = 0, overpaid = 0;
  for (const r of rows) {
    planned += r.planned;
    paid += r.paid;
    remaining += Math.max(0, r.planned - r.paid);
    overpaid += Math.max(0, r.paid - r.planned);
  }
  return { total_planned: planned, total_paid: paid, total_remaining: remaining, total_overpaid: overpaid };
}

// The old (buggy) formula, kept here only to document what was wrong and to prove this test
// actually discriminates between the two implementations.
function summarizeOldBuggy(rows: Array<{ planned: number; paid: number }>) {
  let planned = 0, paid = 0;
  for (const r of rows) { planned += r.planned; paid += r.paid; }
  return { total_planned: planned, total_paid: paid, total_remaining: planned - paid };
}

describe("QA-B/C BUG-08 Gelenler/Gidenler overpayment aggregate — per-row clamp", () => {
  const overpaidCustomer = { planned: 100000, paid: 120000 }; // QA's exact repro shape
  const otherCustomerWithRealDebt = { planned: 50000, paid: 0 };

  it("an overpayment never masks another record's real open balance", () => {
    const s = summarize([overpaidCustomer, otherCustomerWithRealDebt]);
    expect(s.total_planned).toBe(150000);
    expect(s.total_paid).toBe(120000);
    expect(s.total_remaining).toBe(50000); // NOT 30000 — the other customer's debt is untouched
    expect(s.total_overpaid).toBe(20000);
  });

  it("documents the bug: the old aggregate-then-subtract formula loses exactly the overpaid amount", () => {
    const buggy = summarizeOldBuggy([overpaidCustomer, otherCustomerWithRealDebt]);
    expect(buggy.total_remaining).toBe(30000); // 150000 - 120000 — the bug QA observed
  });

  it("a single fully-paid record contributes zero to both remaining and overpaid", () => {
    const s = summarize([{ planned: 100000, paid: 100000 }]);
    expect(s.total_remaining).toBe(0);
    expect(s.total_overpaid).toBe(0);
  });

  it("multiple overpaid records accumulate correctly in total_overpaid", () => {
    const s = summarize([{ planned: 100000, paid: 120000 }, { planned: 50000, paid: 70000 }]);
    expect(s.total_overpaid).toBe(40000);
    expect(s.total_remaining).toBe(0);
  });
});
