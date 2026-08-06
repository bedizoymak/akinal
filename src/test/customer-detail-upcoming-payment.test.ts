import { describe, expect, it } from "vitest";
import { sumUpcomingRemaining } from "@/lib/finance";

// QA-B/C BUG-09 regression: the customer detail "YAKLAŞAN ÖDEME" card read summarizeCustomerLedgerEntries().upcoming,
// which (a) only ever returns the single nearest upcoming row's amount rather than summing every
// qualifying row, and (b) — because it works off the synthetic Planlandı row that always carries
// the FULL nominal amount — has no way to express "the unpaid remainder of a partially paid
// record". A demo customer with an unpaid future row (₺400.000) plus a partially paid future row
// (₺100.000 planned / ₺70.000 paid → ₺30.000 remaining) should show ₺430.000; it showed ₺400.000.

function row(overrides: Partial<{
  entry_date: string; amount_try: number; paid_amount_try: number; account_type: string;
}>) {
  return { entry_date: "2026-08-10", amount_try: 0, paid_amount_try: 0, account_type: "resmi", ...overrides };
}

describe("QA-B/C BUG-09 Yaklaşan Ödeme — sums remaining balance across all qualifying rows", () => {
  it("sums a fully-unpaid future row and a partially-paid future row's remainder (QA's exact 430000 case)", () => {
    const total = sumUpcomingRemaining(
      [
        row({ entry_date: "2026-08-10", amount_try: 400000, paid_amount_try: 0 }),
        row({ entry_date: "2026-08-15", amount_try: 100000, paid_amount_try: 70000 }),
      ],
      { today: "2026-08-06" },
    );
    expect(total).toBe(430000);
  });

  it("excludes fully paid and overpaid rows", () => {
    const total = sumUpcomingRemaining(
      [
        row({ entry_date: "2026-08-10", amount_try: 100000, paid_amount_try: 100000 }), // fully paid
        row({ entry_date: "2026-08-10", amount_try: 50000, paid_amount_try: 60000 }),   // overpaid
      ],
      { today: "2026-08-06" },
    );
    expect(total).toBe(0);
  });

  it("excludes past-dated rows and includes a row due exactly today", () => {
    const total = sumUpcomingRemaining(
      [
        row({ entry_date: "2026-08-01", amount_try: 10000, paid_amount_try: 0 }), // past — excluded
        row({ entry_date: "2026-08-06", amount_try: 20000, paid_amount_try: 5000 }), // today — included, remainder 15000
      ],
      { today: "2026-08-06" },
    );
    expect(total).toBe(15000);
  });

  it("scopes by account group (Resmi vs Gayri Resmi) independently", () => {
    const entries = [
      row({ entry_date: "2026-08-10", amount_try: 100000, paid_amount_try: 0, account_type: "resmi" }),
      row({ entry_date: "2026-08-10", amount_try: 50000, paid_amount_try: 0, account_type: "gayri_resmi" }),
    ];
    expect(sumUpcomingRemaining(entries, { today: "2026-08-06", group: "Resmi" })).toBe(100000);
    expect(sumUpcomingRemaining(entries, { today: "2026-08-06", group: "Gayri Resmi" })).toBe(50000);
    expect(sumUpcomingRemaining(entries, { today: "2026-08-06" })).toBe(150000);
  });
});
