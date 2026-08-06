import { describe, expect, it } from "vitest";
import { cardEntriesToLedgerEntries, summarizeCustomerLedgerEntries } from "@/lib/finance";

// QA-B/C BUG-03 regression: the customer detail page's "Genel Hesap Özeti" KPI cards
// (Toplam Alacak / Tahsil Edilen) fed summarizeCustomerLedgerEntries() from a
// `financialEntries` snapshot loaded once via customers.php and never refreshed after
// adding/editing/deleting an entry — only the separate `customerEntries` react-query (used
// by the on-page table) was invalidated on mutation. For a customer whose newest entry (or
// only entry) wasn't in that stale snapshot yet, hasEntries fell through to a legacy
// min(paid, amount) calculation that silently capped an overpayment's collected total at the
// planned amount and zeroed the balance card. cardEntriesToLedgerEntries() lets the KPI
// summary be recomputed straight from the same live `customerEntries` the table already
// renders, closing the two-source desync at its root instead of patching the legacy fallback.

function row(overrides: Partial<{
  id: string; customer_id: string; amount_try: number; paid_amount_try: number;
  account_type: string; entry_date: string;
}>) {
  return {
    id: "r1", customer_id: "c1", amount_try: 0, paid_amount_try: 0,
    account_type: "resmi", entry_date: "2026-08-10",
    ...overrides,
  };
}

function summarize(entries: ReturnType<typeof row>[], today = "2026-08-06") {
  return summarizeCustomerLedgerEntries(cardEntriesToLedgerEntries(entries), { today, group: "Resmi" });
}

describe("QA-B/C BUG-03 customer detail KPI — shared balance rule", () => {
  it("no payment: planned kept, paid zero, balance equals planned", () => {
    const s = summarize([row({ amount_try: 100000, paid_amount_try: 0 })]);
    expect(s.planned).toBe(100000);
    expect(s.paid).toBe(0);
    expect(s.remaining).toBe(100000);
  });

  it("partial payment: paid reflected, balance is the true remainder", () => {
    const s = summarize([row({ amount_try: 100000, paid_amount_try: 40000 })]);
    expect(s.planned).toBe(100000);
    expect(s.paid).toBe(40000);
    expect(s.remaining).toBe(60000);
  });

  it("full payment: balance settles to zero", () => {
    const s = summarize([row({ amount_try: 100000, paid_amount_try: 100000 })]);
    expect(s.planned).toBe(100000);
    expect(s.paid).toBe(100000);
    expect(s.remaining).toBe(0);
  });

  it("overpayment: paid is the full uncapped amount, balance goes negative (QA-B/C exact scenario)", () => {
    const s = summarize([row({ amount_try: 100000, paid_amount_try: 120000 })]);
    expect(s.planned).toBe(100000);
    expect(s.paid).toBe(120000);
    expect(s.remaining).toBe(-20000);
  });

  it("mixed records for the same customer: overpayment on one row never masks another row's open balance", () => {
    const s = summarize([
      row({ id: "r1", amount_try: 100000, paid_amount_try: 120000 }), // overpaid
      row({ id: "r2", amount_try: 50000, paid_amount_try: 0 }),       // fully open
    ]);
    expect(s.planned).toBe(150000);
    expect(s.paid).toBe(120000);
    expect(s.remaining).toBe(30000); // 150000 - 120000, not clamped/hidden by the overpaid row
  });

  it("foreign-currency-tagged rows are still summed via TRY-converted amount_try/paid_amount_try", () => {
    // amount_try/paid_amount_try are already the TRY-converted snapshot values regardless of
    // the entry's original currency — cardEntriesToLedgerEntries only ever reads those two
    // fields, so foreign-currency rows behave identically to TRY rows here.
    const s = summarize([row({ amount_try: 550000, paid_amount_try: 220000 })]);
    expect(s.planned).toBe(550000);
    expect(s.paid).toBe(220000);
    expect(s.remaining).toBe(330000);
  });
});
